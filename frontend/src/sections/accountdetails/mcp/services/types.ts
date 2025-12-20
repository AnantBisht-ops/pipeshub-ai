/**
 * TypeScript Type Definitions for MCP Integration Service
 *
 * These types define the data structures used for communication
 * between PipesHub frontend and the MCP service backend.
 */

// Integration status types
export type IntegrationStatus = 'active' | 'pending' | 'disconnected' | 'expired' | 'revoked' | 'error';

// Provider types
export type ProviderType = 'gmail' | 'slack';

/**
 * MCP Integration Interface
 * Represents a single integration (Gmail or Slack) for a user
 */
export interface McpIntegration {
  provider: ProviderType;
  status: IntegrationStatus;
  connected_email?: string;
  connected_at?: string;
  composio_entity_id?: string;
}

/**
 * MCP Connect Response Interface
 * Response from the /api/integrations/connect endpoint
 */
export interface McpConnectResponse {
  auth_url: string;
  message: string;
}

/**
 * MCP Tool Interface
 * Represents an available action/tool for AI agents
 */
export interface McpTool {
  name: string;
  description: string;
  provider: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Execute Request Interface
 * Request body for executing an action via MCP
 */
export interface McpExecuteRequest {
  user_id: string;
  action: string;
  params: Record<string, any>;
}

/**
 * MCP Execute Response Interface
 * Response from the /api/tools/execute endpoint
 */
export interface McpExecuteResponse {
  success: boolean;
  result: any | null;
  error: string | null;
}

/**
 * MCP Integrations List Response
 * Response from the /api/integrations endpoint
 */
export interface McpIntegrationsResponse {
  integrations: McpIntegration[];
  message?: string;
}

/**
 * MCP Tools Response
 * Response from the /api/tools endpoint
 */
export interface McpToolsResponse {
  tools: McpTool[];
}

/**
 * MCP Provider Actions Response
 * Response from the /api/tools/actions/{provider} endpoint
 */
export interface McpProviderActionsResponse {
  provider: string;
  actions: Array<{
    name: string;
    description: string;
  }>;
}

/**
 * MCP Error Response
 * Standard error response format from MCP service
 */
export interface McpErrorResponse {
  detail: string;
}

/**
 * OAuth Callback Parameters
 * Query parameters received in OAuth callback
 */
export interface OAuthCallbackParams {
  status: 'success' | 'error';
  appName?: string;
  error?: string;
  message?: string;
}

/**
 * MCP Health Check Response
 * Response from the /api/tools/health endpoint
 */
export interface McpHealthResponse {
  status: string;
  service: string;
}