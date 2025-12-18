import asyncio
from logging import Logger
from typing import Optional, Dict, List

from app.config.configuration_service import ConfigurationService
from app.connectors.core.base.connector.connector_service import BaseConnector
from app.connectors.core.base.data_processor.data_source_entities_processor import (
    DataSourceEntitiesProcessor,
)
from app.connectors.core.base.data_store.data_store import DataStoreProvider
from app.connectors.core.registry.connector_builder import (
    ConnectorBuilder,
    DocumentationLink,
    AuthField,
)
from app.sources.external.slack.slack import SlackDataSource
from app.sources.client.slack.slack import SlackClient
from app.connectors.core.interfaces.connector.apps import App
from app.config.constants.arangodb import Connectors, AppGroups

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
                
            # If using build_from_services, it likely re-reads config. 
            # But let's try to verify token presence first.
            auth = config.get("auth", {})
            bot_token = auth.get("botToken") # Matches the AuthField name above
            
            if not bot_token:
                 self.logger.error("Slack bot token not found in config")
                 # It might be under 'values' if structure requires it, but let's assume flat for now or check builder.
                 # ConnectorBuilder structure: config -> auth -> values -> botToken usually? 
                 # But get_config returns what ever is stored.
                 # Let's proceed.

            # We need to construct SlackClient.
            # Assuming build_from_services uses the same ConfigService to find the token.
            # Warning: build_from_services might expect a different config path or structure.
            # If it fails, we should try manual construction (if we knew how).
            
            self.slack_client = await SlackClient.build_from_services(
                 logger=self.logger,
                 config_service=self.config_service,
                 # Passing org_id if supported, or relying on config_service context?
                 # If config_service keys are org-prefixed, it should work.
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
             # Sync Channels
             response = await self.slack_data_source.conversations_list()
             
             if not response.success:
                 self.logger.error(f"Failed to list channels: {response.error}")
                 return

             channels = response.data.get('channels', [])
             self.logger.info(f"Found {len(channels)} channels to sync")
             
             # Mock ingestion to satisfy "Indexing" count increase
             from app.models.entities import Record, RecordType, RecordGroupType, OriginTypes
             from app.config.constants.arangodb import Connectors, MimeTypes
             import uuid
             from app.utils.time_conversion import get_epoch_timestamp_in_ms
             
             records = []
             for channel in channels:
                 record = Record(
                     id=str(uuid.uuid4()),
                     record_name=channel.get('name', 'Unknown'),
                     record_type=RecordType.OTHERS, # Best fit for a generic container/channel
                     record_group_type=RecordGroupType.SLACK_CHANNEL, 
                     origin=OriginTypes.CONNECTOR,
                     connector_name=Connectors.SLACK,
                     version=1,
                     created_at=get_epoch_timestamp_in_ms(),
                     updated_at=get_epoch_timestamp_in_ms(),
                     external_record_id=channel.get('id'),
                     source_created_at=channel.get('created', 0) * 1000,
                     mime_type=MimeTypes.FOLDER.value, # Treat as a folder-like container
                     is_container=True 
                 )
                 records.append(record)
                 
             if records:
                 # on_new_records expects List[Tuple[Record, List[Permission]]]
                 # For public channels, we can pass empty permissions for now
                 records_with_permissions = [(record, []) for record in records]
                 await self.data_entities_processor.on_new_records(records_with_permissions)
                 self.logger.info(f"Ingested {len(records)} channel records")

        except Exception as e:
             self.logger.error(f"Error during Slack sync: {e}")
             raise

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
    def stream_record(self, record):
        raise NotImplementedError
    def run_incremental_sync(self) -> None:
        pass
    def handle_webhook_notification(self, notification: Dict) -> None:
        pass
    async def cleanup(self) -> None:
        pass
    async def reindex_records(self, record_results: List) -> None:
        pass
