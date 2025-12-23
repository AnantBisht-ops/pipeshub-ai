/**
 * Desktop Integration Utilities for PipesHub
 *
 * Based on LibreChat Phase 3 implementation
 * Provides utilities for detecting desktop authentication requests
 * and managing the desktop app callback flow
 */

// Authentication source constants
export const AUTH_SOURCES = {
  WEB: 'web',
  EXTENSION: 'extension', // Desktop/Extension users
  UNKNOWN: 'unknown',
} as const;

export type AuthSource = typeof AUTH_SOURCES[keyof typeof AUTH_SOURCES];

// Extension authentication state
export interface ExtensionAuthState {
  isExtension: boolean;
  source: AuthSource;
  detectionMethod: 'url' | 'default';
}

// Extension message types
export interface ExtensionMessage {
  type: 'auth-success' | 'auth-error' | 'auth-cancel';
  token?: string;
  userId?: string;
  error?: string;
}

/**
 * DesktopDetector Class
 * Detects if authentication request is coming from desktop app
 */
export class DesktopDetector {
  /**
   * Detect desktop authentication from URL parameters
   *
   * @param searchParams - URL search parameters
   * @param userAgent - Optional user agent string for fallback detection
   * @returns ExtensionAuthState with detection results
   */
  static detectDesktopAuth(
    searchParams: URLSearchParams,
    userAgent?: string
  ): ExtensionAuthState {
    // Primary detection: Check URL parameter
    const sourceParam = searchParams.get('source');
    const isExtensionSource = sourceParam === AUTH_SOURCES.EXTENSION;

    return {
      isExtension: isExtensionSource,
      source: (sourceParam as AuthSource) || AUTH_SOURCES.WEB,
      detectionMethod: isExtensionSource ? 'url' : 'default',
    };
  }

  /**
   * Check if current context is desktop authentication
   */
  static isDesktopAuth(searchParams: URLSearchParams): boolean {
    return searchParams.get('source') === AUTH_SOURCES.EXTENSION;
  }

  /**
   * Get source parameter from URL
   */
  static getSource(searchParams: URLSearchParams): AuthSource {
    const source = searchParams.get('source');
    return (source as AuthSource) || AUTH_SOURCES.WEB;
  }
}

/**
 * CallbackGenerator Class
 * Generates desktop app callback URLs using custom protocol
 */
export class CallbackGenerator {
  /**
   * Generate desktop callback URL with token
   *
   * @param token - JWT authentication token
   * @param userId - Optional user ID
   * @returns Desktop protocol callback URL
   */
  static generateDesktopCallback(token: string, userId?: string): string {
    const params = new URLSearchParams({
      token: token,
    });

    if (userId) {
      params.append('userId', userId);
    }

    return `openanalyst://auth/callback?${params.toString()}`;
  }

  /**
   * Generate error callback URL
   *
   * @param error - Error message
   * @returns Desktop protocol error URL
   */
  static generateErrorCallback(error: string): string {
    return `openanalyst://auth/error?error=${encodeURIComponent(error)}`;
  }

  /**
   * Test if protocol handler is registered
   */
  static testProtocolHandler(): Promise<boolean> {
    return new Promise((resolve) => {
      const testUrl = 'openanalyst://test';

      try {
        window.location.href = testUrl;
        // If no error thrown, assume handler exists
        resolve(true);
      } catch (error) {
        resolve(false);
      }
    });
  }
}

/**
 * MessageHandler Class
 * Handles communication with desktop app
 */
export class MessageHandler {
  /**
   * Post message to desktop extension
   *
   * @param message - Message to send to extension
   * @returns Success status
   */
  static postToExtension(message: ExtensionMessage): boolean {
    try {
      // Protocol URL redirect for auth success
      if (message.type === 'auth-success' && message.token) {
        const callbackUrl = CallbackGenerator.generateDesktopCallback(
          message.token,
          message.userId
        );
        window.location.href = callbackUrl;
        return true;
      }

      // Protocol URL redirect for errors
      if (message.type === 'auth-error' && message.error) {
        const errorUrl = CallbackGenerator.generateErrorCallback(message.error);
        window.location.href = errorUrl;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to post message to extension:', error);
      return false;
    }
  }

  /**
   * Send auth success to desktop
   */
  static sendAuthSuccess(token: string, userId?: string): boolean {
    return this.postToExtension({
      type: 'auth-success',
      token,
      userId,
    });
  }

  /**
   * Send auth error to desktop
   */
  static sendAuthError(error: string): boolean {
    return this.postToExtension({
      type: 'auth-error',
      error,
    });
  }
}

/**
 * Utility Functions
 */

/**
 * Preserve source parameter in URL
 *
 * @param url - Base URL
 * @param source - Authentication source
 * @returns URL with source parameter
 */
export function preserveSourceInUrl(url: string, source: AuthSource): string {
  if (source === AUTH_SOURCES.WEB) {
    return url; // Don't add source for web (default)
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}source=${source}`;
}

/**
 * Get current auth source from URL
 */
export function getCurrentAuthSource(): AuthSource {
  const params = new URLSearchParams(window.location.search);
  return DesktopDetector.getSource(params);
}

/**
 * Check if currently in desktop authentication mode
 */
export function isDesktopAuthMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return DesktopDetector.isDesktopAuth(params);
}

// Export all utilities as a namespace
export const DesktopIntegration = {
  DesktopDetector,
  CallbackGenerator,
  MessageHandler,
  AUTH_SOURCES,
  preserveSourceInUrl,
  getCurrentAuthSource,
  isDesktopAuthMode,
};

export default DesktopIntegration;
