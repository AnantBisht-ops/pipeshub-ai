/**
 * Desktop Authentication Request/Response Types
 */

// ============= Request Types =============

export interface DesktopSignupRequest {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;  // Required - user chooses org name
  accountType?: 'individual' | 'business';  // Optional, defaults to 'individual'
}

export interface DesktopSigninRequest {
  email: string;
  password: string;
}

export interface DesktopRefreshRequest {
  refreshToken: string;
}

// ============= Response Types =============

export interface UserData {
  _id: string;
  email: string;
  fullName: string;
  slug: string;
}

export interface OrganizationData {
  _id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member';
  accountType: 'individual' | 'business';
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;  // In seconds (e.g., 3600 for 1 hour)
}

export interface DesktopAuthResponse {
  success: true;
  isNewUser: boolean;  // true if user just created, false if existing user
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: UserData;
    organizations: OrganizationData[];
    currentOrgId: string;
  };
}

export interface DesktopRefreshResponse {
  success: true;
  data: {
    accessToken: string;
    expiresIn: number;
  };
}

// ============= Error Response Types =============

export interface DesktopAuthError {
  success: false;
  error: string;  // Error code (e.g., "INVALID_CREDENTIALS", "EMAIL_EXISTS")
  message: string;  // User-friendly message
}

// ============= Validation Types =============

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}
