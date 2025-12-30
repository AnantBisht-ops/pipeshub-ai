# PIPESHUB DESKTOP OAUTH IMPLEMENTATION PLAN
## Full Integration with Single Database for OpenAnalyst

**Version:** 1.0.0
**Date:** 2025-12-23
**Status:** Implementation Ready

---

## TABLE OF CONTENTS

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Current System Analysis](#3-current-system-analysis)
4. [Implementation Phases](#4-implementation-phases)
5. [Phase 1: Source Detection Middleware](#phase-1-source-detection-middleware)
6. [Phase 2: Desktop JWT Service](#phase-2-desktop-jwt-service)
7. [Phase 3: Database Schema Extensions](#phase-3-database-schema-extensions)
8. [Phase 4: Desktop Auth Controller](#phase-4-desktop-auth-controller)
9. [Phase 5: OpenAnalyst API Routes & Controllers](#phase-5-openanalyst-api-routes--controllers)
10. [Phase 6: Update Auth Routes](#phase-6-update-auth-routes)
11. [Phase 7: Frontend Desktop Auth Handling](#phase-7-frontend-desktop-auth-handling)
12. [Phase 8: CORS & Environment Configuration](#phase-8-cors--environment-configuration)
13. [Phase 9: Testing & Verification](#phase-9-testing--verification)
14. [Endpoints Summary](#10-endpoints-summary)
15. [What to Share with OpenAnalyst Team](#11-what-to-share-with-openanalyst-team)

---

## 1. OVERVIEW

### 1.1 Purpose

This document provides a comprehensive implementation plan to add **Desktop OAuth Flow** to PipesHub, enabling the OpenAnalyst VSCode extension to authenticate users through a browser and receive tokens via custom protocol redirect (`pipeshub://`).

### 1.2 Key Features

- **Single Database Architecture** - All data stored in PipesHub's MongoDB
- **Desktop OAuth Flow** - Browser-based auth with custom protocol callback
- **Seamless User Experience** - Same user account works on web and desktop
- **Long-lived Desktop Tokens** - 30-day tokens for desktop apps
- **OpenAnalyst API** - Endpoints for provider management, settings sync
- **No Breaking Changes** - Existing web authentication unchanged

### 1.3 What We're Building

| Component | Description |
|-----------|-------------|
| Source Detection Middleware | Detect `?source=desktop` parameter |
| Desktop JWT Generator | 30-day tokens with desktop claims |
| Database Schema Extensions | AI providers, extension settings |
| Desktop Auth Controller | Handle desktop-specific auth flow |
| OpenAnalyst API | Provider, settings, user endpoints |
| Frontend Redirect | Handle desktop callback redirect |
| CORS Configuration | Allow desktop app origins |

### 1.4 What We're NOT Building

| Component | Reason |
|-----------|--------|
| Balance/Credit System | Not required per requirements |
| Subscription Plans | Not required per requirements |
| Usage Tracking/Limits | Not required per requirements |
| Token Usage Analytics | Not required per requirements |

---

## 2. ARCHITECTURE

### 2.1 Authentication Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 1: Desktop App (OpenAnalyst VSCode Extension)                   │
│         User clicks "Sign In"                                        │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 2: Desktop App Opens Browser                                    │
│         URL: http://localhost:3000/auth/sign-in?source=desktop       │
│                                                       ↑               │
│                                       Critical query parameter        │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 3: Source Detection Middleware (NEW)                            │
│         - Reads ?source=desktop query parameter                      │
│         - Sets req.authSource = 'desktop'                            │
│         - Sets req.isDesktopAuth = true                              │
│         - Stores in session for entire auth flow                     │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 4: User Authenticates (EXISTING FLOW)                           │
│         - Email entry → POST /api/v1/userAccount/initAuth            │
│         - Auth method → POST /api/v1/userAccount/authenticate        │
│         - Supports: Password, OTP, Google, Microsoft, Azure, OAuth   │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 5: Backend Checks Auth Source (MODIFIED CONTROLLER)             │
│         if (req.isDesktopAuth || session.authSource === 'desktop') { │
│           - Generate 30-day desktop token                            │
│           - Include desktop-specific claims                          │
│           - Create callback URL: pipeshub://auth-callback?token=...  │
│           - Return token + callbackUrl in response                   │
│         } else {                                                     │
│           - Standard web flow (24h token)                            │
│         }                                                            │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 6: Frontend Handles Response (MODIFIED)                         │
│         if (response.authSource === 'desktop') {                     │
│           window.location.href = response.callbackUrl;               │
│           // Browser redirects to: pipeshub://auth-callback?token=...│
│         } else {                                                     │
│           // Normal web flow - store tokens, navigate to dashboard   │
│         }                                                            │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 7: OS Handles Custom Protocol                                   │
│         - Browser hands off pipeshub:// URL to OS                    │
│         - OS recognizes registered protocol handler                  │
│         - Activates OpenAnalyst VSCode extension                     │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 8: Desktop App Receives Token                                   │
│         - Extension catches pipeshub://auth-callback?token=<JWT>     │
│         - Extracts token from URL query parameter                    │
│         - Validates JWT signature and expiry                         │
│         - Stores token in secure storage (OS keychain)               │
│         - Shows success message in VSCode                            │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ STEP 9: Desktop App Makes API Calls                                  │
│         - All requests include: Authorization: Bearer <JWT>          │
│         - GET /api/v1/openanalyst/providers                          │
│         - PUT /api/v1/openanalyst/settings                           │
│         - GET /api/v1/openanalyst/user/profile                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Single Database Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SINGLE MONGODB DATABASE                         │
│                          (PipesHub)                                  │
├─────────────────────────────────────────────────────────────────────┤
│  EXISTING COLLECTIONS:                                               │
│  ├─ users                    ← User profiles (extended)             │
│  ├─ userCredentials          ← Passwords, OTP, security             │
│  ├─ organizations            ← Org settings, subscription           │
│  ├─ orgAuthConfigurations    ← Auth methods per org                 │
│  ├─ projects                 ← User projects                        │
│  ├─ conversations            ← Chat conversations                   │
│  └─ messages                 ← Chat messages                        │
│                                                                      │
│  NEW COLLECTIONS (FOR OPENANALYST):                                  │
│  ├─ aiProviderProfiles       ← AI provider configurations          │
│  └─ extensionSettings        ← Desktop extension settings          │
└─────────────────────────────────────────────────────────────────────┘
           ↑                                    ↑
           │                                    │
      ┌────┴─────┐                        ┌────┴──────┐
      │  Web UI  │                        │ Desktop   │
      │(Browser) │                        │(OpenAnalyst)│
      │          │                        │           │
      │ 24h JWT  │                        │ 30d JWT   │
      └──────────┘                        └───────────┘
```

### 2.3 Token Strategy

| Token Type | Expiry | Use Case | Scope |
|------------|--------|----------|-------|
| Web Access Token | 24 hours | Browser-based access | General API |
| Web Refresh Token | 30 days | Token refresh | TOKEN_REFRESH |
| **Desktop Access Token** | **30 days** | **Desktop app access** | **General API** |
| Desktop Refresh Token | 90 days | Desktop token refresh | TOKEN_REFRESH |
| Session Token | 1 hour | Multi-step auth | Auth flow only |

---

## 3. CURRENT SYSTEM ANALYSIS

### 3.1 Existing File Structure

```
backend/nodejs/apps/src/
├── modules/
│   ├── auth/
│   │   ├── controller/
│   │   │   └── userAccount.controller.ts    ← MODIFY
│   │   ├── routes/
│   │   │   └── userAccount.routes.ts        ← MODIFY
│   │   ├── schema/
│   │   │   ├── userCredentials.schema.ts    ← EXISTS
│   │   │   └── orgAuthConfiguration.schema.ts ← EXISTS
│   │   └── container/
│   │       └── authService.container.ts     ← MODIFY
│   │
│   ├── user_management/
│   │   └── schema/
│   │       └── users.schema.ts              ← MODIFY
│   │
│   └── openanalyst/                         ← CREATE NEW MODULE
│       ├── controller/
│       │   └── openanalyst.controller.ts
│       ├── routes/
│       │   └── openanalyst.routes.ts
│       ├── schema/
│       │   ├── aiProviderProfile.schema.ts
│       │   └── extensionSettings.schema.ts
│       └── services/
│           └── openanalyst.service.ts
│
├── libs/
│   ├── middlewares/
│   │   ├── auth.middleware.ts               ← EXISTS
│   │   └── sourceDetection.middleware.ts    ← CREATE
│   │
│   └── utils/
│       ├── createJwt.ts                     ← MODIFY
│       └── authRedirect.util.ts             ← CREATE
│
└── app.ts                                   ← MODIFY (routes, CORS)

frontend/src/
├── auth/
│   ├── view/auth/
│   │   └── authentication-view.tsx          ← MODIFY
│   └── context/jwt/
│       └── action.ts                        ← MODIFY
└── pages/auth/
    └── desktop-callback.tsx                 ← CREATE (optional)
```

### 3.2 Existing Auth Flow (What We're Extending)

**Current Authentication Flow:**
1. `POST /api/v1/userAccount/initAuth` - Initialize with email
2. `POST /api/v1/userAccount/authenticate` - Authenticate with method
3. Returns: `{ accessToken, refreshToken }` for final step
4. Frontend stores tokens in localStorage

**We're Adding:**
- Source detection (`?source=desktop`)
- Desktop-specific token generation (30-day expiry)
- Custom protocol redirect (`pipeshub://auth-callback?token=...`)
- OpenAnalyst API endpoints for provider/settings management

### 3.3 Existing JWT Structure

**Current Access Token Payload:**
```typescript
{
  userId: string;
  orgId: string;
  email: string;
  fullName: string;
  accountType: string;
  iat: number;
  exp: number;  // 24 hours
}
```

**New Desktop Token Payload (Extended):**
```typescript
{
  userId: string;
  orgId: string;
  email: string;
  fullName: string;
  accountType: string;
  firstName: string;
  lastName: string;
  authSource: 'desktop';       // NEW
  iat: number;
  exp: number;                 // 30 days
  iss: 'pipeshub-desktop';     // NEW
}
```

---

## 4. IMPLEMENTATION PHASES

### 4.1 Phase Summary

| Phase | Description | Files | Time Est. |
|-------|-------------|-------|-----------|
| **Phase 1** | Source Detection Middleware | 1 new | 30 mins |
| **Phase 2** | Desktop JWT Service | 1 modify, 1 new | 45 mins |
| **Phase 3** | Database Schema Extensions | 2 new, 1 modify | 60 mins |
| **Phase 4** | Desktop Auth Controller | 1 modify | 60 mins |
| **Phase 5** | OpenAnalyst API | 4 new files | 90 mins |
| **Phase 6** | Update Auth Routes | 1 modify | 30 mins |
| **Phase 7** | Frontend Desktop Auth | 2 modify | 45 mins |
| **Phase 8** | CORS & Environment | 2 modify | 20 mins |
| **Phase 9** | Testing & Verification | - | 60 mins |
| **TOTAL** | | **14 files** | **~7-8 hours** |

### 4.2 Dependencies Between Phases

```
Phase 1 (Middleware)
    │
    ├──► Phase 2 (JWT Service)
    │        │
    │        └──► Phase 4 (Controller) ──► Phase 6 (Routes)
    │                                           │
    │                                           └──► Phase 7 (Frontend)
    │
    └──► Phase 3 (Schema)
             │
             └──► Phase 5 (OpenAnalyst API) ──► Phase 6 (Routes)

Phase 8 (CORS) - Can be done in parallel
Phase 9 (Testing) - After all phases complete
```

---

## PHASE 1: SOURCE DETECTION MIDDLEWARE

### 1.1 Purpose

Detect if authentication request originates from desktop app vs web browser.

### 1.2 Files to Create

**File:** `apps/src/libs/middlewares/sourceDetection.middleware.ts`

### 1.3 Implementation

```typescript
// apps/src/libs/middlewares/sourceDetection.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../services/logger.service';

/**
 * Authentication Source Types
 */
export enum AuthSource {
  WEB = 'web',
  DESKTOP = 'desktop',
}

/**
 * Extended Request interface with auth source
 */
export interface SourceAwareRequest extends Request {
  authSource?: AuthSource;
  isDesktopAuth?: boolean;
}

/**
 * Source Detection Middleware
 *
 * Detects authentication source from query parameter:
 * - ?source=desktop → Desktop app (OpenAnalyst)
 * - ?source=web or no param → Web browser (default)
 *
 * Sets:
 * - req.authSource: 'web' | 'desktop'
 * - req.isDesktopAuth: boolean
 */
export const detectAuthSource = (
  req: SourceAwareRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const logger = Logger.getInstance();

  try {
    // Get source from query parameter, body, or header
    const sourceParam =
      req.query.source as string ||
      req.body?.source as string ||
      req.headers['x-auth-source'] as string;

    // Normalize and validate source
    const normalizedSource = sourceParam?.toLowerCase().trim();

    if (normalizedSource === AuthSource.DESKTOP) {
      req.authSource = AuthSource.DESKTOP;
      req.isDesktopAuth = true;

      logger.debug('[SourceDetection] Desktop auth detected', {
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
      });
    } else {
      req.authSource = AuthSource.WEB;
      req.isDesktopAuth = false;

      logger.debug('[SourceDetection] Web auth detected', {
        ip: req.ip,
        url: req.originalUrl,
      });
    }

    // Store in header for downstream services
    req.headers['x-auth-source'] = req.authSource;

    next();
  } catch (error) {
    logger.error('[SourceDetection] Error detecting source', {
      error: (error as Error).message
    });

    // Default to web on error
    req.authSource = AuthSource.WEB;
    req.isDesktopAuth = false;
    next();
  }
};

/**
 * Middleware to require desktop authentication
 * Use on routes that should only be accessible from desktop
 */
export const requireDesktopAuth = (
  req: SourceAwareRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.isDesktopAuth || req.authSource !== AuthSource.DESKTOP) {
    res.status(403).json({
      success: false,
      error: 'This endpoint is only available for desktop applications',
      code: 'DESKTOP_AUTH_REQUIRED',
    });
    return;
  }
  next();
};

/**
 * Get authentication redirect URL based on source
 */
export const getAuthRedirectUrl = (
  authSource: AuthSource,
  token: string,
  baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000',
): string => {
  if (authSource === AuthSource.DESKTOP) {
    const customProtocol = process.env.DESKTOP_CUSTOM_PROTOCOL || 'pipeshub';
    return `${customProtocol}://auth-callback?token=${encodeURIComponent(token)}`;
  }

  // Web redirect - return token info for frontend to handle
  return `${baseUrl}/dashboard`;
};

/**
 * Get error redirect URL based on source
 */
export const getAuthErrorRedirectUrl = (
  authSource: AuthSource,
  error: string,
  baseUrl: string = process.env.FRONTEND_URL || 'http://localhost:3000',
): string => {
  if (authSource === AuthSource.DESKTOP) {
    const customProtocol = process.env.DESKTOP_CUSTOM_PROTOCOL || 'pipeshub';
    return `${customProtocol}://auth-error?error=${encodeURIComponent(error)}`;
  }

  return `${baseUrl}/auth/sign-in?error=${encodeURIComponent(error)}`;
};
```

### 1.4 Export from Middlewares Index

Update or create `apps/src/libs/middlewares/index.ts`:

```typescript
// Add to existing exports
export {
  detectAuthSource,
  requireDesktopAuth,
  getAuthRedirectUrl,
  getAuthErrorRedirectUrl,
  AuthSource,
  SourceAwareRequest,
} from './sourceDetection.middleware';
```

### 1.5 Phase 1 Checklist

- [ ] Create `sourceDetection.middleware.ts`
- [ ] Export from middlewares index
- [ ] Test middleware independently
- [ ] Verify no breaking changes to existing routes

---

## PHASE 2: DESKTOP JWT SERVICE

### 2.1 Purpose

Generate long-lived JWT tokens for desktop applications with desktop-specific claims.

### 2.2 Files to Modify/Create

1. **Modify:** `apps/src/libs/utils/createJwt.ts`
2. **Create:** `apps/src/libs/utils/authRedirect.util.ts`

### 2.3 Implementation - createJwt.ts Additions

Add to existing `apps/src/libs/utils/createJwt.ts`:

```typescript
// Add to existing imports
import { AuthSource } from '../middlewares/sourceDetection.middleware';

// Add new interfaces
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

export interface DesktopTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  authSource: AuthSource.DESKTOP;
}

/**
 * Generate desktop access token with 30-day expiry
 *
 * @param scopedJwtSecret - JWT secret key
 * @param user - User data
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
  const expiresIn = process.env.DESKTOP_TOKEN_EXPIRY || '30d';

  return jwt.sign(payload, scopedJwtSecret, {
    expiresIn,
    issuer: 'pipeshub-desktop',
  });
};

/**
 * Generate desktop refresh token with 90-day expiry
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
  const expiresIn = process.env.DESKTOP_REFRESH_TOKEN_EXPIRY || '90d';

  return jwt.sign(payload, scopedJwtSecret, {
    expiresIn,
    issuer: 'pipeshub-desktop',
  });
};

/**
 * Generate complete desktop token response
 */
export const generateDesktopTokens = (
  jwtSecret: string,
  scopedJwtSecret: string,
  user: {
    _id: string;
    orgId: string;
    email: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    accountType?: string;
  },
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

  return {
    accessToken,
    refreshToken,
    expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
    tokenType: 'Bearer',
    authSource: AuthSource.DESKTOP,
  };
};
```

### 2.4 Implementation - authRedirect.util.ts

Create new file `apps/src/libs/utils/authRedirect.util.ts`:

```typescript
// apps/src/libs/utils/authRedirect.util.ts

import { AuthSource } from '../middlewares/sourceDetection.middleware';

/**
 * Desktop OAuth Callback URL Generator
 */
export interface AuthCallbackConfig {
  customProtocol: string;
  frontendUrl: string;
}

const defaultConfig: AuthCallbackConfig = {
  customProtocol: process.env.DESKTOP_CUSTOM_PROTOCOL || 'pipeshub',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};

/**
 * Generate success callback URL based on auth source
 */
export const getSuccessCallbackUrl = (
  authSource: AuthSource,
  token: string,
  config: AuthCallbackConfig = defaultConfig,
): string => {
  if (authSource === AuthSource.DESKTOP) {
    return `${config.customProtocol}://auth-callback?token=${encodeURIComponent(token)}`;
  }

  // For web, return null - frontend handles token storage
  return '';
};

/**
 * Generate error callback URL based on auth source
 */
export const getErrorCallbackUrl = (
  authSource: AuthSource,
  error: string,
  errorCode?: string,
  config: AuthCallbackConfig = defaultConfig,
): string => {
  const encodedError = encodeURIComponent(error);
  const encodedCode = errorCode ? `&code=${encodeURIComponent(errorCode)}` : '';

  if (authSource === AuthSource.DESKTOP) {
    return `${config.customProtocol}://auth-error?error=${encodedError}${encodedCode}`;
  }

  return `${config.frontendUrl}/auth/sign-in?error=${encodedError}${encodedCode}`;
};

/**
 * Build complete desktop auth response
 */
export interface DesktopAuthResponse {
  success: true;
  authSource: AuthSource.DESKTOP;
  accessToken: string;
  refreshToken: string;
  callbackUrl: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    orgId: string;
  };
}

export const buildDesktopAuthResponse = (
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  },
  user: {
    _id: string;
    email: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    orgId: string;
  },
  config: AuthCallbackConfig = defaultConfig,
): DesktopAuthResponse => {
  return {
    success: true,
    authSource: AuthSource.DESKTOP,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    callbackUrl: getSuccessCallbackUrl(AuthSource.DESKTOP, tokens.accessToken, config),
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
```

### 2.5 Phase 2 Checklist

- [ ] Add desktop JWT generators to `createJwt.ts`
- [ ] Create `authRedirect.util.ts`
- [ ] Export new functions
- [ ] Test token generation independently
- [ ] Verify token payload structure

---

## PHASE 3: DATABASE SCHEMA EXTENSIONS

### 3.1 Purpose

Add new collections and schema fields for OpenAnalyst desktop app data storage.

### 3.2 Files to Create/Modify

1. **Create:** `apps/src/modules/openanalyst/schema/aiProviderProfile.schema.ts`
2. **Create:** `apps/src/modules/openanalyst/schema/extensionSettings.schema.ts`
3. **Modify:** `apps/src/modules/user_management/schema/users.schema.ts` (optional reference)

### 3.3 Implementation - AI Provider Profile Schema

Create `apps/src/modules/openanalyst/schema/aiProviderProfile.schema.ts`:

```typescript
// apps/src/modules/openanalyst/schema/aiProviderProfile.schema.ts

import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Supported AI Providers
 */
export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  AZURE_OPENAI = 'azure-openai',
  COHERE = 'cohere',
  MISTRAL = 'mistral',
  OLLAMA = 'ollama',
  CUSTOM = 'custom',
}

/**
 * Provider-specific settings interface
 */
export interface IProviderSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  baseUrl?: string;
  apiVersion?: string;
  deploymentName?: string;
  [key: string]: any;
}

/**
 * AI Provider Profile Document Interface
 */
export interface IAIProviderProfile extends Document {
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  provider: AIProvider;
  encryptedApiKey?: string;
  settings: IProviderSettings;
  isActive: boolean;
  isDefault: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provider Settings Sub-Schema
 */
const providerSettingsSchema = new Schema<IProviderSettings>(
  {
    model: { type: String },
    temperature: { type: Number, min: 0, max: 2, default: 0.7 },
    maxTokens: { type: Number, min: 1 },
    topP: { type: Number, min: 0, max: 1 },
    frequencyPenalty: { type: Number, min: -2, max: 2 },
    presencePenalty: { type: Number, min: -2, max: 2 },
    baseUrl: { type: String },
    apiVersion: { type: String },
    deploymentName: { type: String },
  },
  { _id: false, strict: false }, // Allow additional provider-specific fields
);

/**
 * AI Provider Profile Schema
 */
const aiProviderProfileSchema = new Schema<IAIProviderProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'organizations',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    provider: {
      type: String,
      enum: Object.values(AIProvider),
      required: true,
      index: true,
    },
    encryptedApiKey: {
      type: String,
      select: false, // Don't return by default for security
    },
    settings: {
      type: providerSettingsSchema,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    lastUsedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'aiProviderProfiles',
  },
);

// Compound index for efficient queries
aiProviderProfileSchema.index({ userId: 1, orgId: 1, provider: 1 });
aiProviderProfileSchema.index({ userId: 1, isDefault: 1 });

// Ensure only one default profile per user
aiProviderProfileSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await AIProviderProfileModel.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { isDefault: false },
    );
  }
  next();
});

export const AIProviderProfileModel = mongoose.model<IAIProviderProfile>(
  'aiProviderProfiles',
  aiProviderProfileSchema,
  'aiProviderProfiles',
);
```

### 3.4 Implementation - Extension Settings Schema

Create `apps/src/modules/openanalyst/schema/extensionSettings.schema.ts`:

```typescript
// apps/src/modules/openanalyst/schema/extensionSettings.schema.ts

import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Theme options for extension
 */
export enum ExtensionTheme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

/**
 * Editor integration settings
 */
export interface IEditorSettings {
  autoComplete: boolean;
  inlineHints: boolean;
  codeActions: boolean;
  hoverInfo: boolean;
  diagnostics: boolean;
}

/**
 * Chat settings
 */
export interface IChatSettings {
  streamResponses: boolean;
  showTimestamps: boolean;
  persistHistory: boolean;
  maxHistoryItems: number;
}

/**
 * General settings
 */
export interface IGeneralSettings {
  theme: ExtensionTheme;
  language: string;
  telemetryEnabled: boolean;
  autoUpdate: boolean;
}

/**
 * Extension Settings Document Interface
 */
export interface IExtensionSettings extends Document {
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  general: IGeneralSettings;
  editor: IEditorSettings;
  chat: IChatSettings;
  customSettings: Record<string, any>;
  version: number;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * General Settings Sub-Schema
 */
const generalSettingsSchema = new Schema<IGeneralSettings>(
  {
    theme: {
      type: String,
      enum: Object.values(ExtensionTheme),
      default: ExtensionTheme.SYSTEM,
    },
    language: {
      type: String,
      default: 'en',
    },
    telemetryEnabled: {
      type: Boolean,
      default: true,
    },
    autoUpdate: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

/**
 * Editor Settings Sub-Schema
 */
const editorSettingsSchema = new Schema<IEditorSettings>(
  {
    autoComplete: { type: Boolean, default: true },
    inlineHints: { type: Boolean, default: true },
    codeActions: { type: Boolean, default: true },
    hoverInfo: { type: Boolean, default: true },
    diagnostics: { type: Boolean, default: true },
  },
  { _id: false },
);

/**
 * Chat Settings Sub-Schema
 */
const chatSettingsSchema = new Schema<IChatSettings>(
  {
    streamResponses: { type: Boolean, default: true },
    showTimestamps: { type: Boolean, default: false },
    persistHistory: { type: Boolean, default: true },
    maxHistoryItems: { type: Number, default: 100, min: 10, max: 1000 },
  },
  { _id: false },
);

/**
 * Extension Settings Schema
 */
const extensionSettingsSchema = new Schema<IExtensionSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'users',
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'organizations',
      required: true,
      index: true,
    },
    general: {
      type: generalSettingsSchema,
      default: () => ({}),
    },
    editor: {
      type: editorSettingsSchema,
      default: () => ({}),
    },
    chat: {
      type: chatSettingsSchema,
      default: () => ({}),
    },
    customSettings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    version: {
      type: Number,
      default: 1,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'extensionSettings',
  },
);

// Compound unique index - one settings doc per user per org
extensionSettingsSchema.index({ userId: 1, orgId: 1 }, { unique: true });

// Update syncedAt on save
extensionSettingsSchema.pre('save', function (next) {
  this.syncedAt = new Date();
  next();
});

export const ExtensionSettingsModel = mongoose.model<IExtensionSettings>(
  'extensionSettings',
  extensionSettingsSchema,
  'extensionSettings',
);
```

### 3.5 Create Schema Index File

Create `apps/src/modules/openanalyst/schema/index.ts`:

```typescript
// apps/src/modules/openanalyst/schema/index.ts

export {
  AIProviderProfileModel,
  IAIProviderProfile,
  IProviderSettings,
  AIProvider,
} from './aiProviderProfile.schema';

export {
  ExtensionSettingsModel,
  IExtensionSettings,
  IGeneralSettings,
  IEditorSettings,
  IChatSettings,
  ExtensionTheme,
} from './extensionSettings.schema';
```

### 3.6 Phase 3 Checklist

- [ ] Create `openanalyst` module directory structure
- [ ] Create `aiProviderProfile.schema.ts`
- [ ] Create `extensionSettings.schema.ts`
- [ ] Create schema index file
- [ ] Test schema validation
- [ ] Verify indexes are created

---

## PHASE 4: DESKTOP AUTH CONTROLLER

### 4.1 Purpose

Modify the existing `UserAccountController` to handle desktop authentication flow.

### 4.2 Files to Modify

**Modify:** `apps/src/modules/auth/controller/userAccount.controller.ts`

### 4.3 Implementation - Controller Modifications

Add these modifications to `userAccount.controller.ts`:

```typescript
// Add new imports at the top
import {
  AuthSource,
  SourceAwareRequest,
} from '../../../libs/middlewares/sourceDetection.middleware';
import {
  generateDesktopTokens,
} from '../../../libs/utils/createJwt';
import {
  buildDesktopAuthResponse,
  DesktopAuthResponse,
} from '../../../libs/utils/authRedirect.util';

// Add type for session with auth source
interface AuthSessionWithSource extends AuthSessionRequest {
  authSource?: AuthSource;
  isDesktopAuth?: boolean;
}

// Modify the authenticate method - find the section after successful authentication
// and add desktop handling logic

/**
 * MODIFIED authenticate() method
 *
 * Add this block BEFORE returning tokens for final step
 * (approximately after line 1280 in existing code)
 */

// Inside authenticate() method, after successful authentication validation
// Find where accessToken and refreshToken are generated and add:

async authenticate(
  req: AuthSessionWithSource,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // ... existing authentication logic ...

    // After successful authentication, before returning tokens:
    // Check if this is the final step and authentication is complete

    if (isFullyAuthenticated) {
      // Get user data
      const user = await this.iamService.getUserByEmail(session.email);

      // CHECK FOR DESKTOP AUTH SOURCE
      const authSource = req.authSource || session.authSource || AuthSource.WEB;
      const isDesktopAuth = authSource === AuthSource.DESKTOP;

      if (isDesktopAuth) {
        // DESKTOP AUTHENTICATION FLOW
        this.logger.info('[Auth] Desktop authentication successful', {
          userId: user._id,
          email: user.email,
          authSource: AuthSource.DESKTOP,
        });

        // Generate desktop tokens (30-day expiry)
        const desktopTokens = generateDesktopTokens(
          this.config.jwtSecret,
          this.config.scopedJwtSecret,
          {
            _id: user._id,
            orgId: session.orgId || user.orgId,
            email: user.email,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            accountType: user.accountType,
          },
        );

        // Build desktop response with callback URL
        const desktopResponse = buildDesktopAuthResponse(
          desktopTokens,
          {
            _id: user._id,
            email: user.email,
            fullName: user.fullName,
            firstName: user.firstName,
            lastName: user.lastName,
            orgId: session.orgId || user.orgId,
          },
        );

        // Update user login status
        if (!user.hasLoggedIn) {
          await this.iamService.updateUser(user._id, { hasLoggedIn: true });
        }

        // Clear session
        await this.sessionService.deleteSession(session.token);

        // Return desktop response
        res.status(200).json(desktopResponse);
        return;
      }

      // EXISTING WEB AUTHENTICATION FLOW
      // ... existing code for web tokens ...
    }

    // ... rest of existing authenticate logic ...
  } catch (error) {
    // ... existing error handling ...
  }
}

/**
 * Add new method to handle desktop token refresh
 */
async refreshDesktopToken(
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }

    // Verify refresh token
    const decoded = await this.authTokenService.verifyScopedToken(
      refreshToken,
      TokenScopes.TOKEN_REFRESH,
    );

    // Check if it's a desktop token
    if (decoded.authSource !== AuthSource.DESKTOP) {
      throw new UnauthorizedError('Invalid desktop refresh token');
    }

    // Get user data
    const user = await this.iamService.getUserById(decoded.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Generate new desktop tokens
    const newTokens = generateDesktopTokens(
      this.config.jwtSecret,
      this.config.scopedJwtSecret,
      {
        _id: user._id,
        orgId: decoded.orgId,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        accountType: user.accountType,
      },
    );

    this.logger.info('[Auth] Desktop token refreshed', {
      userId: user._id,
    });

    res.status(200).json({
      success: true,
      ...newTokens,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add method to get desktop user profile
 */
async getDesktopProfile(
  req: AuthenticatedUserRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    const orgId = req.user?.orgId;

    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const user = await this.iamService.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const org = await this.iamService.getOrgById(orgId);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        orgId: orgId,
        orgName: org?.registeredName || org?.shortName,
        hasLoggedIn: user.hasLoggedIn,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
```

### 4.4 Session Service Modification

Also modify `SessionService` to store auth source in session:

```typescript
// In session.service.ts, modify createSession to accept authSource

interface SessionData {
  // ... existing fields
  authSource?: AuthSource;
}

async createSession(
  sessionData: {
    userId?: string;
    email: string;
    authSource?: AuthSource;
  } & Partial<SessionData>,
): Promise<SessionData> {
  const session: SessionData = {
    token: generateSessionToken(),
    userId: sessionData.userId,
    email: sessionData.email,
    authSource: sessionData.authSource || AuthSource.WEB, // Store auth source
    // ... other fields
  };

  // ... rest of method
}
```

### 4.5 Phase 4 Checklist

- [ ] Add imports for new utilities
- [ ] Modify `authenticate()` method for desktop flow
- [ ] Add `refreshDesktopToken()` method
- [ ] Add `getDesktopProfile()` method
- [ ] Update SessionService to store authSource
- [ ] Test desktop authentication flow
- [ ] Verify web flow unchanged

---

## PHASE 5: OPENANALYST API ROUTES & CONTROLLERS

### 5.1 Purpose

Create new API endpoints for OpenAnalyst to manage AI providers and extension settings.

### 5.2 Files to Create

1. `apps/src/modules/openanalyst/controller/openanalyst.controller.ts`
2. `apps/src/modules/openanalyst/services/openanalyst.service.ts`
3. `apps/src/modules/openanalyst/routes/openanalyst.routes.ts`
4. `apps/src/modules/openanalyst/container/openanalyst.container.ts`

### 5.3 Implementation - OpenAnalyst Service

Create `apps/src/modules/openanalyst/services/openanalyst.service.ts`:

```typescript
// apps/src/modules/openanalyst/services/openanalyst.service.ts

import { injectable, inject } from 'inversify';
import { Types } from 'mongoose';
import {
  AIProviderProfileModel,
  IAIProviderProfile,
  AIProvider,
  IProviderSettings,
} from '../schema/aiProviderProfile.schema';
import {
  ExtensionSettingsModel,
  IExtensionSettings,
} from '../schema/extensionSettings.schema';
import { Logger } from '../../../libs/services/logger.service';
import { NotFoundError, BadRequestError } from '../../../libs/errors';
import { encrypt, decrypt } from '../../../libs/utils/encryption.util';

@injectable()
export class OpenAnalystService {
  constructor(
    @inject('Logger') private logger: Logger,
    @inject('EncryptionKey') private encryptionKey: string,
  ) {}

  // ============ PROVIDER PROFILE METHODS ============

  /**
   * Get all provider profiles for a user
   */
  async getProviderProfiles(
    userId: string,
    orgId: string,
  ): Promise<IAIProviderProfile[]> {
    const profiles = await AIProviderProfileModel.find({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    }).sort({ isDefault: -1, updatedAt: -1 });

    this.logger.debug('[OpenAnalyst] Retrieved provider profiles', {
      userId,
      count: profiles.length,
    });

    return profiles;
  }

  /**
   * Get a single provider profile by ID
   */
  async getProviderProfile(
    profileId: string,
    userId: string,
  ): Promise<IAIProviderProfile> {
    const profile = await AIProviderProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    });

    if (!profile) {
      throw new NotFoundError('Provider profile not found');
    }

    return profile;
  }

  /**
   * Create a new provider profile
   */
  async createProviderProfile(
    userId: string,
    orgId: string,
    data: {
      name: string;
      provider: AIProvider;
      apiKey?: string;
      settings?: IProviderSettings;
      isDefault?: boolean;
    },
  ): Promise<IAIProviderProfile> {
    // Encrypt API key if provided
    let encryptedApiKey: string | undefined;
    if (data.apiKey) {
      encryptedApiKey = encrypt(data.apiKey, this.encryptionKey);
    }

    const profile = new AIProviderProfileModel({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      name: data.name,
      provider: data.provider,
      encryptedApiKey,
      settings: data.settings || {},
      isDefault: data.isDefault || false,
      isActive: true,
    });

    await profile.save();

    this.logger.info('[OpenAnalyst] Created provider profile', {
      userId,
      profileId: profile._id,
      provider: data.provider,
    });

    return profile;
  }

  /**
   * Update a provider profile
   */
  async updateProviderProfile(
    profileId: string,
    userId: string,
    data: {
      name?: string;
      apiKey?: string;
      settings?: IProviderSettings;
      isActive?: boolean;
      isDefault?: boolean;
    },
  ): Promise<IAIProviderProfile> {
    const updateData: any = { ...data };

    // Encrypt new API key if provided
    if (data.apiKey) {
      updateData.encryptedApiKey = encrypt(data.apiKey, this.encryptionKey);
      delete updateData.apiKey;
    }

    const profile = await AIProviderProfileModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(profileId),
        userId: new Types.ObjectId(userId),
      },
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!profile) {
      throw new NotFoundError('Provider profile not found');
    }

    this.logger.info('[OpenAnalyst] Updated provider profile', {
      userId,
      profileId,
    });

    return profile;
  }

  /**
   * Delete a provider profile
   */
  async deleteProviderProfile(
    profileId: string,
    userId: string,
  ): Promise<void> {
    const result = await AIProviderProfileModel.deleteOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Provider profile not found');
    }

    this.logger.info('[OpenAnalyst] Deleted provider profile', {
      userId,
      profileId,
    });
  }

  /**
   * Get decrypted API key for a profile
   */
  async getProviderApiKey(
    profileId: string,
    userId: string,
  ): Promise<string | null> {
    const profile = await AIProviderProfileModel.findOne({
      _id: new Types.ObjectId(profileId),
      userId: new Types.ObjectId(userId),
    }).select('+encryptedApiKey');

    if (!profile || !profile.encryptedApiKey) {
      return null;
    }

    return decrypt(profile.encryptedApiKey, this.encryptionKey);
  }

  // ============ EXTENSION SETTINGS METHODS ============

  /**
   * Get extension settings for a user
   */
  async getExtensionSettings(
    userId: string,
    orgId: string,
  ): Promise<IExtensionSettings> {
    let settings = await ExtensionSettingsModel.findOne({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    });

    // Create default settings if none exist
    if (!settings) {
      settings = new ExtensionSettingsModel({
        userId: new Types.ObjectId(userId),
        orgId: new Types.ObjectId(orgId),
      });
      await settings.save();

      this.logger.info('[OpenAnalyst] Created default extension settings', {
        userId,
      });
    }

    return settings;
  }

  /**
   * Update extension settings
   */
  async updateExtensionSettings(
    userId: string,
    orgId: string,
    data: {
      general?: Partial<IExtensionSettings['general']>;
      editor?: Partial<IExtensionSettings['editor']>;
      chat?: Partial<IExtensionSettings['chat']>;
      customSettings?: Record<string, any>;
    },
  ): Promise<IExtensionSettings> {
    const updateData: any = {};

    if (data.general) {
      Object.keys(data.general).forEach((key) => {
        updateData[`general.${key}`] = (data.general as any)[key];
      });
    }

    if (data.editor) {
      Object.keys(data.editor).forEach((key) => {
        updateData[`editor.${key}`] = (data.editor as any)[key];
      });
    }

    if (data.chat) {
      Object.keys(data.chat).forEach((key) => {
        updateData[`chat.${key}`] = (data.chat as any)[key];
      });
    }

    if (data.customSettings) {
      updateData.customSettings = data.customSettings;
    }

    updateData.syncedAt = new Date();
    updateData['$inc'] = { version: 1 };

    const settings = await ExtensionSettingsModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        orgId: new Types.ObjectId(orgId),
      },
      { $set: updateData, ...updateData['$inc'] && { $inc: updateData['$inc'] } },
      { new: true, upsert: true, runValidators: true },
    );

    this.logger.info('[OpenAnalyst] Updated extension settings', {
      userId,
      version: settings?.version,
    });

    return settings!;
  }

  /**
   * Reset extension settings to defaults
   */
  async resetExtensionSettings(
    userId: string,
    orgId: string,
  ): Promise<IExtensionSettings> {
    await ExtensionSettingsModel.deleteOne({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
    });

    // Create new default settings
    return this.getExtensionSettings(userId, orgId);
  }
}
```

### 5.4 Implementation - OpenAnalyst Controller

Create `apps/src/modules/openanalyst/controller/openanalyst.controller.ts`:

```typescript
// apps/src/modules/openanalyst/controller/openanalyst.controller.ts

import { injectable, inject } from 'inversify';
import { Request, Response, NextFunction } from 'express';
import { OpenAnalystService } from '../services/openanalyst.service';
import { Logger } from '../../../libs/services/logger.service';
import { AuthenticatedUserRequest } from '../../../libs/middlewares/auth.middleware';
import { BadRequestError } from '../../../libs/errors';
import { AIProvider } from '../schema/aiProviderProfile.schema';

@injectable()
export class OpenAnalystController {
  constructor(
    @inject('OpenAnalystService') private openAnalystService: OpenAnalystService,
    @inject('Logger') private logger: Logger,
  ) {}

  // ============ HEALTH CHECK ============

  /**
   * GET /api/v1/openanalyst/health
   * Public health check endpoint
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      service: 'PipesHub OpenAnalyst API',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  }

  // ============ PROVIDER PROFILE ENDPOINTS ============

  /**
   * GET /api/v1/openanalyst/providers
   * Get all provider profiles for authenticated user
   */
  async getProviders(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        throw new BadRequestError('User context required');
      }

      const profiles = await this.openAnalystService.getProviderProfiles(
        userId,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: profiles,
        count: profiles.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/openanalyst/providers/:id
   * Get a specific provider profile
   */
  async getProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const profileId = req.params.id;

      if (!userId) {
        throw new BadRequestError('User context required');
      }

      const profile = await this.openAnalystService.getProviderProfile(
        profileId,
        userId,
      );

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/openanalyst/providers
   * Create a new provider profile
   */
  async createProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;
      const { name, provider, apiKey, settings, isDefault } = req.body;

      if (!userId || !orgId) {
        throw new BadRequestError('User context required');
      }

      if (!name || !provider) {
        throw new BadRequestError('Name and provider are required');
      }

      if (!Object.values(AIProvider).includes(provider)) {
        throw new BadRequestError(`Invalid provider: ${provider}`);
      }

      const profile = await this.openAnalystService.createProviderProfile(
        userId,
        orgId,
        { name, provider, apiKey, settings, isDefault },
      );

      res.status(201).json({
        success: true,
        data: profile,
        message: 'Provider profile created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/openanalyst/providers/:id
   * Update a provider profile
   */
  async updateProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const profileId = req.params.id;
      const { name, apiKey, settings, isActive, isDefault } = req.body;

      if (!userId) {
        throw new BadRequestError('User context required');
      }

      const profile = await this.openAnalystService.updateProviderProfile(
        profileId,
        userId,
        { name, apiKey, settings, isActive, isDefault },
      );

      res.status(200).json({
        success: true,
        data: profile,
        message: 'Provider profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/openanalyst/providers/:id
   * Delete a provider profile
   */
  async deleteProvider(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const profileId = req.params.id;

      if (!userId) {
        throw new BadRequestError('User context required');
      }

      await this.openAnalystService.deleteProviderProfile(profileId, userId);

      res.status(200).json({
        success: true,
        message: 'Provider profile deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============ EXTENSION SETTINGS ENDPOINTS ============

  /**
   * GET /api/v1/openanalyst/settings
   * Get extension settings for authenticated user
   */
  async getSettings(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        throw new BadRequestError('User context required');
      }

      const settings = await this.openAnalystService.getExtensionSettings(
        userId,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/openanalyst/settings
   * Update extension settings
   */
  async updateSettings(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;
      const { general, editor, chat, customSettings } = req.body;

      if (!userId || !orgId) {
        throw new BadRequestError('User context required');
      }

      const settings = await this.openAnalystService.updateExtensionSettings(
        userId,
        orgId,
        { general, editor, chat, customSettings },
      );

      res.status(200).json({
        success: true,
        data: settings,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/openanalyst/settings/reset
   * Reset extension settings to defaults
   */
  async resetSettings(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const orgId = req.user?.orgId;

      if (!userId || !orgId) {
        throw new BadRequestError('User context required');
      }

      const settings = await this.openAnalystService.resetExtensionSettings(
        userId,
        orgId,
      );

      res.status(200).json({
        success: true,
        data: settings,
        message: 'Settings reset to defaults',
      });
    } catch (error) {
      next(error);
    }
  }

  // ============ USER PROFILE ENDPOINT ============

  /**
   * GET /api/v1/openanalyst/user/profile
   * Get current user profile for desktop app
   */
  async getUserProfile(
    req: AuthenticatedUserRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        throw new BadRequestError('User context required');
      }

      res.status(200).json({
        success: true,
        data: {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
          orgId: user.orgId,
          authSource: user.authSource || 'web',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
```

### 5.5 Implementation - OpenAnalyst Routes

Create `apps/src/modules/openanalyst/routes/openanalyst.routes.ts`:

```typescript
// apps/src/modules/openanalyst/routes/openanalyst.routes.ts

import { Router } from 'express';
import { Container } from 'inversify';
import { OpenAnalystController } from '../controller/openanalyst.controller';
import { AuthMiddleware } from '../../../libs/middlewares/auth.middleware';

export const createOpenAnalystRouter = (container: Container): Router => {
  const router = Router();
  const controller = container.get<OpenAnalystController>('OpenAnalystController');
  const authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');

  // ============ PUBLIC ENDPOINTS ============

  /**
   * Health check - no auth required
   */
  router.get('/health', (req, res) => controller.healthCheck(req, res));

  // ============ AUTHENTICATED ENDPOINTS ============
  // All routes below require JWT authentication

  /**
   * Provider Profile Routes
   */
  router.get(
    '/providers',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.getProviders(req, res, next),
  );

  router.get(
    '/providers/:id',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.getProvider(req, res, next),
  );

  router.post(
    '/providers',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.createProvider(req, res, next),
  );

  router.put(
    '/providers/:id',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.updateProvider(req, res, next),
  );

  router.delete(
    '/providers/:id',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.deleteProvider(req, res, next),
  );

  /**
   * Extension Settings Routes
   */
  router.get(
    '/settings',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.getSettings(req, res, next),
  );

  router.put(
    '/settings',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.updateSettings(req, res, next),
  );

  router.post(
    '/settings/reset',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.resetSettings(req, res, next),
  );

  /**
   * User Profile Route
   */
  router.get(
    '/user/profile',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.getUserProfile(req, res, next),
  );

  return router;
};
```

### 5.6 Implementation - OpenAnalyst Container

Create `apps/src/modules/openanalyst/container/openanalyst.container.ts`:

```typescript
// apps/src/modules/openanalyst/container/openanalyst.container.ts

import { Container } from 'inversify';
import { OpenAnalystService } from '../services/openanalyst.service';
import { OpenAnalystController } from '../controller/openanalyst.controller';
import { Logger } from '../../../libs/services/logger.service';
import { AppConfig } from '../../../config/app.config';

export class OpenAnalystContainer {
  private static instance: Container;

  static async initialize(
    parentContainer: Container,
    appConfig: AppConfig,
  ): Promise<Container> {
    const container = new Container();

    // Get dependencies from parent container
    const logger = parentContainer.get<Logger>('Logger');
    const authMiddleware = parentContainer.get('AuthMiddleware');

    // Bind dependencies
    container.bind<Logger>('Logger').toConstantValue(logger);
    container.bind('AuthMiddleware').toConstantValue(authMiddleware);
    container.bind<string>('EncryptionKey').toConstantValue(
      appConfig.encryptionKey || appConfig.jwtSecret,
    );

    // Bind service
    container.bind<OpenAnalystService>('OpenAnalystService')
      .toDynamicValue(() => {
        return new OpenAnalystService(
          logger,
          appConfig.encryptionKey || appConfig.jwtSecret,
        );
      })
      .inSingletonScope();

    // Bind controller
    container.bind<OpenAnalystController>('OpenAnalystController')
      .toDynamicValue(() => {
        const service = container.get<OpenAnalystService>('OpenAnalystService');
        return new OpenAnalystController(service, logger);
      })
      .inSingletonScope();

    this.instance = container;
    return container;
  }

  static getInstance(): Container {
    if (!this.instance) {
      throw new Error('OpenAnalystContainer not initialized');
    }
    return this.instance;
  }
}
```

### 5.7 Create Module Index

Create `apps/src/modules/openanalyst/index.ts`:

```typescript
// apps/src/modules/openanalyst/index.ts

export { OpenAnalystContainer } from './container/openanalyst.container';
export { createOpenAnalystRouter } from './routes/openanalyst.routes';
export { OpenAnalystService } from './services/openanalyst.service';
export { OpenAnalystController } from './controller/openanalyst.controller';
export * from './schema';
```

### 5.8 Phase 5 Checklist

- [ ] Create `openanalyst.service.ts`
- [ ] Create `openanalyst.controller.ts`
- [ ] Create `openanalyst.routes.ts`
- [ ] Create `openanalyst.container.ts`
- [ ] Create module index file
- [ ] Test endpoints with mock data
- [ ] Verify authentication middleware works

---

## PHASE 6: UPDATE AUTH ROUTES

### 6.1 Purpose

Add source detection middleware to auth routes and add new desktop-specific routes.

### 6.2 Files to Modify

**Modify:** `apps/src/modules/auth/routes/userAccount.routes.ts`

### 6.3 Implementation

```typescript
// Add to existing userAccount.routes.ts

import { detectAuthSource } from '../../../libs/middlewares/sourceDetection.middleware';

// Modify existing routes to include source detection
export const createUserAccountRouter = (container: Container): Router => {
  const router = Router();
  const controller = container.get<UserAccountController>('UserAccountController');
  const authMiddleware = container.get<AuthMiddleware>('AuthMiddleware');

  // ============ EXISTING ROUTES (MODIFIED) ============

  /**
   * Initialize authentication
   * Added: detectAuthSource middleware
   */
  router.post(
    '/initAuth',
    detectAuthSource,  // ADD THIS
    (req, res, next) => controller.initAuth(req, res, next),
  );

  /**
   * Authenticate user
   * Added: detectAuthSource middleware
   */
  router.post(
    '/authenticate',
    detectAuthSource,  // ADD THIS
    authSessionMiddleware,
    (req, res, next) => controller.authenticate(req, res, next),
  );

  // ... other existing routes unchanged ...

  // ============ NEW DESKTOP ROUTES ============

  /**
   * Refresh desktop token
   * Requires valid refresh token
   */
  router.post(
    '/desktop/refresh',
    detectAuthSource,
    (req, res, next) => controller.refreshDesktopToken(req, res, next),
  );

  /**
   * Get desktop user profile
   * Requires valid access token
   */
  router.get(
    '/desktop/profile',
    authMiddleware.authenticate.bind(authMiddleware),
    (req, res, next) => controller.getDesktopProfile(req, res, next),
  );

  return router;
};
```

### 6.4 Mount OpenAnalyst Routes in app.ts

Add to `apps/src/app.ts`:

```typescript
// Add import
import { createOpenAnalystRouter, OpenAnalystContainer } from './modules/openanalyst';

// In configureRoutes() method, add:
private async configureRoutes(): Promise<void> {
  // ... existing routes ...

  // ============ NEW: OPENANALYST ROUTES ============
  const openAnalystContainer = await OpenAnalystContainer.initialize(
    this.authServiceContainer,
    this.config,
  );

  this.app.use(
    '/api/v1/openanalyst',
    createOpenAnalystRouter(openAnalystContainer),
  );
}
```

### 6.5 Phase 6 Checklist

- [ ] Add `detectAuthSource` to `/initAuth` route
- [ ] Add `detectAuthSource` to `/authenticate` route
- [ ] Add `/desktop/refresh` route
- [ ] Add `/desktop/profile` route
- [ ] Mount OpenAnalyst routes in `app.ts`
- [ ] Test all routes are accessible
- [ ] Verify existing routes unchanged

---

## PHASE 7: FRONTEND DESKTOP AUTH HANDLING

### 7.1 Purpose

Modify frontend to handle desktop authentication callback redirect.

### 7.2 Files to Modify

1. **Modify:** `frontend/src/auth/view/auth/authentication-view.tsx`
2. **Modify:** `frontend/src/auth/context/jwt/action.ts`

### 7.3 Implementation - authentication-view.tsx

Add desktop handling to the authentication view:

```typescript
// Add to authentication-view.tsx

// Add interface for desktop response
interface DesktopAuthResponse {
  success: true;
  authSource: 'desktop';
  accessToken: string;
  refreshToken: string;
  callbackUrl: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: {
    id: string;
    email: string;
    fullName: string;
    firstName: string;
    lastName: string;
    orgId: string;
  };
}

// Modify handleAuthComplete or equivalent success handler
const handleAuthSuccess = async (response: any) => {
  // Check if this is a desktop authentication
  if (response.authSource === 'desktop' && response.callbackUrl) {
    // Desktop flow - redirect to custom protocol
    // This will trigger the desktop app's protocol handler
    console.log('[Auth] Desktop auth success, redirecting to:', response.callbackUrl);

    // Small delay to ensure response is fully processed
    setTimeout(() => {
      window.location.href = response.callbackUrl;
    }, 100);

    return;
  }

  // Standard web flow - store tokens and navigate
  if (response.accessToken && response.refreshToken) {
    await setSession(response.accessToken, response.refreshToken);
    checkUserSession?.();
    router.push('/');
  }
};

// Update the component to check for source=desktop in URL
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const source = urlParams.get('source');

  if (source === 'desktop') {
    // Store source in state or context for later use
    setIsDesktopAuth(true);
    console.log('[Auth] Desktop authentication flow detected');
  }
}, []);
```

### 7.4 Implementation - action.ts

Update action functions to handle desktop responses:

```typescript
// Modify SignInWithPassword, SignInWithOAuth, etc.

export const SignInWithPassword = async (
  email: string,
  password: string,
): Promise<AuthResponse | DesktopAuthResponse> => {
  const requestBody = {
    email,
    method: 'password',
    credentials: { password },
  };

  const res = await axios.post(
    `${CONFIG.authUrl}/api/v1/userAccount/authenticate`,
    requestBody,
  );

  const response = res.data;

  // Check for desktop response
  if (response.authSource === 'desktop') {
    // Don't store tokens for desktop - they'll be handled by callback
    return response as DesktopAuthResponse;
  }

  // Standard web flow
  if (response.accessToken && response.refreshToken) {
    setSession(response.accessToken, response.refreshToken);
  }

  return response;
};

// Add similar handling to other sign-in methods
export const SignInWithOAuth = async (
  credentials: { accessToken?: string; idToken?: string },
): Promise<AuthResponse | DesktopAuthResponse> => {
  const res = await axios.post(
    `${CONFIG.authUrl}/api/v1/userAccount/authenticate`,
    {
      credentials,
      method: 'oauth',
    },
  );

  const response = res.data;

  // Check for desktop response
  if (response.authSource === 'desktop') {
    return response as DesktopAuthResponse;
  }

  // Standard web flow
  if (response.accessToken && response.refreshToken) {
    setSession(response.accessToken, response.refreshToken);
  }

  return response;
};
```

### 7.5 Phase 7 Checklist

- [ ] Add desktop response interface
- [ ] Modify `handleAuthSuccess` to handle desktop flow
- [ ] Add URL parameter detection for source=desktop
- [ ] Update `SignInWithPassword` for desktop response
- [ ] Update `SignInWithOAuth` for desktop response
- [ ] Update other sign-in methods as needed
- [ ] Test desktop redirect flow
- [ ] Verify web flow unchanged

---

## PHASE 8: CORS & ENVIRONMENT CONFIGURATION

### 8.1 Purpose

Configure CORS to allow desktop app requests and add environment variables.

### 8.2 Files to Modify

1. **Modify:** `apps/src/app.ts` (CORS configuration)
2. **Modify:** `.env` (environment variables)

### 8.3 Implementation - CORS in app.ts

Update CORS configuration in `apps/src/app.ts`:

```typescript
// Find the CORS configuration section and update

private configureCors(): void {
  // Parse allowed origins from environment
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(origin => origin.trim());

  // Add desktop protocol origins
  const desktopOrigins = [
    'pipeshub://',
    'vscode://',
    'vscode-webview://',
  ];

  const allOrigins = [...allowedOrigins, ...desktopOrigins];

  this.app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, desktop apps)
        if (!origin) {
          callback(null, true);
          return;
        }

        // Check if origin is in allowed list
        const isAllowed = allOrigins.some(allowed => {
          // Exact match
          if (allowed === origin) return true;
          // Protocol match (for custom protocols)
          if (origin.startsWith(allowed)) return true;
          // Wildcard localhost ports
          if (allowed === 'http://localhost:*' && origin.match(/^http:\/\/localhost:\d+$/)) {
            return true;
          }
          return false;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          this.logger.warn('[CORS] Blocked origin:', { origin });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-session-token',
        'x-auth-source',  // ADD THIS for source detection
      ],
      exposedHeaders: [
        'x-session-token',
        'content-disposition',
        'x-auth-source',  // ADD THIS
      ],
    }),
  );
}
```

### 8.4 Implementation - Environment Variables

Add to `.env`:

```bash
# ============ DESKTOP OAUTH CONFIGURATION ============

# Custom protocol for desktop callback
DESKTOP_CUSTOM_PROTOCOL=pipeshub

# Desktop token expiry (30 days)
DESKTOP_TOKEN_EXPIRY=30d

# Desktop refresh token expiry (90 days)
DESKTOP_REFRESH_TOKEN_EXPIRY=90d

# Additional CORS origins for desktop apps
# Comma-separated list
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3080,pipeshub://,vscode://

# Encryption key for API keys (use existing JWT secret or separate key)
ENCRYPTION_KEY=${JWT_SECRET}
```

### 8.5 Phase 8 Checklist

- [ ] Update CORS configuration in `app.ts`
- [ ] Add `x-auth-source` to allowed/exposed headers
- [ ] Add desktop protocol origins
- [ ] Add environment variables to `.env`
- [ ] Test CORS with desktop origins
- [ ] Verify web CORS unchanged

---

## PHASE 9: TESTING & VERIFICATION

### 9.1 Purpose

Comprehensive testing of all implemented features.

### 9.2 Test Cases

#### Test 1: Health Check
```bash
curl http://localhost:3000/api/v1/openanalyst/health
```

**Expected Response:**
```json
{
  "success": true,
  "service": "PipesHub OpenAnalyst API",
  "status": "healthy",
  "timestamp": "2025-12-23T10:00:00.000Z",
  "version": "1.0.0"
}
```

#### Test 2: Desktop Auth Flow
1. Open browser: `http://localhost:3000/auth/sign-in?source=desktop`
2. Enter email, complete authentication
3. Verify redirect to: `pipeshub://auth-callback?token=<JWT>`
4. Decode JWT and verify payload includes `authSource: 'desktop'`

#### Test 3: Provider Profile CRUD
```bash
# Create provider
curl -X POST http://localhost:3000/api/v1/openanalyst/providers \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My OpenAI",
    "provider": "openai",
    "apiKey": "sk-...",
    "settings": { "model": "gpt-4", "temperature": 0.7 }
  }'

# Get providers
curl http://localhost:3000/api/v1/openanalyst/providers \
  -H "Authorization: Bearer <TOKEN>"

# Update provider
curl -X PUT http://localhost:3000/api/v1/openanalyst/providers/<ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Updated Name" }'

# Delete provider
curl -X DELETE http://localhost:3000/api/v1/openanalyst/providers/<ID> \
  -H "Authorization: Bearer <TOKEN>"
```

#### Test 4: Extension Settings
```bash
# Get settings
curl http://localhost:3000/api/v1/openanalyst/settings \
  -H "Authorization: Bearer <TOKEN>"

# Update settings
curl -X PUT http://localhost:3000/api/v1/openanalyst/settings \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "general": { "theme": "dark" },
    "editor": { "autoComplete": true }
  }'
```

#### Test 5: Token Verification
```bash
# Decode desktop token
node -e "
const token = 'YOUR_DESKTOP_TOKEN';
const parts = token.split('.');
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
console.log(JSON.stringify(payload, null, 2));
"
```

**Expected Payload:**
```json
{
  "userId": "...",
  "orgId": "...",
  "email": "user@example.com",
  "fullName": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  "accountType": "individual",
  "authSource": "desktop",
  "iat": 1703318400,
  "exp": 1705910400,
  "iss": "pipeshub-desktop"
}
```

#### Test 6: Web Flow Unchanged
1. Open browser: `http://localhost:3000/auth/sign-in` (no source param)
2. Complete authentication
3. Verify normal web redirect to dashboard
4. Verify 24h token expiry

### 9.3 Phase 9 Checklist

- [ ] Test health check endpoint
- [ ] Test desktop auth initiation
- [ ] Test desktop auth callback redirect
- [ ] Test desktop token generation
- [ ] Test desktop token refresh
- [ ] Test provider profile CRUD
- [ ] Test extension settings CRUD
- [ ] Test web flow unchanged
- [ ] Verify CORS works for desktop origins
- [ ] Performance testing
- [ ] Security review

---

## 10. ENDPOINTS SUMMARY

### 10.1 Authentication Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/v1/userAccount/initAuth` | Initialize auth flow | No |
| POST | `/api/v1/userAccount/authenticate` | Complete authentication | Session |
| POST | `/api/v1/userAccount/desktop/refresh` | Refresh desktop token | Refresh Token |
| GET | `/api/v1/userAccount/desktop/profile` | Get desktop user profile | JWT |

### 10.2 OpenAnalyst API Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/openanalyst/health` | Health check | No |
| GET | `/api/v1/openanalyst/providers` | List provider profiles | JWT |
| GET | `/api/v1/openanalyst/providers/:id` | Get provider profile | JWT |
| POST | `/api/v1/openanalyst/providers` | Create provider profile | JWT |
| PUT | `/api/v1/openanalyst/providers/:id` | Update provider profile | JWT |
| DELETE | `/api/v1/openanalyst/providers/:id` | Delete provider profile | JWT |
| GET | `/api/v1/openanalyst/settings` | Get extension settings | JWT |
| PUT | `/api/v1/openanalyst/settings` | Update extension settings | JWT |
| POST | `/api/v1/openanalyst/settings/reset` | Reset settings to default | JWT |
| GET | `/api/v1/openanalyst/user/profile` | Get user profile | JWT |

**Total: 14 Endpoints**

---

## 11. WHAT TO SHARE WITH OPENANALYST TEAM

### 11.1 Documentation Package

Provide OpenAnalyst team with:

1. **Base URLs:**
   - Development: `http://localhost:3000`
   - Production: `https://api.pipeshub.com`

2. **Custom Protocol:** `pipeshub://`

3. **Authentication Flow:**
   - Open browser: `http://localhost:3000/auth/sign-in?source=desktop`
   - After auth, browser redirects to: `pipeshub://auth-callback?token=<JWT>`

4. **Token Details:**
   - Type: JWT Bearer token
   - Expiry: 30 days
   - Header: `Authorization: Bearer <token>`

5. **API Endpoints List** (see Section 10)

6. **Error Handling:**
   - Error redirect: `pipeshub://auth-error?error=<message>&code=<code>`
   - API errors: `{ success: false, error: string, code: string }`

### 11.2 Sample Integration Code

```typescript
// OpenAnalyst Extension - Sample Integration

// 1. Open browser for authentication
const openAuthBrowser = () => {
  const authUrl = 'http://localhost:3000/auth/sign-in?source=desktop';
  vscode.env.openExternal(vscode.Uri.parse(authUrl));
};

// 2. Register protocol handler
vscode.window.registerUriHandler({
  handleUri(uri: vscode.Uri) {
    if (uri.path === '/auth-callback') {
      const token = uri.query.split('token=')[1];
      if (token) {
        // Store token securely
        context.secrets.store('pipeshub-token', token);
        vscode.window.showInformationMessage('Successfully logged in!');
      }
    }
    if (uri.path === '/auth-error') {
      const error = uri.query.split('error=')[1];
      vscode.window.showErrorMessage(`Login failed: ${error}`);
    }
  }
});

// 3. Make API calls
const getProviders = async () => {
  const token = await context.secrets.get('pipeshub-token');
  const response = await fetch('http://localhost:3000/api/v1/openanalyst/providers', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};
```

---

## APPENDIX: FILE CREATION/MODIFICATION SUMMARY

### New Files to Create (10 files)

```
apps/src/libs/middlewares/sourceDetection.middleware.ts
apps/src/libs/utils/authRedirect.util.ts
apps/src/modules/openanalyst/schema/aiProviderProfile.schema.ts
apps/src/modules/openanalyst/schema/extensionSettings.schema.ts
apps/src/modules/openanalyst/schema/index.ts
apps/src/modules/openanalyst/services/openanalyst.service.ts
apps/src/modules/openanalyst/controller/openanalyst.controller.ts
apps/src/modules/openanalyst/routes/openanalyst.routes.ts
apps/src/modules/openanalyst/container/openanalyst.container.ts
apps/src/modules/openanalyst/index.ts
```

### Files to Modify (6 files)

```
apps/src/libs/utils/createJwt.ts
apps/src/modules/auth/controller/userAccount.controller.ts
apps/src/modules/auth/routes/userAccount.routes.ts
apps/src/app.ts
frontend/src/auth/view/auth/authentication-view.tsx
frontend/src/auth/context/jwt/action.ts
```

### Configuration Files to Update (1 file)

```
.env
```

---

## SUCCESS CRITERIA

Implementation is successful when:

1. ✅ Desktop app can open browser with `?source=desktop`
2. ✅ Source detection middleware identifies desktop requests
3. ✅ Backend generates 30-day tokens for desktop
4. ✅ Browser redirects to `pipeshub://auth-callback?token=...`
5. ✅ OpenAnalyst API endpoints work with desktop tokens
6. ✅ Provider profiles can be managed via API
7. ✅ Extension settings sync works
8. ✅ Web authentication flow remains unchanged
9. ✅ All tests pass
10. ✅ Documentation provided to OpenAnalyst team

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-23
**Author:** PipesHub Development Team

---

# READY FOR IMPLEMENTATION

This document provides the complete implementation plan. When ready, proceed phase by phase:

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9
```

**Say "Let's implement Phase X" to begin any phase!**
