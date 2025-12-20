/**
 * MCP Integration Configuration
 *
 * Central configuration for the MCP integration service
 */

// MCP Service Configuration
export const MCP_CONFIG = {
  // Service URL - Points to the AWS EC2 instance
  SERVICE_URL: 'https://mcp.openanalyst.com',

  // API Key for AI agent operations (to be configured during deployment)
  API_KEY: '',

  // OAuth configuration
  OAUTH: {
    // Supported providers
    PROVIDERS: ['gmail', 'slack'] as const,

    // OAuth redirect paths
    REDIRECT_PATHS: {
      BUSINESS: '/account/company-settings/settings/mcp/oauth/callback',
      INDIVIDUAL: '/account/individual/settings/mcp/oauth/callback',
    },
  },

  // Debug mode
  DEBUG: false,

  // Request timeout (in milliseconds)
  TIMEOUT: 30000,

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000, // milliseconds
  },
};

// Provider configuration with display information
export const PROVIDER_CONFIG = {
  gmail: {
    name: 'Gmail',
    displayName: 'Google Gmail',
    description: 'Send and manage emails',
    color: '#EA4335',
    icon: 'logos:google-gmail',
    capabilities: [
      'Send emails on your behalf',
      'Search and read emails',
      'Create and manage drafts',
      'Organize with labels',
      'Delete emails',
    ],
    actions: [
      'GMAIL_SEND_EMAIL',
      'GMAIL_FETCH_EMAILS',
      'GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID',
      'GMAIL_FETCH_MESSAGE_BY_THREAD_ID',
      'GMAIL_CREATE_EMAIL_DRAFT',
      'GMAIL_ADD_LABEL_TO_EMAIL',
      'GMAIL_LIST_LABELS',
      'GMAIL_DELETE_MESSAGE',
    ],
  },
  slack: {
    name: 'Slack',
    displayName: 'Slack',
    description: 'Send messages to channels',
    color: '#4A154B',
    icon: 'logos:slack-icon',
    capabilities: [
      'Post messages to channels',
      'Search conversations',
      'List team channels',
      'Read channel history',
    ],
    actions: [
      'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
      'SLACK_LIST_ALL_SLACK_TEAM_CHANNELS_WITH_PAGINATION',
      'SLACK_FETCHES_CONVERSATION_HISTORY',
      'SLACK_SEARCH_MESSAGES_IN_SLACK',
    ],
  },
} as const;

// Type for provider keys
export type ProviderKey = keyof typeof PROVIDER_CONFIG;

// Helper to get provider configuration
export const getProviderConfig = (provider: ProviderKey) =>
  PROVIDER_CONFIG[provider];

// Helper to check if a provider is supported
export const isSupportedProvider = (provider: string): provider is ProviderKey =>
  provider in PROVIDER_CONFIG;