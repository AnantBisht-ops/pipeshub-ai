/**
 * Source Detection Middleware
 *
 * Detects if authentication request originates from desktop app (OpenAnalyst)
 * vs web browser. This is critical for the desktop OAuth flow.
 *
 * Usage:
 *   - Desktop app opens browser with: ?source=desktop
 *   - Middleware sets req.authSource and req.isDesktopAuth
 *   - Downstream controllers use this to determine token expiry and callback URL
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../services/logger.service';
import { ForbiddenError } from '../errors/http.errors';

/**
 * Authentication Source Types
 */
export enum AuthSource {
  WEB = 'web',
  DESKTOP = 'desktop',
}

/**
 * Valid source values for validation
 */
const VALID_AUTH_SOURCES: string[] = [AuthSource.WEB, AuthSource.DESKTOP];

/**
 * Extended Request interface with auth source properties
 */
export interface SourceAwareRequest extends Request {
  authSource?: AuthSource;
  isDesktopAuth?: boolean;
}

/**
 * Source Detection Middleware
 *
 * Detects authentication source from:
 * 1. Query parameter: ?source=desktop
 * 2. Request body: { source: 'desktop' }
 * 3. Custom header: x-auth-source: desktop
 *
 * Sets:
 * - req.authSource: AuthSource.WEB | AuthSource.DESKTOP
 * - req.isDesktopAuth: boolean (true if desktop)
 *
 * @example
 * // In routes file:
 * router.post('/initAuth', detectAuthSource, controller.initAuth);
 *
 * // In controller:
 * if (req.isDesktopAuth) {
 *   // Generate desktop-specific token
 * }
 */
export const detectAuthSource = (
  req: SourceAwareRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const logger = Logger.getInstance();

  try {
    // Get source from multiple possible locations (priority order)
    const sourceFromQuery = req.query.source as string | undefined;
    const sourceFromBody = req.body?.source as string | undefined;
    const sourceFromHeader = req.headers['x-auth-source'] as string | undefined;

    // Use first available source (query > body > header)
    const sourceParam = sourceFromQuery || sourceFromBody || sourceFromHeader;

    // Normalize and validate source
    let detectedSource: AuthSource = AuthSource.WEB; // Default to web
    let isDesktopAuth = false;

    if (sourceParam) {
      const normalizedSource = String(sourceParam).toLowerCase().trim();

      if (VALID_AUTH_SOURCES.includes(normalizedSource)) {
        if (normalizedSource === AuthSource.DESKTOP) {
          detectedSource = AuthSource.DESKTOP;
          isDesktopAuth = true;

          logger.info('[SourceDetection] Desktop authentication detected', {
            ip: req.ip,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            sourceOrigin: sourceFromQuery ? 'query' : sourceFromBody ? 'body' : 'header',
          });
        } else {
          logger.debug('[SourceDetection] Web authentication detected', {
            ip: req.ip,
            url: req.originalUrl,
          });
        }
      } else {
        // Invalid source value - log warning but default to web
        logger.warn('[SourceDetection] Invalid source parameter received', {
          source: sourceParam,
          ip: req.ip,
          url: req.originalUrl,
          validSources: VALID_AUTH_SOURCES,
        });
      }
    } else {
      logger.debug('[SourceDetection] No source parameter - defaulting to web', {
        url: req.originalUrl,
      });
    }

    // Set auth source on request object
    req.authSource = detectedSource;
    req.isDesktopAuth = isDesktopAuth;

    // Also set as header for downstream services/logging
    req.headers['x-auth-source'] = detectedSource;

    next();
  } catch (error) {
    logger.error('[SourceDetection] Error detecting auth source', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      url: req.originalUrl,
    });

    // Default to web on error - don't block authentication
    req.authSource = AuthSource.WEB;
    req.isDesktopAuth = false;
    req.headers['x-auth-source'] = AuthSource.WEB;

    next();
  }
};

/**
 * Middleware to require desktop authentication
 *
 * Use this on routes that should ONLY be accessible from desktop apps.
 * Returns 403 Forbidden if accessed from web.
 *
 * @example
 * router.post('/desktop/refresh', requireDesktopAuth, controller.refreshDesktopToken);
 */
export const requireDesktopAuth = (
  req: SourceAwareRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const logger = Logger.getInstance();

  try {
    // Check if source detection middleware was applied
    if (req.authSource === undefined) {
      logger.error('[RequireDesktopAuth] Source detection middleware not applied', {
        url: req.originalUrl,
      });
      throw new ForbiddenError(
        'Internal server error: Source detection not configured',
      );
    }

    // Check if request is from desktop
    if (!req.isDesktopAuth || req.authSource !== AuthSource.DESKTOP) {
      logger.warn('[RequireDesktopAuth] Non-desktop access attempt blocked', {
        authSource: req.authSource,
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
      });

      throw new ForbiddenError(
        'This endpoint is only available for desktop applications',
      );
    }

    logger.debug('[RequireDesktopAuth] Desktop access verified', {
      url: req.originalUrl,
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Get authentication callback URL based on source
 *
 * For desktop: Returns custom protocol URL (openanalyst://auth-callback?token=...)
 * For web: Returns empty string (frontend handles redirect)
 *
 * @param authSource - The authentication source (web or desktop)
 * @param token - The JWT token to include in callback
 * @returns Callback URL string
 */
export const getAuthCallbackUrl = (
  authSource: AuthSource,
  token: string,
): string => {
  if (authSource === AuthSource.DESKTOP) {
    const customProtocol = process.env.DESKTOP_CUSTOM_PROTOCOL || 'openanalyst';
    return `${customProtocol}://auth-callback?token=${encodeURIComponent(token)}`;
  }

  // Web doesn't need callback URL - frontend handles token storage
  return '';
};

/**
 * Get authentication error callback URL based on source
 *
 * For desktop: Returns custom protocol error URL
 * For web: Returns web error page URL
 *
 * @param authSource - The authentication source
 * @param error - Error message
 * @param errorCode - Optional error code
 * @returns Error callback URL string
 */
export const getAuthErrorCallbackUrl = (
  authSource: AuthSource,
  error: string,
  errorCode?: string,
): string => {
  const encodedError = encodeURIComponent(error);
  const codeParam = errorCode ? `&code=${encodeURIComponent(errorCode)}` : '';

  if (authSource === AuthSource.DESKTOP) {
    const customProtocol = process.env.DESKTOP_CUSTOM_PROTOCOL || 'openanalyst';
    return `${customProtocol}://auth-error?error=${encodedError}${codeParam}`;
  }

  // Production: https://web.openanalyst.com
  // Development: http://localhost:3000
  const frontendUrl = process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl}/auth/sign-in?error=${encodedError}${codeParam}`;
};

/**
 * Check if a request is from a desktop app
 *
 * Utility function for use in controllers
 *
 * @param req - The request object (must have source detection applied)
 * @returns boolean indicating if request is from desktop
 */
export const isDesktopRequest = (req: SourceAwareRequest): boolean => {
  return req.isDesktopAuth === true && req.authSource === AuthSource.DESKTOP;
};

/**
 * Get the auth source from a request
 *
 * Utility function with fallback to WEB
 *
 * @param req - The request object
 * @returns AuthSource enum value
 */
export const getAuthSource = (req: SourceAwareRequest): AuthSource => {
  return req.authSource || AuthSource.WEB;
};
