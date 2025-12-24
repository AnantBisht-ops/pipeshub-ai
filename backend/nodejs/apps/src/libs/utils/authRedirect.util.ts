/**
 * Desktop OAuth Authentication Redirect Utilities
 *
 * Handles callback URL generation for desktop OAuth flow.
 * Desktop apps use custom protocol URLs (openanalyst://) for auth callbacks.
 *
 * Usage:
 *   - getSuccessCallbackUrl(AuthSource.DESKTOP, token) => 'openanalyst://auth-callback?token=...'
 *   - getErrorCallbackUrl(AuthSource.DESKTOP, error) => 'openanalyst://auth-error?error=...'
 */

import { AuthSource } from '../middlewares/sourceDetection.middleware';

/**
 * Configuration for auth callback URL generation
 */
export interface AuthCallbackConfig {
  /** Custom protocol for desktop app (e.g., 'openanalyst') */
  customProtocol: string;
  /** Frontend URL for web redirects */
  frontendUrl: string;
}

/**
 * Default configuration - uses environment variables with fallbacks
 *
 * Production: https://web.openanalyst.com
 * Development: http://localhost:3000
 */
const getDefaultConfig = (): AuthCallbackConfig => ({
  customProtocol: process.env.DESKTOP_CUSTOM_PROTOCOL || 'openanalyst',
  frontendUrl: process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000',
});

/**
 * Generate success callback URL based on auth source
 *
 * For desktop: Returns custom protocol URL (openanalyst://auth-callback?token=...)
 * For web: Returns empty string (frontend handles token storage directly)
 *
 * @param authSource - The authentication source (web or desktop)
 * @param token - The JWT access token to include in callback
 * @param config - Optional configuration override
 * @returns Callback URL string or empty string for web
 */
export const getSuccessCallbackUrl = (
  authSource: AuthSource,
  token: string,
  config?: Partial<AuthCallbackConfig>,
): string => {
  const mergedConfig = { ...getDefaultConfig(), ...config };

  if (authSource === AuthSource.DESKTOP) {
    return `${mergedConfig.customProtocol}://auth-callback?token=${encodeURIComponent(token)}`;
  }

  // For web, return empty string - frontend handles token storage
  // The API response contains the token directly
  return '';
};

/**
 * Generate success callback URL with both tokens for desktop
 *
 * Includes both access and refresh tokens in the callback URL.
 * Used when desktop needs both tokens immediately after auth.
 *
 * @param authSource - The authentication source
 * @param accessToken - The JWT access token
 * @param refreshToken - The JWT refresh token
 * @param config - Optional configuration override
 * @returns Callback URL string or empty string for web
 */
export const getSuccessCallbackUrlWithTokens = (
  authSource: AuthSource,
  accessToken: string,
  refreshToken: string,
  config?: Partial<AuthCallbackConfig>,
): string => {
  const { customProtocol } = { ...getDefaultConfig(), ...config };

  if (authSource === AuthSource.DESKTOP) {
    const params = new URLSearchParams({
      token: accessToken,
      refreshToken: refreshToken,
    });
    return `${customProtocol}://auth-callback?${params.toString()}`;
  }

  return '';
};

/**
 * Generate error callback URL based on auth source
 *
 * For desktop: Returns custom protocol error URL (openanalyst://auth-error?error=...)
 * For web: Returns frontend sign-in page with error query params
 *
 * @param authSource - The authentication source (web or desktop)
 * @param error - Error message to include
 * @param errorCode - Optional error code for programmatic handling
 * @param config - Optional configuration override
 * @returns Error callback URL string
 */
export const getErrorCallbackUrl = (
  authSource: AuthSource,
  error: string,
  errorCode?: string,
  config?: Partial<AuthCallbackConfig>,
): string => {
  const { customProtocol, frontendUrl } = { ...getDefaultConfig(), ...config };

  const encodedError = encodeURIComponent(error);
  const codeParam = errorCode ? `&code=${encodeURIComponent(errorCode)}` : '';

  if (authSource === AuthSource.DESKTOP) {
    return `${customProtocol}://auth-error?error=${encodedError}${codeParam}`;
  }

  return `${frontendUrl}/auth/sign-in?error=${encodedError}${codeParam}`;
};

/**
 * User data for desktop auth response
 */
export interface DesktopAuthUser {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  orgId: string;
}

/**
 * Complete desktop authentication response structure
 */
export interface DesktopAuthResponse {
  success: true;
  authSource: AuthSource.DESKTOP;
  accessToken: string;
  refreshToken: string;
  callbackUrl: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: DesktopAuthUser;
}

/**
 * Input user data for building desktop auth response
 */
export interface DesktopAuthUserInput {
  _id: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  orgId: string;
}

/**
 * Build complete desktop auth response
 *
 * Creates a complete response object for desktop authentication
 * including tokens, callback URL, and user data.
 *
 * @param tokens - Token data (accessToken, refreshToken, expiresIn)
 * @param user - User data object
 * @param config - Optional configuration override
 * @returns Complete desktop auth response object
 */
export const buildDesktopAuthResponse = (
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  },
  user: DesktopAuthUserInput,
  config?: Partial<AuthCallbackConfig>,
): DesktopAuthResponse => {
  return {
    success: true,
    authSource: AuthSource.DESKTOP,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    callbackUrl: getSuccessCallbackUrl(
      AuthSource.DESKTOP,
      tokens.accessToken,
      config,
    ),
    expiresIn: tokens.expiresIn,
    tokenType: 'Bearer',
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      orgId: user.orgId.toString(),
    },
  };
};

/**
 * Build error response for desktop authentication
 */
export interface DesktopAuthErrorResponse {
  success: false;
  authSource: AuthSource;
  error: string;
  errorCode?: string;
  callbackUrl: string;
}

/**
 * Build desktop auth error response
 *
 * @param authSource - The authentication source
 * @param error - Error message
 * @param errorCode - Optional error code
 * @param config - Optional configuration override
 * @returns Error response object
 */
export const buildDesktopAuthErrorResponse = (
  authSource: AuthSource,
  error: string,
  errorCode?: string,
  config?: Partial<AuthCallbackConfig>,
): DesktopAuthErrorResponse => {
  return {
    success: false,
    authSource,
    error,
    errorCode,
    callbackUrl: getErrorCallbackUrl(authSource, error, errorCode, config),
  };
};

/**
 * Generate logout callback URL for desktop
 *
 * @param authSource - The authentication source
 * @param config - Optional configuration override
 * @returns Logout callback URL
 */
export const getLogoutCallbackUrl = (
  authSource: AuthSource,
  config?: Partial<AuthCallbackConfig>,
): string => {
  const { customProtocol, frontendUrl } = { ...getDefaultConfig(), ...config };

  if (authSource === AuthSource.DESKTOP) {
    return `${customProtocol}://logout-complete`;
  }

  return `${frontendUrl}/auth/sign-in`;
};

/**
 * Generate token refresh callback URL for desktop
 *
 * @param authSource - The authentication source
 * @param newAccessToken - The new access token
 * @param config - Optional configuration override
 * @returns Token refresh callback URL
 */
export const getTokenRefreshCallbackUrl = (
  authSource: AuthSource,
  newAccessToken: string,
  config?: Partial<AuthCallbackConfig>,
): string => {
  const { customProtocol } = { ...getDefaultConfig(), ...config };

  if (authSource === AuthSource.DESKTOP) {
    return `${customProtocol}://token-refreshed?token=${encodeURIComponent(newAccessToken)}`;
  }

  // Web doesn't need callback URL for token refresh
  return '';
};
