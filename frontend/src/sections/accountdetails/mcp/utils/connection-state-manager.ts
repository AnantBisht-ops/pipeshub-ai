/**
 * MCP Connection State Manager
 *
 * Manages connection states, handles pending connections,
 * expired OAuth tokens, and auto-refresh of integration status
 */

import { McpIntegration, ProviderType } from '../services/types';
import { mcpApiService } from '../services/api';
import { mcpErrorHandler, McpErrorType } from './error-handler';

// Connection states
export enum ConnectionState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED',
  PENDING = 'PENDING',
}

// State change event
export interface ConnectionStateEvent {
  provider: ProviderType;
  previousState: ConnectionState;
  currentState: ConnectionState;
  integration?: McpIntegration;
  error?: any;
  timestamp: Date;
}

// State manager configuration
export interface ConnectionStateConfig {
  autoRefresh: boolean;
  refreshInterval: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
  persistState: boolean;
}

// Default configuration
const DEFAULT_CONFIG: ConnectionStateConfig = {
  autoRefresh: true,
  refreshInterval: 60000, // 1 minute
  retryAttempts: 3,
  retryDelay: 2000, // 2 seconds
  persistState: true,
};

/**
 * Connection State Manager Class
 */
export class ConnectionStateManager {
  private static instance: ConnectionStateManager;

  private states: Map<ProviderType, ConnectionState> = new Map();

  private integrations: Map<ProviderType, McpIntegration> = new Map();

  private listeners: Map<string, (event: ConnectionStateEvent) => void> = new Map();

  private refreshTimer?: NodeJS.Timeout;

  private pendingOperations: Map<string, Promise<any>> = new Map();

  private config: ConnectionStateConfig;

  private retryCounters: Map<string, number> = new Map();

  private constructor(config?: Partial<ConnectionStateConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize states
    this.initializeStates();

    // Start auto-refresh if enabled
    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }

    // Load persisted state
    if (this.config.persistState) {
      this.loadPersistedState();
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ConnectionStateConfig>): ConnectionStateManager {
    if (!ConnectionStateManager.instance) {
      ConnectionStateManager.instance = new ConnectionStateManager(config);
    }
    return ConnectionStateManager.instance;
  }

  /**
   * Initialize default states
   */
  private initializeStates(): void {
    const providers: ProviderType[] = ['gmail', 'slack'];
    providers.forEach(provider => {
      this.states.set(provider, ConnectionState.IDLE);
    });
  }

  /**
   * Get current state for a provider
   */
  getState(provider: ProviderType): ConnectionState {
    return this.states.get(provider) || ConnectionState.IDLE;
  }

  /**
   * Get integration details for a provider
   */
  getIntegration(provider: ProviderType): McpIntegration | undefined {
    return this.integrations.get(provider);
  }

  /**
   * Set state for a provider
   */
  private setState(
    provider: ProviderType,
    state: ConnectionState,
    integration?: McpIntegration,
    error?: any
  ): void {
    const previousState = this.states.get(provider) || ConnectionState.IDLE;
    this.states.set(provider, state);

    if (integration) {
      this.integrations.set(provider, integration);
    }

    // Persist state if enabled
    if (this.config.persistState) {
      this.persistState();
    }

    // Emit state change event
    this.emitStateChange({
      provider,
      previousState,
      currentState: state,
      integration,
      error,
      timestamp: new Date(),
    });

    console.log(`[Connection State] ${provider}: ${previousState} → ${state}`);
  }

  /**
   * Handle connection initiation
   */
  async initiateConnection(provider: ProviderType): Promise<void> {
    const operationKey = `connect_${provider}`;

    // Check if already in progress
    if (this.pendingOperations.has(operationKey)) {
      console.log(`[Connection State] Connection already in progress for ${provider}`);
      return this.pendingOperations.get(operationKey);
    }

    // Create connection promise
    const connectionPromise = this.performConnection(provider);
    this.pendingOperations.set(operationKey, connectionPromise);

    try {
      await connectionPromise;
    } finally {
      this.pendingOperations.delete(operationKey);
    }
    return undefined;
  }

  /**
   * Perform actual connection
   */
  private async performConnection(provider: ProviderType): Promise<void> {
    try {
      this.setState(provider, ConnectionState.CONNECTING);

      // Store connecting provider for callback handler
      localStorage.setItem('mcp_connecting_provider', provider);

      // Call API to initiate OAuth
      const response = await mcpApiService.connectIntegration(provider);

      if (response.auth_url) {
        // Mark as pending (user needs to complete OAuth)
        this.setState(provider, ConnectionState.PENDING);

        // Store pending state with timeout
        this.startPendingTimeout(provider);

        console.log(`[Connection State] Redirecting to OAuth URL: ${response.auth_url}`);

        // Redirect to OAuth
        window.location.href = response.auth_url;
      } else if (response.status === 'already_connected') {
        // Already connected - mark as connected and refresh
        console.log(`[Connection State] ${provider} is already connected`);
        this.setState(provider, ConnectionState.CONNECTED);

        // Refresh integrations to get the latest status
        await this.refreshIntegrations();

        // Clean up
        localStorage.removeItem('mcp_connecting_provider');
      }
    } catch (error: any) {
      const mcpError = mcpErrorHandler.handleError(error, `Connect ${provider}`);
      this.setState(provider, ConnectionState.ERROR, undefined, mcpError);

      // Handle specific error types
      if (mcpError.type === McpErrorType.OAUTH_TOKEN_EXPIRED) {
        this.setState(provider, ConnectionState.EXPIRED);
      }

      throw new Error(mcpError.message);
    }
  }

  /**
   * Handle disconnection
   */
  async initiateDisconnection(provider: ProviderType): Promise<void> {
    const operationKey = `disconnect_${provider}`;

    // Check if already in progress
    if (this.pendingOperations.has(operationKey)) {
      console.log(`[Connection State] Disconnection already in progress for ${provider}`);
      return this.pendingOperations.get(operationKey);
    }

    // Create disconnection promise
    const disconnectionPromise = this.performDisconnection(provider);
    this.pendingOperations.set(operationKey, disconnectionPromise);

    try {
      await disconnectionPromise;
    } finally {
      this.pendingOperations.delete(operationKey);
    }
    return undefined;
  }

  /**
   * Perform actual disconnection
   */
  private async performDisconnection(provider: ProviderType): Promise<void> {
    try {
      this.setState(provider, ConnectionState.DISCONNECTING);

      // Call API to disconnect
      await mcpApiService.disconnectIntegration(provider);

      // Update state
      this.setState(provider, ConnectionState.DISCONNECTED);
      this.integrations.delete(provider);
    } catch (error: any) {
      const mcpError = mcpErrorHandler.handleError(error, `Disconnect ${provider}`);
      this.setState(provider, ConnectionState.ERROR, undefined, mcpError);
      throw new Error(mcpError.message);
    }
  }

  /**
   * Handle OAuth callback
   */
  handleOAuthCallback(
    provider: ProviderType,
    status: 'success' | 'error',
    error?: string
  ): void {
    // Clear pending timeout
    this.clearPendingTimeout(provider);

    if (status === 'success') {
      this.setState(provider, ConnectionState.CONNECTED);
      // Trigger refresh to get updated integration details
      this.refreshIntegrations();
    } else {
      const mcpError = mcpErrorHandler.handleError(
        { error: error || 'OAuth failed' },
        `OAuth callback for ${provider}`
      );
      this.setState(provider, ConnectionState.ERROR, undefined, mcpError);
    }
  }

  /**
   * Refresh integration status
   */
  async refreshIntegrations(): Promise<void> {
    try {
      const response = await mcpApiService.getConnectedIntegrations();
      const integrations = response.integrations || [];

      // Update states based on integration status
      const providers: ProviderType[] = ['gmail', 'slack'];

      providers.forEach(provider => {
        const integration = integrations.find(i => i.provider === provider);

        if (integration) {
          switch (integration.status) {
            case 'active':
              this.setState(provider, ConnectionState.CONNECTED, integration);
              break;
            case 'pending':
              this.setState(provider, ConnectionState.PENDING, integration);
              break;
            case 'expired':
              this.setState(provider, ConnectionState.EXPIRED, integration);
              break;
            case 'disconnected':
            default:
              this.setState(provider, ConnectionState.DISCONNECTED, integration);
              break;
          }
        } else {
          this.setState(provider, ConnectionState.DISCONNECTED);
        }
      });
    } catch (error: any) {
      console.error('[Connection State] Failed to refresh integrations:', error);

      // Don't throw, just log - this is a background operation
      // Retry if configured
      if (this.config.retryAttempts > 0) {
        this.scheduleRetry('refreshIntegrations');
      }
    }
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(() => {
      this.refreshIntegrations();
    }, this.config.refreshInterval);
  }

  /**
   * Stop auto-refresh timer
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Start pending state timeout
   */
  private startPendingTimeout(provider: ProviderType): void {
    const timeoutKey = `pending_${provider}`;

    // Clear existing timeout
    this.clearPendingTimeout(provider);

    // Set new timeout (5 minutes)
    const timeout = setTimeout(() => {
      const currentState = this.getState(provider);
      if (currentState === ConnectionState.PENDING) {
        console.log(`[Connection State] Pending timeout for ${provider}`);
        this.setState(provider, ConnectionState.ERROR, undefined, {
          type: McpErrorType.OAUTH_CANCELLED,
          message: 'OAuth timeout - user did not complete authentication',
        });
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Store timeout reference
    (this as any)[timeoutKey] = timeout;
  }

  /**
   * Clear pending state timeout
   */
  private clearPendingTimeout(provider: ProviderType): void {
    const timeoutKey = `pending_${provider}`;
    const timeout = (this as any)[timeoutKey];

    if (timeout) {
      clearTimeout(timeout);
      delete (this as any)[timeoutKey];
    }
  }

  /**
   * Schedule retry operation
   */
  private scheduleRetry(operation: string): void {
    const retryCount = this.retryCounters.get(operation) || 0;

    if (retryCount >= this.config.retryAttempts) {
      console.log(`[Connection State] Max retries reached for ${operation}`);
      this.retryCounters.delete(operation);
      return;
    }

    const delay = this.config.retryDelay * 2 ** retryCount; // Exponential backoff

    console.log(`[Connection State] Scheduling retry for ${operation} in ${delay}ms (attempt ${retryCount + 1})`);

    setTimeout(() => {
      this.retryCounters.set(operation, retryCount + 1);

      if (operation === 'refreshIntegrations') {
        this.refreshIntegrations();
      }
    }, delay);
  }

  /**
   * Listen to state changes
   */
  onStateChange(
    listener: (event: ConnectionStateEvent) => void
  ): () => void {
    const listenerId = Math.random().toString(36).substr(2, 9);
    this.listeners.set(listenerId, listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listenerId);
    };
  }

  /**
   * Emit state change event
   */
  private emitStateChange(event: ConnectionStateEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Connection State] Listener error:', error);
      }
    });
  }

  /**
   * Persist state to localStorage
   */
  private persistState(): void {
    if (!this.config.persistState) return;

    try {
      const stateData = {
        states: Array.from(this.states.entries()),
        integrations: Array.from(this.integrations.entries()),
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem('mcp_connection_state', JSON.stringify(stateData));
    } catch (error) {
      console.error('[Connection State] Failed to persist state:', error);
    }
  }

  /**
   * Load persisted state from localStorage
   */
  private loadPersistedState(): void {
    if (!this.config.persistState) return;

    try {
      const stored = localStorage.getItem('mcp_connection_state');
      if (!stored) return;

      const stateData = JSON.parse(stored);

      // Check if state is not too old (max 5 minutes)
      const timestamp = new Date(stateData.timestamp);
      const age = Date.now() - timestamp.getTime();

      if (age > 5 * 60 * 1000) {
        console.log('[Connection State] Persisted state too old, ignoring');
        localStorage.removeItem('mcp_connection_state');
        return;
      }

      // Restore states
      this.states = new Map(stateData.states);
      this.integrations = new Map(stateData.integrations);

      console.log('[Connection State] Loaded persisted state');
    } catch (error) {
      console.error('[Connection State] Failed to load persisted state:', error);
      localStorage.removeItem('mcp_connection_state');
    }
  }

  /**
   * Clear all states
   */
  clearAll(): void {
    this.states.clear();
    this.integrations.clear();
    this.pendingOperations.clear();
    this.retryCounters.clear();
    this.initializeStates();

    if (this.config.persistState) {
      localStorage.removeItem('mcp_connection_state');
    }
  }

  /**
   * Check if provider is in a loading state
   */
  isLoading(provider: ProviderType): boolean {
    const state = this.getState(provider);
    return state === ConnectionState.CONNECTING ||
           state === ConnectionState.DISCONNECTING ||
           state === ConnectionState.PENDING;
  }

  /**
   * Check if provider is connected
   */
  isConnected(provider: ProviderType): boolean {
    return this.getState(provider) === ConnectionState.CONNECTED;
  }

  /**
   * Check if provider has error
   */
  hasError(provider: ProviderType): boolean {
    const state = this.getState(provider);
    return state === ConnectionState.ERROR || state === ConnectionState.EXPIRED;
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.stopAutoRefresh();
    this.listeners.clear();
    this.pendingOperations.clear();
    this.clearAll();
  }
}

// Export singleton instance
export const connectionStateManager = ConnectionStateManager.getInstance();