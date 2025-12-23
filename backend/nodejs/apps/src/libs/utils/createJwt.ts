import jwt from 'jsonwebtoken';
import { TokenScopes } from '../enums/token-scopes.enum';

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
 * Generates a JWT token for desktop callback containing the full auth response
 * This token is used in the OAuth-style flow: openanalyst://auth/callback?token=JWT
 * Desktop app will decode this token to extract accessToken, refreshToken, user data, etc.
 */
export const desktopCallbackJwtGenerator = (
  payload: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: any;
    organizations: any[];
    currentOrgId: string;
    isNewUser: boolean;
  },
  jwtSecret: string,
) => {
  return jwt.sign(
    {
      ...payload,
      scopes: [TokenScopes.USER_LOOKUP], // Reusing existing scope for simplicity
    },
    jwtSecret,
    {
      expiresIn: '5m', // Short-lived since it's meant for immediate desktop app consumption
    },
  );
};
