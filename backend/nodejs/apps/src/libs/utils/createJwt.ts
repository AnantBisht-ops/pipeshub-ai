import jwt from 'jsonwebtoken';
import { TokenScopes } from '../enums/token-scopes.enum';
import { AuthSource } from '../middlewares/sourceDetection.middleware';

/**
 * Desktop Token Payload Interface
 * Extended payload for desktop app authentication
 */
export interface DesktopTokenPayload {
  userId: string;
  orgId: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  accountType: string;
  authSource: AuthSource.DESKTOP;
}

/**
 * Desktop Token Response Interface
 * Complete response structure for desktop authentication
 */
export interface DesktopTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  authSource: AuthSource.DESKTOP;
}

export const mailJwtGenerator = (email: string, scopedJwtSecret: string) => {
  return jwt.sign(
    { email: email, scopes: [TokenScopes.SEND_MAIL] },
    scopedJwtSecret,
    {
      expiresIn: '1h',
    },
  );
};

export const jwtGeneratorForForgotPasswordLink = (
  userEmail: string,
  userId: string,
  orgId: string,
  scopedJwtSecret: string,
) => {
  // Token for password reset
  const passwordResetToken = jwt.sign(
    {
      userEmail,
      userId,
      orgId,
      scopes: [TokenScopes.PASSWORD_RESET],
    },
    scopedJwtSecret,
    { expiresIn: '1h' },
  );
  const mailAuthToken = jwt.sign(
    {
      userEmail,
      userId,
      orgId,
      scopes: [TokenScopes.SEND_MAIL],
    },
    scopedJwtSecret,
    { expiresIn: '1h' },
  );

  return { passwordResetToken, mailAuthToken };
};

export const jwtGeneratorForNewAccountPassword = (
  userEmail: string,
  userId: string,
  orgId: string,
  scopedJwtSecret: string,
) => {
  // Token for password reset
  const passwordResetToken = jwt.sign(
    {
      userEmail,
      userId,
      orgId,
      scopes: [TokenScopes.PASSWORD_RESET],
    },
    scopedJwtSecret,
    { expiresIn: '48h' },
  );
  const mailAuthToken = jwt.sign(
    {
      userEmail,
      userId,
      orgId,
      scopes: [TokenScopes.SEND_MAIL],
    },
    scopedJwtSecret,
    { expiresIn: '1h' },
  );

  return { passwordResetToken, mailAuthToken };
};

export const refreshTokenJwtGenerator = (
  userId: string,
  orgId: string,
  scopedJwtSecret: string,
) => {
  return jwt.sign(
    { userId: userId, orgId: orgId, scopes: [TokenScopes.TOKEN_REFRESH] },
    scopedJwtSecret,
    { expiresIn: '720h' },
  );
};

export const iamJwtGenerator = (email: string, scopedJwtSecret: string) => {
  return jwt.sign(
    { email: email, scopes: [TokenScopes.USER_LOOKUP] },
    scopedJwtSecret,
    { expiresIn: '1h' },
  );
};

export const slackJwtGenerator = (email: string, scopedJwtSecret: string) => {
  return jwt.sign(
    { email: email, scopes: [TokenScopes.CONVERSATION_CREATE] },
    scopedJwtSecret,
    { expiresIn: '1h' },
  );
};

export const iamUserLookupJwtGenerator = (
  userId: string,
  orgId: string,
  scopedJwtSecret: string,
) => {
  return jwt.sign(
    { userId, orgId, scopes: [TokenScopes.USER_LOOKUP] },
    scopedJwtSecret,
    { expiresIn: '1h' },
  );
};

export const authJwtGenerator = (
  scopedJwtSecret: string,
  email?: string | null,
  userId?: string | null,
  orgId?: string | null,
  fullName?: string | null,
  accountType?: string | null,
) => {
  return jwt.sign(
    { userId, orgId, email, fullName, accountType },
    scopedJwtSecret,
    {
      expiresIn: '24h',
    },
  );
};

export const fetchConfigJwtGenerator = (
  userId: string,
  orgId: string,
  scopedJwtSecret: string,
) => {
  return jwt.sign(
    { userId, orgId, scopes: [TokenScopes.FETCH_CONFIG] },
    scopedJwtSecret,
    { expiresIn: '1h' },
  );
};

export const scopedStorageServiceJwtGenerator = (
  orgId: string,
  scopedJwtSecret: string,
) => {
  return jwt.sign(
    { orgId, scopes: [TokenScopes.STORAGE_TOKEN] },
    scopedJwtSecret,
    {
      expiresIn: '1h',
    },
  );
};

/**
 * Generate desktop access token with 30-day expiry
 *
 * Desktop tokens have extended expiry for better UX in desktop applications.
 * They include the authSource claim to identify the token origin.
 *
 * @param scopedJwtSecret - JWT secret key
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param email - User email
 * @param fullName - User full name
 * @param firstName - User first name
 * @param lastName - User last name
 * @param accountType - Account type (individual, business, etc.)
 * @returns JWT token string
 */
export const desktopAuthJwtGenerator = (
  scopedJwtSecret: string,
  userId: string,
  orgId: string,
  email: string,
  fullName: string,
  firstName: string,
  lastName: string,
  accountType: string,
): string => {
  const payload: DesktopTokenPayload = {
    userId,
    orgId,
    email,
    fullName,
    firstName: firstName || '',
    lastName: lastName || '',
    accountType: accountType || 'individual',
    authSource: AuthSource.DESKTOP,
  };

  // 30 days expiry for desktop tokens
  // Using '720h' (30 days) as the default - same format as existing refreshTokenJwtGenerator
  return jwt.sign(payload, scopedJwtSecret, {
    expiresIn: '720h',
    issuer: 'pipeshub-desktop',
  });
};

/**
 * Generate desktop refresh token with 90-day expiry
 *
 * Desktop refresh tokens have longer expiry than web tokens
 * to reduce re-authentication frequency for desktop users.
 *
 * @param scopedJwtSecret - JWT secret key
 * @param userId - User ID
 * @param orgId - Organization ID
 * @returns JWT refresh token string
 */
export const desktopRefreshTokenJwtGenerator = (
  scopedJwtSecret: string,
  userId: string,
  orgId: string,
): string => {
  const payload = {
    userId,
    orgId,
    scopes: [TokenScopes.TOKEN_REFRESH],
    authSource: AuthSource.DESKTOP,
  };

  // 90 days expiry for desktop refresh tokens
  // Using '2160h' (90 days) as the default - same format as existing JWT generators
  return jwt.sign(payload, scopedJwtSecret, {
    expiresIn: '2160h',
    issuer: 'pipeshub-desktop',
  });
};

/**
 * User data structure for desktop token generation
 */
export interface DesktopUserData {
  _id: string;
  orgId: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  accountType?: string;
}

/**
 * Generate complete desktop token response
 *
 * Creates both access and refresh tokens for desktop authentication.
 * Returns a complete response object ready to be sent to the client.
 *
 * @param jwtSecret - Main JWT secret for access token
 * @param scopedJwtSecret - Scoped JWT secret for refresh token
 * @param user - User data object
 * @returns Complete desktop token response
 */
export const generateDesktopTokens = (
  jwtSecret: string,
  scopedJwtSecret: string,
  user: DesktopUserData,
): DesktopTokenResponse => {
  const accessToken = desktopAuthJwtGenerator(
    jwtSecret,
    user._id.toString(),
    user.orgId.toString(),
    user.email,
    user.fullName || '',
    user.firstName || '',
    user.lastName || '',
    user.accountType || 'individual',
  );

  const refreshToken = desktopRefreshTokenJwtGenerator(
    scopedJwtSecret,
    user._id.toString(),
    user.orgId.toString(),
  );

  // 30 days in seconds
  const expiresIn = 30 * 24 * 60 * 60;

  return {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: 'Bearer',
    authSource: AuthSource.DESKTOP,
  };
};
