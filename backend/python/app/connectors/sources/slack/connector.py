from typing import Any, Dict, List, Optional, Tuple, Union
import logging
from logging import Logger
import uuid
import asyncio

from fastapi.responses import StreamingResponse

from app.config.configuration_service import ConfigurationService
from app.connectors.core.base.connector.connector_service import BaseConnector
from app.connectors.core.base.data_processor.data_source_entities_processor import (
    DataSourceEntitiesProcessor,
)
from app.connectors.core.base.data_store.data_store import DataStoreProvider
from app.connectors.core.interfaces.connector.apps import App
from app.sources.client.slack.slack import SlackClient, SlackResponse
from app.sources.external.slack.slack import SlackDataSource
from app.models.entities import Record, RecordType, RecordGroupType, OriginTypes, IndexingStatus, MessageRecord
from app.config.constants.arangodb import Connectors, MimeTypes, AppGroups
from app.utils.time_conversion import get_epoch_timestamp_in_ms
from app.models.permission import Permission, PermissionType, EntityType
from app.connectors.core.registry.connector_builder import (
    ConnectorBuilder,
    DocumentationLink,
    AuthField,
)

class SlackApp(App):
    def __init__(self) -> None:
        super().__init__(Connectors.SLACK, AppGroups.MICROSOFT)  # Slack doesn't have its own AppGroup, using a placeholder

@ConnectorBuilder("Slack")\
    .in_group("Slack")\
    .with_auth_type("API_TOKEN")\
    .with_description("Sync messages and channels from Slack")\
    .with_categories(["Messaging"])\
    .configure(lambda builder: builder
        .with_icon("/assets/icons/connectors/slack.svg")
        .add_documentation_link(DocumentationLink(
            "Slack Bot Token Setup",
            "https://api.slack.com/authentication/basics",
            "setup"
        ))
        .add_documentation_link(DocumentationLink(
            'Pipeshub Documentation',
            'https://docs.pipeshub.com/connectors/slack/slack',
            'pipeshub'
        ))
        .with_redirect_uri("", False)
        .add_auth_field(AuthField(
            name="botToken",
            display_name="Bot Token",
            placeholder="xoxb-...",
            description="The Bot User OAuth Access Token from Slack App settings",
            field_type="PASSWORD",
            max_length=8000,
            is_secret=True
        ))
        .with_sync_strategies(["SCHEDULED", "MANUAL"])
        .with_scheduled_config(True, 60)
    )\
    .build_decorator()
class SlackConnector(BaseConnector):
    def __init__(self, logger: Logger, data_entities_processor: DataSourceEntitiesProcessor,
        data_store_provider: DataStoreProvider, config_service: ConfigurationService) -> None:
        super().__init__(SlackApp(), logger, data_entities_processor, data_store_provider, config_service)
        self.slack_client = None
        self.slack_data_source = None

    async def init(self) -> bool:
        try:
            # Try to get org-specific config first
            config_path = f"/services/connectors/slack/config/{self.data_entities_processor.org_id}"
            config = await self.config_service.get_config(config_path)
            
            # Fallback to global config if needed (though usually org-specific)
            if not config:
                config = await self.config_service.get_config("/services/connectors/slack/config")
                
            if not config:
                self.logger.error("Slack config not found")
                return False
                
            self.slack_client = await SlackClient.build_from_services(
                 logger=self.logger,
                 config_service=self.config_service,
            )
            
            self.slack_data_source = SlackDataSource(self.slack_client)
            self.logger.info("Slack connector initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize Slack connector: {e}")
            return False

    async def run_sync(self) -> None:
        self.logger.info("Starting Slack sync")
        if not self.slack_data_source:
             if not await self.init():
                 raise Exception("Failed to initialize Slack connector")

        try:
             # Verify which workspace we're connected to
             try:
                 web_client = self.slack_client.get_web_client()
                 team_info = web_client.team_info()
                 if team_info and team_info.get('ok'):
                     team_data = team_info.get('team', {})
                     self.logger.info("🔍 CONNECTED TO SLACK WORKSPACE: %s", team_data.get('name'))
             except Exception as e:
                 self.logger.warning(f"Could not fetch workspace info: {e}")
             
             # Sync Channels
             self.logger.info("Fetching Slack channels...")
             response = await self.slack_data_source.conversations_list(
                 types="public_channel,private_channel"
             )
             
             if not response.success:
                 self.logger.error(f"Failed to list channels: {response.error}")
                 return

             channels = response.data.get('channels', [])
             self.logger.info(f"Found {len(channels)} channels to sync")
             
             all_records_with_permissions = []
             
             # Create Org-level permission
             org_permission = Permission(
                 type=PermissionType.READ,
                 entity_type=EntityType.ORG,
                 external_id=self.data_entities_processor.org_id
             )
             
             for channel in channels:
                 channel_id = channel.get('id')
                 channel_name = channel.get('name', 'Unknown')
                 
                 if not channel_id:
                     continue
                 
                 self.logger.info(f"Processing channel: {channel_name} (ID: {channel_id})")
                 
                 # Create Channel record (FOLDER-like)
                 channel_record = Record(
                     id=str(uuid.uuid4()),
                     org_id=self.data_entities_processor.org_id,
                     record_name=channel_name,
                     record_type=RecordType.MESSAGE, # Use MESSAGE as placeholder
                     record_group_type=RecordGroupType.SLACK_CHANNEL, 
                     origin=OriginTypes.CONNECTOR,
                     connector_name=Connectors.SLACK,
                     version=1,
                     created_at=get_epoch_timestamp_in_ms(),
                     updated_at=get_epoch_timestamp_in_ms(),
                     external_record_id=channel_id,
                     external_record_group_id=channel_id,
                     source_created_at=channel.get('created', 0) * 1000,
                     mime_type=MimeTypes.FOLDER.value,
                     weburl=f"https://slack.com/app_redirect?channel={channel_id}",
                     indexing_status=IndexingStatus.COMPLETED.value,
                 )
                 
                 all_records_with_permissions.append((channel_record, [org_permission]))
                 
                 # Fetch and Sync messages for this channel
                 try:
                     message_records = await self.sync_channel_messages(channel_id, channel_name, org_permission)
                     all_records_with_permissions.extend(message_records)
                 except Exception as e:
                     self.logger.error(f"Error syncing messages for channel {channel_name}: {e}")

             if all_records_with_permissions:
                 self.logger.info(f"Sending {len(all_records_with_permissions)} total Slack records to data processor...")
                 await self.data_entities_processor.on_new_records(all_records_with_permissions)
                 self.logger.info(f"✅ Successfully ingested {len(all_records_with_permissions)} Slack records")
             else:
                 self.logger.warning("No channels or messages to sync")

        except Exception as e:
             self.logger.error(f"Error during Slack sync: {e}")
             raise

    async def sync_channel_messages(self, channel_id: str, channel_name: str, org_permission: Permission) -> List[Tuple[Record, List[Permission]]]:
        """Fetch and create records for messages in a channel"""
        self.logger.info(f"Fetching messages for Slack channel: {channel_name}")
        
        # Create a SlackMessageRecord class with proper to_kafka_record implementation
        class SlackMessageRecord(MessageRecord):
            def to_kafka_record(self):
                return {
                    "recordId": self.id,
                    "orgId": self.org_id,
                    "recordName": self.record_name,
                    "recordType": self.record_type.value,
                    "externalRecordId": self.external_record_id,
                    "version": self.version,
                    "origin": self.origin.value,
                    "connectorName": self.connector_name.value,
                    "mimeType": self.mime_type,
                    "webUrl": self.weburl,
                    "createdAtTimestamp": self.created_at,
                    "updatedAtTimestamp": self.updated_at,
                    "sourceCreatedAtTimestamp": self.source_created_at,
                    "sourceLastModifiedTimestamp": self.source_updated_at,
                    "externalGroupId": self.external_record_group_id,
                }
        
        records = []
        
        # Limit sync for now (e.g. 50 messages per channel for performance)
        response = await self.slack_data_source.conversations_history(channel=channel_id, limit=50)
        
        if not response.success:
            self.logger.error(f"Failed to fetch history for channel {channel_id}: {response.error}")
            return []
            
        messages = response.data.get('messages', [])
        self.logger.info(f"Found {len(messages)} messages to sync in {channel_name}")
        
        for msg in messages:
            subtype = msg.get('subtype')
            ts = msg.get('ts')
            text = msg.get('text', '')
            user_id = msg.get('user', 'system')
            
            # Skip join/leave messages if text is empty or subtype is present
            if subtype and subtype not in ['file_share', 'thread_broadcast']:
                continue
            if not text and not msg.get('files'):
                continue
            if not ts:
                continue
                
            # Create a searchable record name
            summary = text[:100].replace("\n", " ") + ('...' if len(text) > 100 else '')
            record_name = f"Message from {user_id}: {summary}"
            
            record_id = str(uuid.uuid4())
            
            record = SlackMessageRecord(
                id=record_id,
                org_id=self.data_entities_processor.org_id,
                record_name=record_name,
                record_type=RecordType.MESSAGE,
                record_group_type=RecordGroupType.SLACK_CHANNEL,
                origin=OriginTypes.CONNECTOR,
                connector_name=Connectors.SLACK,
                version=1,
                created_at=get_epoch_timestamp_in_ms(),
                updated_at=get_epoch_timestamp_in_ms(),
                external_record_id=f"{channel_id}:{ts}",
                external_record_group_id=channel_id,
                source_created_at=int(float(ts) * 1000),
                mime_type=MimeTypes.PLAIN_TEXT.value,
                weburl=f"https://slack.com/archives/{channel_id}/p{ts.replace('.', '')}",
                indexing_status=IndexingStatus.NOT_STARTED.value,
                virtual_record_id=record_id,  # CRITICAL: Set virtualRecordId for indexing
                content=text
            )
            records.append((record, [org_permission]))

            
        return records

    @classmethod
    async def create_connector(cls, logger: Logger,
                               data_store_provider: DataStoreProvider, config_service: ConfigurationService) -> BaseConnector:
        data_entities_processor = DataSourceEntitiesProcessor(logger, data_store_provider, config_service)
        await data_entities_processor.initialize()
        return SlackConnector(logger, data_entities_processor, data_store_provider, config_service)

    # Implement abstract methods
    def test_connection_and_access(self) -> bool:
        return True
    
    def get_signed_url(self, record) -> Optional[str]:
        return None
    
    async def stream_record(self, record: Record) -> StreamingResponse:
        """Fetch message content from Slack and stream it"""
        try:
            if not self.slack_data_source:
                if not await self.init():
                    raise Exception("Failed to initialize Slack connector")
                    
            ext_id = record.external_record_id
            
            # Channel record - return channel info
            if ":" not in ext_id:
                async def channel_generator():
                    yield f"Slack Channel: {record.record_name}\n"
                return StreamingResponse(channel_generator(), media_type=MimeTypes.PLAIN_TEXT.value)
            
            # Message record - fetch from Slack
            channel_id, ts = ext_id.split(":")
            
            response = await self.slack_data_source.conversations_history(
                channel=channel_id,
                latest=ts,
                inclusive=True,
                limit=1
            )
            
            if not response.success or not response.data.get('messages'):
                self.logger.error(f"Failed to fetch Slack message {ext_id}: {response.error}")
                async def error_generator():
                    yield f"Could not fetch message content: {response.error}"
                return StreamingResponse(error_generator(), media_type=MimeTypes.PLAIN_TEXT.value)
            
            msg = response.data.get('messages')[0]
            content = msg.get('text', '')
            
            async def message_generator():
                yield content
            
            return StreamingResponse(message_generator(), media_type=MimeTypes.PLAIN_TEXT.value)
            
        except Exception as e:
            self.logger.error(f"Error in stream_record for {record.external_record_id}: {e}")
            async def exception_generator():
                yield ""
            return StreamingResponse(exception_generator(), media_type=MimeTypes.PLAIN_TEXT.value)
        
    def run_incremental_sync(self) -> None:
        pass
    def handle_webhook_notification(self, notification: Dict) -> None:
        pass
    async def cleanup(self) -> None:
        pass
    async def reindex_records(self, record_results: List) -> None:
        pass
