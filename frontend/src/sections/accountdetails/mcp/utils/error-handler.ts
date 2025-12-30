/**
 * MCP Error Handler Utility
 *
 * Comprehensive error handling for MCP integration
 * Handles authentication, OAuth, network, and state management errors
 */

import { AxiosError } from 'axios';

// Error types for classification
export enum McpErrorType {
  // Authentication Errors
  AUTH_NO_TOKEN = 'AUTH_NO_TOKEN',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',

  // OAuth Errors
  OAUTH_CANCELLED = 'OAUTH_CANCELLED',
  OAUTH_PERMISSION_DENIED = 'OAUTH_PERMISSION_DENIED',
  OAUTH_INVALID_STATE = 'OAUTH_INVALID_STATE',
  OAUTH_TOKEN_EXPIRED = 'OAUTH_TOKEN_EXPIRED',
  OAUTH_REDIRECT_MISMATCH = 'OAUTH_REDIRECT_MISMATCH',

  // Connection Errors
  CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
  CONNECTION_ALREADY_EXISTS = 'CONNECTION_ALREADY_EXISTS',
  CONNECTION_PENDING = 'CONNECTION_PENDING',

  // Network Errors
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',

  // General Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// Error details interface
export interface McpError {
  type: McpErrorType;
  message: string;
  userMessage: string;
  statusCode?: number;
  details?: any;
  recoverable: boolean;
  retryable: boolean;
  action?: McpErrorAction;
}

// Error recovery actions
export interface McpErrorAction {
  type: 'redirect' | 'retry' | 'refresh' | 'reconnect' | 'notify';
  target?: string;
  delay?: number;
}

/**
 * Main error handler class
 */
export class McpErrorHandler {
  private static instance: McpErrorHandler;

  private retryAttempts: Map<string, number> = new Map();

  private maxRetries = 3;

  private baseRetryDelay = 1000;
 // 1 second

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): McpErrorHandler {
    if (!McpErrorHandler.instance) {
      McpErrorHandler.instance = new McpErrorHandler();
    }
    return McpErrorHandler.instance;
  }

  /**
   * Process and classify errors
   */
  handleError(error: any, context?: string): McpError {
    console.error(`[MCP Error Handler] ${context || 'Unknown context'}:`, error);

    // Handle Axios errors
    if (this.isAxiosError(error)) {
      return this.handleAxiosError(error);
    }

    // Handle OAuth callback errors
    if (this.isOAuthError(error)) {
      return this.handleOAuthError(error);
    }

    // Handle generic errors
    return this.handleGenericError(error);
  }

  /**
   * Handle Axios HTTP errors
   */
  private handleAxiosError(error: AxiosError): McpError {
    const status = error.response?.status;
    const data = error.response?.data as any;
    const message = data?.detail || data?.message || error.message;

    // Authentication errors
    if (status === 401) {
      if (message?.includes('expired')) {
        return this.createError(
          McpErrorType.AUTH_TOKEN_EXPIRED,
          'Authentication token expired',
          'Your session has expired. Please log in again.',
          status,
          { action: { type: 'redirect', target: '/login' } }
        );
      }
      return this.createError(
        McpErrorType.AUTH_UNAUTHORIZED,
        'Unauthorized access',
        'Please log in to continue.',
        status,
        { action: { type: 'redirect', target: '/login' } }
      );
    }

    if (status === 403) {
      return this.createError(
        McpErrorType.AUTH_FORBIDDEN,
        'Access forbidden',
        'You do not have permission to perform this action.',
        status,
        { recoverable: false }
      );
    }

    // OAuth specific errors
    if (status === 400 && message?.includes('OAuth')) {
      if (message.includes('expired')) {
        return this.createError(
          McpErrorType.OAUTH_TOKEN_EXPIRED,
          'OAuth token expired',
          'Your connection has expired. Please reconnect.',
          status,
          { action: { type: 'reconnect' } }
        );
      }
      return this.createError(
        McpErrorType.OAUTH_INVALID_STATE,
        'Invalid OAuth state',
        'Authentication failed. Please try again.',
        status
      );
    }

    // Not found errors
    if (status === 404) {
      if (message?.includes('integration') || message?.includes('connection')) {
        return this.createError(
          McpErrorType.CONNECTION_NOT_FOUND,
          'Connection not found',
          'This integration is not connected.',
          status
        );
      }
    }

    // Rate limiting
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      return this.createError(
        McpErrorType.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded',
        'Too many requests. Please wait a moment.',
        status,
        {
          retryable: true,
          action: { type: 'retry', delay: retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000 }
        }
      );
    }

    // Server errors
    if (status && status >= 500) {
      return this.createError(
        McpErrorType.NETWORK_SERVER_ERROR,
        `Server error: ${status}`,
        'Service temporarily unavailable. Please try again later.',
        status,
        { retryable: true }
      );
    }

    // Network errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return this.createError(
        McpErrorType.NETWORK_TIMEOUT,
        'Request timeout',
        'The request took too long. Please try again.',
        undefined,
        { retryable: true }
      );
    }

    if (error.code === 'ERR_NETWORK' || !navigator.onLine) {
      return this.createError(
        McpErrorType.NETWORK_OFFLINE,
        'Network offline',
        'Please check your internet connection.',
        undefined,
        { retryable: true }
      );
    }

    // Default error
    return this.createError(
      McpErrorType.UNKNOWN_ERROR,
      message || 'Unknown error occurred',
      'An unexpected error occurred. Please try again.',
      status
    );
  }

  /**
   * Handle OAuth-specific errors
   */
  private handleOAuthError(error: any): McpError {
    const errorType = error.error || error.type;
    const message = error.message || error.error_description;

    switch (errorType) {
      case 'access_denied':
      case 'cancelled':
        return this.createError(
          McpErrorType.OAUTH_CANCELLED,
          'OAuth cancelled by user',
          'Connection cancelled. You can try again anytime.',
          undefined,
          { recoverable: true }
        );

      case 'permission_denied':
        return this.createError(
          McpErrorType.OAUTH_PERMISSION_DENIED,
          'OAuth permission denied',
          'Permission denied. Please grant the necessary permissions.',
          undefined,
          { recoverable: true }
        );

      case 'invalid_state':
        return this.createError(
          McpErrorType.OAUTH_INVALID_STATE,
          'Invalid OAuth state',
          'Authentication state mismatch. Please try again.',
          undefined,
          { recoverable: true }
        );

      case 'redirect_uri_mismatch':
        return this.createError(
          McpErrorType.OAUTH_REDIRECT_MISMATCH,
          'OAuth redirect URI mismatch',
          'Configuration error. Please contact support.',
          undefined,
          { recoverable: false }
        );

      default:
        return this.createError(
          McpErrorType.UNKNOWN_ERROR,
          message || 'OAuth error',
          'Authentication failed. Please try again.',
          undefined,
          { recoverable: true }
        );
    }
  }

  /**
   * Handle generic errors
   */
  private handleGenericError(error: any): McpError {
    const message = error?.message || 'Unknown error';
    const userMessage = error?.userMessage || 'An unexpected error occurred.';

    return this.createError(
      McpErrorType.UNKNOWN_ERROR,
      message,
      userMessage,
      undefined,
      { recoverable: true }
    );
  }

  /**
   * Create standardized error object
   */
  // eslint-disable-next-line class-methods-use-this
  private createError(
    type: McpErrorType,
    message: string,
    userMessage: string,
    statusCode?: number,
    options?: Partial<McpError>
  ): McpError {
    return {
      type,
      message,
      userMessage,
      statusCode,
      recoverable: true,
      retryable: false,
      ...options,
    };
  }

  /**
   * Check if error is Axios error
   */
  // eslint-disable-next-line class-methods-use-this
  private isAxiosError(error: any): error is AxiosError {
    return error?.isAxiosError === true;
  }

  /**
   * Check if error is OAuth error
   */
  // eslint-disable-next-line class-methods-use-this
  private isOAuthError(error: any): boolean {
    return error?.error || error?.error_description ||
           (typeof error === 'object' && ('access_denied' in error || 'permission_denied' in error));
  }

  /**
   * Execute error recovery action
   */
  async executeRecovery(error: McpError): Promise<void> {
    if (!error.action) return;

    switch (error.action.type) {
      case 'redirect':
        if (error.action.target) {
          window.location.href = error.action.target;
        }
        break;

      case 'retry':
        if (error.action.delay) {
          await this.delay(error.action.delay);
        }
        break;

      case 'refresh':
        window.location.reload();
        break;

      case 'reconnect': {
        // Navigate to MCP settings for reconnection
        const accountType = localStorage.getItem('user_account_type');
        const path = accountType === 'business'
          ? '/account/company-settings/settings/mcp'
          : '/account/individual/settings/mcp';
        window.location.href = path;
        break;
      }

      case 'notify':
        // Notification handled by UI components
        break;

      default:
        // No action needed
        break;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    key: string,
    onRetry?: (attempt: number) => void
  ): Promise<T> {
    const attempts = this.retryAttempts.get(key) || 0;

    try {
      const result = await operation();
      this.retryAttempts.delete(key); // Clear on success
      return result;
    } catch (error) {
      const mcpError = this.handleError(error, `Retry operation: ${key}`);

      if (!mcpError.retryable || attempts >= this.maxRetries) {
        this.retryAttempts.delete(key);
        throw new Error(mcpError.message);
      }

      const nextAttempt = attempts + 1;
      this.retryAttempts.set(key, nextAttempt);

      // Exponential backoff
      const delay = this.baseRetryDelay * 2 ** attempts;

      if (onRetry) {
        onRetry(nextAttempt);
      }

      console.log(`[MCP Error Handler] Retrying ${key}, attempt ${nextAttempt} after ${delay}ms`);
      await this.delay(delay);

      return this.retryWithBackoff(operation, key, onRetry);
    }
  }

  /**
   * Utility delay function
   */
  // eslint-disable-next-line class-methods-use-this
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear retry attempts for a specific key
   */
  clearRetryAttempts(key?: string): void {
    if (key) {
      this.retryAttempts.delete(key);
    } else {
      this.retryAttempts.clear();
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: any): string {
    const mcpError = this.handleError(error);
    return mcpError.userMessage;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error: any): boolean {
    const mcpError = this.handleError(error);
    return mcpError.recoverable;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: any): boolean {
    const mcpError = this.handleError(error);
    return mcpError.retryable;
  }
}

// Export singleton instance
export const mcpErrorHandler = McpErrorHandler.getInstance();