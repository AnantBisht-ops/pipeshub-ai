/**
 * MCP Integration Service
 *
 * This service handles communication with the external MCP service
 * for OAuth connections and integration management
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// Configuration
const MCP_SERVICE_URL = process.env.MCP_SERVICE_URL || 'https://mcp.openanalyst.com';
const MCP_API_KEY = process.env.AGENT_API_KEY || process.env.MCP_API_KEY;

// Types
export interface McpIntegration {
  provider: string;
  status: 'active' | 'pending' | 'disconnected' | 'expired' | 'error';
  connected_email?: string;
  connected_at?: string;
  last_used_at?: string;
}

export interface McpIntegrationsResponse {
  integrations: McpIntegration[];
  message?: string;
}

export interface McpConnectResponse {
  auth_url: string | null;
  state?: string;
  message?: string;
  status?: string;
}

export interface McpHealthResponse {
  status: string;
  message: string;
}

/**
 * MCP Integration Service Class
 * Proxies requests to the external MCP service
 */
export class McpIntegrationService {
  private axiosInstance: AxiosInstance;

  constructor() {
    // Check if API key is configured
    if (!MCP_API_KEY) {
      console.warn('[MCP Integration] WARNING: MCP_API_KEY/AGENT_API_KEY not configured in environment variables');
      console.warn('[MCP Integration] The MCP service requires an X-API-Key header for authentication');
    }

    // Initialize axios with base configuration
    this.axiosInstance = axios.create({
      baseURL: MCP_SERVICE_URL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MCP_API_KEY || '', // Add the required X-API-Key header
      },
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log(`[MCP Integration] ${config.method?.toUpperCase()} ${config.url}`);
        if (config.headers?.['X-API-Key']) {
          console.log('[MCP Integration] X-API-Key header is present');
        } else {
          console.error('[MCP Integration] WARNING: X-API-Key header is missing!');
        }
        return config;
      },
      (error) => {
        console.error('[MCP Integration] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log(`[MCP Integration] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        const errorMessage = (error.response?.data as any)?.detail || error.message;
        console.error(`[MCP Integration] Error ${error.response?.status}: ${errorMessage}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get connected integrations for a user
   * GET /api/integrations/connected
   * Note: MCP service uses user_id, not JWT authentication
   */
  async getConnectedIntegrations(userId: string): Promise<McpIntegrationsResponse> {
    try {
      console.log(`[MCP Integration] Getting integrations for user: ${userId}`);

      const response = await this.axiosInstance.get<McpIntegrationsResponse>(
        '/api/integrations/connected',
        {
          params: {
            user_id: userId
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('[MCP Integration] Failed to get connected integrations:', error);

      // If it's a 401/403, return empty integrations instead of throwing
      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          integrations: [],
          message: 'Authentication required. Please log in to manage integrations.',
        };
      }

      // If it's a 404, user might not exist in MCP service yet
      if (error.response?.status === 404) {
        console.log('[MCP Integration] User not found in MCP service, returning empty integrations');
        return {
          integrations: [],
          message: 'No integrations found. Connect an integration to get started.',
        };
      }

      throw this.handleError(error);
    }
  }

  /**
   * Connect a new integration (start OAuth flow)
   * POST /api/integrations/connect
   * Note: MCP service uses user_id, not JWT authentication
   */
  async connectIntegration(
    userId: string,
    provider: string,
    redirectUri: string,
    forceReauth: boolean = false
  ): Promise<McpConnectResponse> {
    try {
      console.log(`[MCP Integration] Connecting ${provider} for user: ${userId}`);
      console.log(`[MCP Integration] Redirect URI: ${redirectUri}`);
      console.log(`[MCP Integration] Force reauth: ${forceReauth}`);

      const response = await this.axiosInstance.post<McpConnectResponse>(
        '/api/integrations/connect',
        {
          user_id: userId,
          provider,
          force_reauth: forceReauth,
          redirect_uri: redirectUri,
        }
      );

      console.log('[MCP Integration] Connect response:', JSON.stringify(response.data));

      return response.data;
    } catch (error: any) {
      console.error(`[MCP Integration] Failed to connect ${provider}:`, error);

      // Check if error is "already connected"
      const errorMessage = error.response?.data?.detail || error.message || '';
      if (error.response?.status === 400 &&
          (errorMessage.toLowerCase().includes('already has an active') ||
           errorMessage.toLowerCase().includes('already connected'))) {
        console.log(`[MCP Integration] ${provider} is already connected for user ${userId}`);
        // Return a response indicating it's already connected
        return {
          auth_url: null,
          message: `${provider} is already connected`,
          status: 'already_connected',
        };
      }

      throw this.handleError(error);
    }
  }

  /**
   * Disconnect an existing integration
   * POST /api/integrations/disconnect
   * Note: MCP service uses user_id, not JWT authentication
   */
  async disconnectIntegration(userId: string, provider: string): Promise<{ message: string }> {
    try {
      console.log(`[MCP Integration] Disconnecting ${provider} for user: ${userId}`);

      const response = await this.axiosInstance.post<{ message: string }>(
        '/api/integrations/disconnect',
        {
          user_id: userId,
          provider: provider
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(`[MCP Integration] Failed to disconnect ${provider}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Get status of a specific integration
   * GET /api/integrations/{provider}/status
   * Note: MCP service uses user_id, not JWT authentication
   */
  async getIntegrationStatus(userId: string, provider: string): Promise<McpIntegration> {
    try {
      const response = await this.axiosInstance.get<McpIntegration>(
        `/api/integrations/${provider}/status`,
        {
          params: {
            user_id: userId
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(`[MCP Integration] Failed to get status for ${provider}:`, error);
      throw this.handleError(error);
    }
  }

  /**
   * Health check endpoint
   * GET /api/tools/health
   */
  async checkHealth(): Promise<McpHealthResponse> {
    try {
      const response = await this.axiosInstance.get<McpHealthResponse>('/api/tools/health');
      return response.data;
    } catch (error: any) {
      console.error('[MCP Integration] Health check failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Handle errors and convert to a standard format
   */
  private handleError(error: any): Error {
    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const data = error.response.data;

      // Try to extract error message from various possible fields
      let message = 'Unknown error';
      if (typeof data === 'string') {
        message = data;
      } else if (data?.detail) {
        message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      } else if (data?.message) {
        message = data.message;
      } else if (data?.error) {
        message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else if (data) {
        // If none of the above, stringify the entire data object
        message = JSON.stringify(data);
      }

      console.error(`[MCP Integration] Full error response:`, {
        status,
        data,
        headers: error.response.headers
      });

      return new Error(`MCP Service Error (${status}): ${message}`);
    } else if (error.request) {
      // No response received
      console.error('[MCP Integration] No response received:', error.request);
      return new Error('MCP Service is not responding. Please check connectivity.');
    } else {
      // Other errors
      console.error('[MCP Integration] Request setup error:', error.message);
      return new Error(`MCP Service Error: ${error.message}`);
    }
  }
}

// Export singleton instance
export const mcpIntegrationService = new McpIntegrationService();
