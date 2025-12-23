/**
 * MCP API Service
 *
 * This service handles all communication with the MCP Integration Service backend.
 * It manages both user-facing operations (OAuth connections) and AI agent operations.
 */

import type { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

import axios from 'axios';

import {
  McpIntegration,
  McpConnectResponse,
  McpExecuteRequest,
  McpExecuteResponse,
  McpIntegrationsResponse,
  McpToolsResponse,
  McpProviderActionsResponse,
  McpHealthResponse,
  McpErrorResponse,
  ProviderType,
} from './types';
import { mcpErrorHandler, McpErrorType } from '../utils/error-handler';

// Get backend API URL from environment or use default
// Frontend calls PipesHub backend, which proxies to external MCP service
// No API key required - MCP service is publicly accessible via Composio
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

/**
 * MCP API Service Class
 * Handles all API interactions with the MCP service
 */
class McpApiService {
  private axiosInstance: AxiosInstance;

  constructor() {
    // Create axios instance with base configuration
    // Calls PipesHub backend proxy endpoints which forward to external MCP service
    this.axiosInstance = axios.create({
      baseURL: `${BACKEND_API_URL}/api/v1/mcp`,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Include credentials for CORS
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        console.log(`[MCP API] ${config.method?.toUpperCase()} ${config.url}`);
        // Log Authorization header if present
        if (config.headers?.Authorization) {
          const authHeader = config.headers.Authorization as string;
          console.log(`[MCP API] Authorization header present, Bearer token length: ${authHeader.replace('Bearer ', '').length}`);
        } else {
          console.log('[MCP API] No Authorization header in request');
        }
        return config;
      },
      (error: any) => {
        console.error('[MCP API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`[MCP API] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error: AxiosError<McpErrorResponse>) => {
        const errorMessage = error.response?.data?.detail || error.message;
        console.error(`[MCP API] Error ${error.response?.status}: ${errorMessage}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get JWT token from localStorage
   * Looks for token in multiple possible locations
   */
  private static getAuthToken(): string | null {
    // Try multiple possible token locations
    const possibleTokenKeys = ['jwt_access_token', 'accessToken', 'pipeshub_token', 'authToken', 'jwt_token'];

    // Use array method instead of for...of to avoid ESLint no-restricted-syntax
    let foundToken: string | null = null;
    possibleTokenKeys.some((key) => {
      const token = localStorage.getItem(key);
      if (token) {
        console.log(`[MCP API] Found auth token in ${key}`);
        foundToken = token;
        return true; // Stop searching
      }
      return false;
    });

    if (!foundToken) {
      console.warn('[MCP API] No auth token found in localStorage');
    }
    return foundToken;
  }

  /**
   * Get user ID from localStorage or auth context
   */
  private static getUserId(): string | null {
    // Try to get user ID from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const userId = user.id || user.google_id || user.userId || user._id || null;
        if (userId) {
          console.log('[MCP API] Found user ID:', userId);
        }
        return userId;
      } catch (e) {
        console.error('[MCP API] Failed to parse user from localStorage:', e);
      }
    }
    console.warn('[MCP API] No user data found in localStorage');
    return null;
  }

  // ==================== USER ENDPOINTS (JWT Auth) ====================

  /**
   * Get connected integrations for the authenticated user
   * GET /api/integrations
   */
  async getConnectedIntegrations(): Promise<McpIntegrationsResponse> {
    try {
      const token = McpApiService.getAuthToken();

      // If no token, return empty integrations (user can still see providers and connect)
      if (!token) {
        console.warn('[MCP API] No auth token found - returning empty integrations');
        console.log('[MCP API] Available localStorage keys:', Object.keys(localStorage));
        return {
          integrations: [],
          message: 'No authentication token found. Please log in to manage integrations.'
        };
      }

      console.log('[MCP API] Found auth token, fetching integrations...');

      const response = await this.axiosInstance.get<McpIntegrationsResponse>(
        '/integrations',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error: any) {
      // If it's a 401/403, return empty integrations instead of throwing
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn(`[MCP API] Authentication error (${error.response.status}) - returning empty integrations`);
        return {
          integrations: [],
          message: 'Authentication required. Please log in to manage integrations.'
        };
      }

      // If already processed, re-throw
      if (error.type && Object.values(McpErrorType).includes(error.type)) {
        throw error;
      }
      // Process new errors
      const mcpError = mcpErrorHandler.handleError(error, 'getConnectedIntegrations');
      throw new Error(mcpError.message);
    }
  }

  /**
   * Connect a new integration (start OAuth flow)
   * POST /api/integrations/connect
   */
  async connectIntegration(provider: ProviderType, forceReauth: boolean = false): Promise<McpConnectResponse> {
    const token = McpApiService.getAuthToken();
    if (!token) {
      console.error('[MCP API] No auth token found in localStorage. Checked keys:',
        ['jwt_access_token', 'accessToken', 'pipeshub_token', 'authToken', 'jwt_token']);
      console.error('[MCP API] Current localStorage keys:', Object.keys(localStorage));
      throw new Error('No authentication token found. Please log in to connect integrations.');
    }

    console.log('[MCP API] Using auth token for connectIntegration, token length:', token.length);

    // Store the current URL for redirect after OAuth
    const currentUrl = window.location.href;
    sessionStorage.setItem('mcp_oauth_return_url', currentUrl);

    // Build OAuth redirect URL based on environment
    const redirectBase = window.location.origin;
    const isBusiness = localStorage.getItem('user_account_type') === 'business';
    const redirectPath = isBusiness
      ? '/account/company-settings/settings/mcp/oauth/callback'
      : '/account/individual/settings/mcp/oauth/callback';
    const redirectUri = `${redirectBase}${redirectPath}`;

    console.log('[MCP API] OAuth redirect URI:', redirectUri);

    try {
      const response = await this.axiosInstance.post<McpConnectResponse>(
        '/integrations/connect',
        {
          provider,
          force_reauth: forceReauth,
          redirect_uri: redirectUri,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('[MCP API] connectIntegration failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      // Check for specific error types
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Your session may have expired. Please log in again.');
      } else if (error.response?.status === 500) {
        const detail = error.response?.data?.detail || error.response?.data?.error;
        throw new Error(detail || 'Failed to connect to MCP service. Please try again later.');
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Connection timeout. The MCP service is not responding. Please try again.');
      } else if (!error.response) {
        throw new Error('Cannot reach the backend server. Please check your connection.');
      }

      throw error;
    }
  }

  /**
   * Disconnect an existing integration
   * DELETE /api/integrations/{provider}
   */
  async disconnectIntegration(provider: ProviderType): Promise<{ message: string }> {
    const token = McpApiService.getAuthToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in.');
    }

    const response = await this.axiosInstance.delete<{ message: string }>(
      `/integrations/${provider}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  }

  /**
   * Get status of a specific integration
   * GET /api/integrations/{provider}/status
   */
  async getIntegrationStatus(provider: ProviderType): Promise<McpIntegration> {
    const token = McpApiService.getAuthToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in.');
    }

    const response = await this.axiosInstance.get<McpIntegration>(
      `/integrations/${provider}/status`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  }

  // ==================== AI AGENT ENDPOINTS ====================

  /**
   * Get available tools for a user (for AI agents)
   * GET /api/tools?user_id={userId}
   */
  async getUserTools(userId?: string): Promise<McpToolsResponse> {
    // Use provided userId or try to get from localStorage
    const finalUserId = userId || McpApiService.getUserId();
    if (!finalUserId) {
      throw new Error('User ID not found. Please provide a user ID.');
    }

    const response = await this.axiosInstance.get<McpToolsResponse>(
      '/api/tools',
      {
        params: { user_id: finalUserId },
      }
    );
    return response.data;
  }

  /**
   * Execute an action on behalf of a user (for AI agents)
   * POST /api/tools/execute
   */
  async executeAction(userId: string, action: string, params: Record<string, any>): Promise<McpExecuteResponse> {
    const request: McpExecuteRequest = {
      user_id: userId,
      action,
      params,
    };

    const response = await this.axiosInstance.post<McpExecuteResponse>(
      '/api/tools/execute',
      request
    );
    return response.data;
  }

  /**
   * Get available actions for a specific provider
   * GET /api/tools/actions/{provider}
   */
  async getProviderActions(provider: ProviderType): Promise<McpProviderActionsResponse> {
    const response = await this.axiosInstance.get<McpProviderActionsResponse>(
      `/api/tools/actions/${provider}`
    );
    return response.data;
  }

  // ==================== UTILITY ENDPOINTS ====================

  /**
   * Health check endpoint
   * GET /health
   */
  async checkHealth(): Promise<McpHealthResponse> {
    const response = await this.axiosInstance.get<McpHealthResponse>('/health');
    return response.data;
  }

  /**
   * Helper method to handle OAuth callback
   * Processes the callback parameters and updates integration status
   */
  async handleOAuthCallback(status: string, appName?: string, error?: string): Promise<void> {
    if (status === 'success' && appName) {
      console.log(`[MCP API] OAuth successful for ${appName}`);
      // Optionally refresh the integrations list
      await this.getConnectedIntegrations();
    } else {
      console.error(`[MCP API] OAuth failed: ${error || 'Unknown error'}`);
      throw new Error(error || 'OAuth authentication failed');
    }
  }

  /**
   * Helper method to get all available providers
   */
  static getAvailableProviders(): ProviderType[] {
    return ['gmail', 'slack'];
  }

  /**
   * Helper method to get provider display information
   */
  static getProviderInfo(provider: ProviderType) {
    const providerInfo = {
      gmail: {
        name: 'Gmail',
        description: 'Send and manage emails',
        color: '#EA4335',
        capabilities: [
          'Send emails on your behalf',
          'Search and read emails',
          'Create and manage drafts',
          'Organize with labels',
        ],
      },
      slack: {
        name: 'Slack',
        description: 'Send messages to channels',
        color: '#4A154B',
        capabilities: [
          'Post messages to channels',
          'Search conversations',
          'List team channels',
          'Read channel history',
        ],
      },
    };
    return providerInfo[provider];
  }
}

// Export singleton instance
export const mcpApiService = new McpApiService();

// Export class for testing purposes
export { McpApiService };