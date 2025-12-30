/**
 * MCP Agent Service
 *
 * This service enables AI agents (ChatBot/QnA) to interact with MCP integrations
 * It provides tool discovery and action execution capabilities for user tasks
 */

import axios, { AxiosInstance } from 'axios';

// MCP Service Configuration
const MCP_SERVICE_URL = process.env.MCP_SERVICE_URL || 'https://mcp.openanalyst.com';
const MCP_API_KEY = process.env.AGENT_API_KEY || process.env.MCP_API_KEY;

// Types for MCP Integration
interface McpTool {
  name: string;
  description: string;
  provider: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface McpToolsResponse {
  tools: McpTool[];
}

interface McpExecuteRequest {
  user_id: string;
  action: string;
  params: Record<string, any>;
}

interface McpExecuteResponse {
  success: boolean;
  result: any | null;
  error: string | null;
}

/**
 * Service class for MCP agent operations
 */
export class McpAgentService {
  private axiosInstance: AxiosInstance;

  constructor() {
    // Check if API key is configured
    if (!MCP_API_KEY) {
      console.warn('[MCP Agent] WARNING: MCP_API_KEY/AGENT_API_KEY not configured');
    }

    // Initialize axios with base configuration
    this.axiosInstance = axios.create({
      baseURL: MCP_SERVICE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MCP_API_KEY || '', // Add the required X-API-Key header
      },
    });

    // Add logging interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        console.log(`[MCP Agent] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[MCP Agent] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        console.log(`[MCP Agent] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`[MCP Agent] Error ${error.response?.status}: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get available tools for a user based on their connected integrations
   * This is used to understand what actions the AI can perform for the user
   *
   * @param userId - The user's ID (e.g., Google ID from OAuth)
   * @returns List of available tools/actions
   */
  async getToolsForUser(userId: string): Promise<McpTool[]> {
    try {
      console.log(`[MCP Agent] Fetching tools for user: ${userId}`);

      const response = await this.axiosInstance.get<McpToolsResponse>('/api/tools', {
        params: { user_id: userId },
      });

      const tools = response.data.tools || [];
      console.log(`[MCP Agent] Found ${tools.length} tools for user ${userId}`);

      return tools;
    } catch (error: any) {
      console.error(`[MCP Agent] Failed to get tools for user ${userId}:`, error);

      // Return empty array if user has no integrations
      if (error.response?.status === 404) {
        return [];
      }

      throw new Error(`Failed to get MCP tools: ${error.message}`);
    }
  }

  /**
   * Execute an action on behalf of a user
   * This is called when the AI agent needs to perform an action (e.g., send email)
   *
   * @param userId - The user's ID
   * @param action - The action to execute (e.g., GMAIL_SEND_EMAIL)
   * @param params - Parameters for the action
   * @returns Execution result
   */
  async executeUserAction(
    userId: string,
    action: string,
    params: Record<string, any>
  ): Promise<McpExecuteResponse> {
    try {
      console.log(`[MCP Agent] Executing action ${action} for user ${userId}`);

      const request: McpExecuteRequest = {
        user_id: userId,
        action,
        params,
      };

      const response = await this.axiosInstance.post<McpExecuteResponse>(
        '/api/tools/execute',
        request
      );

      if (response.data.success) {
        console.log(`[MCP Agent] Successfully executed ${action}`);
      } else {
        console.error(`[MCP Agent] Failed to execute ${action}: ${response.data.error}`);
      }

      return response.data;
    } catch (error: any) {
      console.error(`[MCP Agent] Error executing ${action}:`, error);

      return {
        success: false,
        result: null,
        error: error.message || 'Failed to execute action',
      };
    }
  }

  /**
   * Convert MCP tools to OpenAI function format for LLM integration
   * This allows the LLM to understand what tools are available
   *
   * @param tools - Array of MCP tools
   * @returns OpenAI-compatible function definitions
   */
  convertToOpenAIFunctions(tools: McpTool[]) {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Check if a specific action is available for a user
   *
   * @param userId - The user's ID
   * @param action - The action to check (e.g., GMAIL_SEND_EMAIL)
   * @returns Boolean indicating if action is available
   */
  async isActionAvailable(userId: string, action: string): Promise<boolean> {
    try {
      const tools = await this.getToolsForUser(userId);
      return tools.some(tool => tool.name === action);
    } catch (error) {
      console.error(`[MCP Agent] Error checking action availability:`, error);
      return false;
    }
  }

  /**
   * Get tools for a specific provider
   *
   * @param userId - The user's ID
   * @param provider - Provider name (gmail, slack)
   * @returns Tools for the specified provider
   */
  async getToolsForProvider(userId: string, provider: string): Promise<McpTool[]> {
    try {
      const tools = await this.getToolsForUser(userId);
      return tools.filter(tool => tool.provider === provider);
    } catch (error) {
      console.error(`[MCP Agent] Error getting tools for provider ${provider}:`, error);
      return [];
    }
  }

  /**
   * Execute Gmail-specific actions
   */
  async sendEmail(
    userId: string,
    recipientEmail: string,
    subject: string,
    body: string
  ): Promise<McpExecuteResponse> {
    return this.executeUserAction(userId, 'GMAIL_SEND_EMAIL', {
      recipient_email: recipientEmail,
      subject,
      body,
    });
  }

  async fetchEmails(
    userId: string,
    query?: string,
    maxResults: number = 10
  ): Promise<McpExecuteResponse> {
    return this.executeUserAction(userId, 'GMAIL_FETCH_EMAILS', {
      query,
      max_results: maxResults,
    });
  }

  /**
   * Execute Slack-specific actions
   */
  async sendSlackMessage(
    userId: string,
    channel: string,
    text: string
  ): Promise<McpExecuteResponse> {
    return this.executeUserAction(userId, 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL', {
      channel,
      text,
    });
  }

  async fetchSlackHistory(
    userId: string,
    channel: string
  ): Promise<McpExecuteResponse> {
    return this.executeUserAction(userId, 'SLACK_FETCHES_CONVERSATION_HISTORY', {
      channel,
    });
  }
}

// Export singleton instance
export const mcpAgentService = new McpAgentService();

// Export for testing
export default McpAgentService;