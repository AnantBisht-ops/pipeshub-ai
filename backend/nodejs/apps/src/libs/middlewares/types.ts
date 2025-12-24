import { Request } from 'express';
import { AuthSource } from './sourceDetection.middleware';

export interface AuthenticatedUserRequest extends Request {
  user?: Record<string, any>;
}

export interface AuthenticatedServiceRequest extends Request {
  tokenPayload?: Record<string, any>;
}

/**
 * Request with auth source detection
 * Used by detectAuthSource middleware
 */
export interface SourceAwareRequest extends Request {
  authSource?: AuthSource;
  isDesktopAuth?: boolean;
}

/**
 * Combined request type for authenticated desktop requests
 */
export interface AuthenticatedDesktopRequest extends AuthenticatedUserRequest {
  authSource?: AuthSource;
  isDesktopAuth?: boolean;
}
