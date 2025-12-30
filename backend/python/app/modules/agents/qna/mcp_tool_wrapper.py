"""
MCP Tool Wrapper for Dynamic Tool Registration

This module provides functionality to dynamically register MCP tools
from the external MCP service into the Python agent's tool registry.
"""

import json
import logging
from typing import Any, Dict, List, Optional

import aiohttp
from app.agents.tools.models import Tool
from app.agents.tools.registry import _global_tools_registry


class MCPTool(Tool):
    """
    A wrapper for MCP tools that can be dynamically registered.

    MCP tools are external tools managed by the MCP service (e.g., Gmail, Slack, BigQuery).
    This wrapper allows them to be used within the Python agent system.
    """

    def __init__(
        self,
        app_name: str,
        tool_name: str,
        description: str,
        provider: str,
        parameters: Dict[str, Any],
        mcp_service_url: str = None,
        user_id: str = None
    ):
        """Initialize an MCP tool wrapper.

        Args:
            app_name: Name of the application (e.g., "gmail", "slack")
            tool_name: Name of the specific tool (e.g., "send_email", "send_message")
            description: Tool description for the LLM
            provider: Provider name (e.g., "gmail", "slack")
            parameters: Tool parameters schema
            mcp_service_url: URL of the MCP service
            user_id: User ID for authentication
        """
        super().__init__(app_name, tool_name)
        self.description = description
        self.provider = provider
        self.parameters = parameters
        self.mcp_service_url = mcp_service_url or "https://mcp.openanalyst.com"
        self.user_id = user_id
        self.logger = logging.getLogger(__name__)

    async def run(self, **kwargs) -> Dict[str, Any]:
        """Execute the MCP tool via the Node.js backend proxy.

        Args:
            **kwargs: Tool-specific parameters

        Returns:
            Tool execution result from MCP service via Node.js proxy
        """
        try:
            import os
            # Use Node.js backend endpoint instead of direct MCP service
            nodejs_backend_url = os.environ.get("NODEJS_BACKEND_URL", "http://localhost:3001")

            # Prepare the execution request
            execution_data = {
                "user_id": self.user_id,
                "action": f"{self.app_name}.{self.tool_name}",
                "params": kwargs
            }

            # Call Node.js backend to execute the tool (which will call MCP service)
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._get_auth_token()}"  # Use auth token for Node.js backend
                }

                async with session.post(
                    f"{nodejs_backend_url}/api/v1/agent/mcp/execute",
                    json=execution_data,
                    headers=headers
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        # Node.js returns the full MCP response, extract the result
                        if result.get("success"):
                            return result.get("result", {})
                        else:
                            return {
                                "error": result.get("error", "Tool execution failed"),
                                "tool": f"{self.app_name}.{self.tool_name}"
                            }
                    else:
                        error_text = await response.text()
                        self.logger.error(f"MCP tool execution failed: {error_text}")
                        return {
                            "error": f"Tool execution failed with status {response.status}",
                            "details": error_text
                        }

        except Exception as e:
            self.logger.error(f"Error executing MCP tool {self.app_name}.{self.tool_name}: {e}")
            return {
                "error": str(e),
                "tool": f"{self.app_name}.{self.tool_name}"
            }

    def _get_auth_token(self) -> str:
        """Get authentication token for Node.js backend.

        Returns:
            Auth token from environment or config
        """
        import os
        # This should be the auth token for the Node.js backend, not MCP API key
        return os.environ.get("NODEJS_AUTH_TOKEN", "")

    def _get_api_key(self) -> str:
        """Get API key for MCP service authentication.

        Returns:
            API key from environment or config
        """
        import os
        return os.environ.get("MCP_API_KEY", os.environ.get("AGENT_API_KEY", ""))


def register_mcp_tools(mcp_tools: List[Dict[str, Any]], user_id: str, logger: Optional[logging.Logger] = None) -> int:
    """
    Register MCP tools dynamically in the global tool registry.

    Args:
        mcp_tools: List of MCP tool definitions from the Node.js backend
        user_id: User ID for tool execution
        logger: Optional logger instance

    Returns:
        Number of tools successfully registered
    """
    if not mcp_tools:
        return 0

    if logger is None:
        logger = logging.getLogger(__name__)

    registered_count = 0

    for tool_def in mcp_tools:
        try:
            # Parse tool name (e.g., "GMAIL_SEND_EMAIL" -> "gmail.send_email")
            tool_name = tool_def.get("name", "")

            # Convert tool name format
            if "_" in tool_name:
                # Handle format like "GMAIL_SEND_EMAIL"
                parts = tool_name.lower().split("_", 1)
                if len(parts) == 2:
                    app_name = parts[0]
                    tool_action = parts[1].replace("_", "_")
                else:
                    app_name = tool_name.lower()
                    tool_action = "execute"
            else:
                # Handle format like "gmail.send_email"
                if "." in tool_name:
                    app_name, tool_action = tool_name.split(".", 1)
                else:
                    app_name = tool_name.lower()
                    tool_action = "execute"

            # Create MCP tool wrapper
            mcp_tool = MCPTool(
                app_name=app_name,
                tool_name=tool_action,
                description=tool_def.get("description", f"Execute {tool_name}"),
                provider=tool_def.get("provider", app_name),
                parameters=tool_def.get("parameters", {}),
                user_id=user_id
            )

            # Register in global registry
            full_tool_name = f"{app_name}.{tool_action}"

            # Check if tool already exists to avoid duplicates
            if full_tool_name not in _global_tools_registry._tools:
                _global_tools_registry.register(mcp_tool)
                registered_count += 1
                logger.info(f"Registered MCP tool: {full_tool_name}")
            else:
                logger.debug(f"MCP tool already registered: {full_tool_name}")

        except Exception as e:
            logger.error(f"Failed to register MCP tool {tool_def.get('name', 'unknown')}: {e}")

    logger.info(f"Successfully registered {registered_count} MCP tools")
    return registered_count


def unregister_mcp_tools(app_names: List[str], logger: Optional[logging.Logger] = None) -> int:
    """
    Unregister MCP tools from the global registry.

    This is useful for cleanup or when user disconnects integrations.

    Args:
        app_names: List of app names to unregister (e.g., ["gmail", "slack"])
        logger: Optional logger instance

    Returns:
        Number of tools unregistered
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    unregistered_count = 0
    tools_to_remove = []

    # Find all tools belonging to specified apps
    for tool_name in _global_tools_registry._tools.keys():
        app_name = tool_name.split(".")[0] if "." in tool_name else None
        if app_name and app_name in app_names:
            tools_to_remove.append(tool_name)

    # Remove tools from registry
    for tool_name in tools_to_remove:
        try:
            del _global_tools_registry._tools[tool_name]
            unregistered_count += 1
            logger.info(f"Unregistered MCP tool: {tool_name}")
        except KeyError:
            logger.warning(f"Tool not found in registry: {tool_name}")

    logger.info(f"Unregistered {unregistered_count} MCP tools")
    return unregistered_count