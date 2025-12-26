# Desktop OAuth Integration Guide

This document provides complete integration details for desktop application developers (VSCode Extension / OpenAnalyst) to implement OAuth authentication with PipesHub.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Custom Protocol Scheme](#custom-protocol-scheme)
5. [Callback URL Format](#callback-url-format)
6. [Callback JWT Payload Structure](#callback-jwt-payload-structure)
7. [Token Details](#token-details)
8. [API Authentication](#api-authentication)
9. [Error Handling](#error-handling)
10. [Token Refresh](#token-refresh)
11. [Logout](#logout)

---

## Overview

The desktop OAuth flow allows users to authenticate in their default web browser and securely pass credentials back to the desktop application using a custom protocol scheme (`openanalyst://`).

**Key Benefits:**
- Users authenticate via familiar web interface
- Supports all authentication methods (password, OTP, Google, Microsoft, Azure AD, SAML SSO)
- Secure token transfer via custom protocol
- Extended token expiry (30 days) for better desktop UX

---

## Authentication Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Desktop App    │     │  Web Browser    │     │  PipesHub API   │
│  (OpenAnalyst)  │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. Open browser      │                       │
         │  with auth URL        │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │  2. User enters       │
         │                       │  credentials          │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │  3. API validates     │
         │                       │  and returns tokens   │
         │                       │<──────────────────────│
         │                       │                       │
         │  4. Browser redirects │                       │
         │  to success page      │                       │
         │                       │                       │
         │  5. User clicks       │                       │
         │  "Open OpenAnalyst"   │                       │
         │<──────────────────────│                       │
         │  openanalyst://auth-  │                       │
         │  callback?token=xxx   │                       │
         │                       │                       │
         │  6. Desktop app       │                       │
         │  receives token       │                       │
         │  and stores it        │                       │
         │                       │                       │
         │  7. User is now       │                       │
         │  authenticated        │                       │
         └───────────────────────┴───────────────────────┘
```

---

## Step-by-Step Implementation

### Step 1: Open Authentication URL in Browser

When user initiates sign-in from the desktop app, open the following URL in their default browser:

**Authentication URL:**

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000/auth/sign-in?source=desktop` |
| Production | `https://web.openanalyst.com/auth/sign-in?source=desktop` |

The `?source=desktop` query parameter is **required** - it tells the backend to:
- Generate tokens with extended expiry (30 days)
- Return a custom protocol callback URL
- Include desktop-specific claims in the JWT

---

### Step 2: Register Custom Protocol Handler

Your desktop application must register a handler for the `openanalyst://` custom protocol scheme.

**Protocol Scheme:** `openanalyst`

The application must handle URLs in the format:
- Success: `openanalyst://auth-callback?token=<JWT_TOKEN>`
- Error: `openanalyst://auth-error?error=<ERROR_MESSAGE>&code=<ERROR_CODE>`
- Logout: `openanalyst://logout-complete`
- Token Refresh: `openanalyst://token-refreshed?token=<NEW_TOKEN>`

---

### Step 3: Handle Authentication Callback

When the user successfully authenticates, the browser will redirect to:

```
openanalyst://auth-callback?token=<CALLBACK_JWT>
```

**Important:** The `token` parameter is a **callback JWT** that contains the complete authentication data. Your application should:

1. Parse the URL to extract the `token` parameter
2. URL-decode the token value
3. **Decode the JWT** to extract the payload (see [Callback JWT Payload Structure](#callback-jwt-payload-structure))
4. Extract `accessToken`, `refreshToken`, user data, and organizations from the payload
5. Store the `accessToken` and `refreshToken` securely
6. Update the UI to show authenticated state

---

## Custom Protocol Scheme

### Protocol Details

| Property | Value |
|----------|-------|
| Scheme | `openanalyst` |
| Success Path | `/auth-callback` |
| Error Path | `/auth-error` |
| Logout Path | `/logout-complete` |
| Token Refresh Path | `/token-refreshed` |

### Callback URLs

**Success Callback:**
```
openanalyst://auth-callback?token=<URL_ENCODED_JWT_TOKEN>
```

**Error Callback:**
```
openanalyst://auth-error?error=<URL_ENCODED_ERROR_MESSAGE>&code=<ERROR_CODE>
```

**Logout Callback:**
```
openanalyst://logout-complete
```

**Token Refresh Callback:**
```
openanalyst://token-refreshed?token=<URL_ENCODED_NEW_TOKEN>
```

---

## Callback URL Format

### Success Response

After successful authentication, the browser redirects to a success page at:

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000/auth/desktop-success?callbackUrl=<ENCODED_CALLBACK_URL>` |
| Production | `https://web.openanalyst.com/auth/desktop-success?callbackUrl=<ENCODED_CALLBACK_URL>` |

The page displays:
- "Authentication Successful!" message
- "Open OpenAnalyst" button
- **Immediately triggers** the browser's native "Open app?" dialog on page load

When the button is clicked (or auto-triggered), it opens:
```
openanalyst://auth-callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Extracting and Decoding the Callback JWT

The `token` parameter is a **Callback JWT** that contains the complete authentication response. Follow these steps:

1. **Extract from URL:** Get the `token` query parameter from the callback URL
2. **URL-decode:** Decode the URL-encoded token value
3. **Decode JWT:** Decode the JWT to get the payload (you can use `jwt-decode` or similar library)
4. **Extract tokens:** Get `data.accessToken` and `data.refreshToken` from the payload
5. **Store securely:** Save both tokens for API authentication

**Example:**
```
Input URL: openanalyst://auth-callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Extracted token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Decoded payload: See "Callback JWT Payload Structure" section below
```

---

## Callback JWT Payload Structure

The callback JWT contains the **complete authentication response**. When decoded, you get:

```json
{
  "success": true,
  "isNewUser": false,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 2592000,
    "user": {
      "_id": "675e9a1b2c3d4e5f6a7b8c9d",
      "email": "user@example.com",
      "fullName": "John Doe",
      "slug": "john-doe"
    },
    "organizations": [
      {
        "_id": "675e9a1b2c3d4e5f6a7b8c9e",
        "name": "My Company",
        "slug": "my-company",
        "role": "admin",
        "accountType": "individual"
      }
    ],
    "currentOrgId": "675e9a1b2c3d4e5f6a7b8c9e"
  },
  "iat": 1766523499,
  "exp": 1766523799,
  "iss": "pipeshub-desktop-callback"
}
```

### Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful auth |
| `isNewUser` | boolean | `true` if this is user's first login |
| `data.accessToken` | string | JWT for API authentication (30-day expiry) |
| `data.refreshToken` | string | JWT for token refresh (90-day expiry) |
| `data.expiresIn` | number | Access token expiry in seconds (2592000 = 30 days) |
| `data.user._id` | string | User's unique identifier |
| `data.user.email` | string | User's email address |
| `data.user.fullName` | string | User's display name |
| `data.user.slug` | string | User's URL-friendly identifier |
| `data.organizations` | array | List of organizations user belongs to |
| `data.organizations[]._id` | string | Organization ID |
| `data.organizations[].name` | string | Organization name |
| `data.organizations[].slug` | string | Organization URL-friendly identifier |
| `data.organizations[].role` | string | User's role: `admin` or `member` |
| `data.organizations[].accountType` | string | `individual` or `business` |
| `data.currentOrgId` | string | Currently selected organization ID |
| `iat` | number | Callback JWT issued timestamp |
| `exp` | number | Callback JWT expiry (5 minutes after issue) |
| `iss` | string | Issuer: `pipeshub-desktop-callback` |

**Note:** The callback JWT itself expires in 5 minutes (for security), but the `accessToken` inside has a 30-day expiry.

### Code Example (TypeScript/JavaScript)

```typescript
import { jwtDecode } from 'jwt-decode';

interface CallbackPayload {
  success: boolean;
  isNewUser: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: {
      _id: string;
      email: string;
      fullName: string;
      slug: string;
    };
    organizations: Array<{
      _id: string;
      name: string;
      slug: string;
      role: 'admin' | 'member';
      accountType: 'individual' | 'business';
    }>;
    currentOrgId: string;
  };
}

function handleAuthCallback(callbackUrl: string) {
  // 1. Parse the callback URL
  const url = new URL(callbackUrl);
  const encodedToken = url.searchParams.get('token');

  if (!encodedToken) {
    throw new Error('No token found in callback URL');
  }

  // 2. URL-decode the token
  const callbackJwt = decodeURIComponent(encodedToken);

  // 3. Decode the JWT to get payload
  const payload = jwtDecode<CallbackPayload>(callbackJwt);

  // 4. Extract tokens and user data
  const { accessToken, refreshToken, user, organizations, currentOrgId } = payload.data;
  const { isNewUser } = payload;

  // 5. Store tokens securely
  await secureStorage.set('accessToken', accessToken);
  await secureStorage.set('refreshToken', refreshToken);

  // 6. Use user and organization data
  console.log(`Welcome ${user.fullName}!`);
  console.log(`Organizations: ${organizations.map(o => o.name).join(', ')}`);

  return { accessToken, refreshToken, user, organizations, currentOrgId, isNewUser };
}
```

---

## Token Details

### Access Token

| Property | Value |
|----------|-------|
| Type | JWT (JSON Web Token) |
| Expiry | 30 days (720 hours) |
| Issuer | `pipeshub-desktop` |

### Token Payload Structure

The decoded JWT payload contains:

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Unique user identifier |
| `orgId` | string | Organization identifier |
| `email` | string | User's email address |
| `fullName` | string | User's full name |
| `firstName` | string | User's first name |
| `lastName` | string | User's last name |
| `accountType` | string | Account type: `individual` or `business` |
| `authSource` | string | Always `desktop` for desktop tokens |
| `iat` | number | Issued at timestamp (Unix) |
| `exp` | number | Expiration timestamp (Unix) |
| `iss` | string | Issuer: `pipeshub-desktop` |

### Example Decoded Token

```json
{
  "userId": "694af7ae7dd416c8c64518f1",
  "orgId": "694af7ae7dd416c8c64518f0",
  "email": "user@example.com",
  "fullName": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  "accountType": "individual",
  "authSource": "desktop",
  "iat": 1766523499,
  "exp": 1769115499,
  "iss": "pipeshub-desktop"
}
```

### Refresh Token

| Property | Value |
|----------|-------|
| Type | JWT |
| Expiry | 90 days (2160 hours) |
| Issuer | `pipeshub-desktop` |
| Scopes | `token:refresh` |

**Note:** Both access token and refresh token are included in the callback JWT payload (see [Callback JWT Payload Structure](#callback-jwt-payload-structure) above). Decode the callback JWT to access both tokens.

---

## API Authentication

### Making Authenticated Requests

Include the access token in the `Authorization` header for all API requests:

```
Authorization: Bearer <ACCESS_TOKEN>
```

### API Base URL

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:3000/api/v1/` |
| Production | `https://web.openanalyst.com/api/v1/` |

### OpenAnalyst-Specific Endpoints

These endpoints are specifically designed for the desktop extension:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/openanalyst/health` | Health check |
| GET | `/api/v1/openanalyst/providers` | List AI provider profiles |
| GET | `/api/v1/openanalyst/providers/:id` | Get specific provider |
| GET | `/api/v1/openanalyst/providers/:id/api-key` | Get decrypted API key |
| POST | `/api/v1/openanalyst/providers` | Create new AI provider |
| PUT | `/api/v1/openanalyst/providers/:id` | Update AI provider |
| POST | `/api/v1/openanalyst/providers/:id/test` | Test provider connection |
| DELETE | `/api/v1/openanalyst/providers/:id` | Delete AI provider |
| GET | `/api/v1/openanalyst/settings` | Get extension settings |
| PUT | `/api/v1/openanalyst/settings` | Update extension settings |
| POST | `/api/v1/openanalyst/settings/reset` | Reset settings to defaults |
| PUT | `/api/v1/openanalyst/settings/sync` | Sync settings |
| GET | `/api/v1/openanalyst/user/profile` | Get current user profile |

### Example Request

**Development:**
```http
GET http://localhost:3000/api/v1/users/<userId>
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Production:**
```http
GET https://web.openanalyst.com/api/v1/users/<userId>
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

## Error Handling

### Error Callback Format

When authentication fails, the browser may redirect to:
```
openanalyst://auth-error?error=<URL_ENCODED_ERROR>&code=<ERROR_CODE>
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Wrong email or password |
| `USER_NOT_FOUND` | User account doesn't exist |
| `ACCOUNT_LOCKED` | Account temporarily locked |
| `SESSION_EXPIRED` | Authentication session expired |
| `NETWORK_ERROR` | Connection issues |

### Handling Errors

1. Parse the error callback URL
2. URL-decode the `error` parameter
3. Display appropriate message to user
4. Provide option to retry authentication

---

## Token Refresh

### When to Refresh

- Before the access token expires (check `exp` claim)
- Recommended: Refresh when less than 1 day remaining
- On receiving 401 Unauthorized response

### Refresh Endpoint

| Environment | URL |
|-------------|-----|
| Development | `POST http://localhost:3000/api/v1/userAccount/refresh-token` |
| Production | `POST https://web.openanalyst.com/api/v1/userAccount/refresh-token` |

**Headers:**
```
Authorization: Bearer <REFRESH_TOKEN>
Content-Type: application/json
```

### Response

Success response will include new tokens. The callback URL format (if applicable):
```
openanalyst://token-refreshed?token=<NEW_ACCESS_TOKEN>
```

---

## Logout

### Logout Flow

1. Clear stored tokens from desktop application
2. Optionally call logout endpoint to invalidate server-side session
3. Handle `openanalyst://logout-complete` callback if redirected from web

### Logout Endpoint

| Environment | URL |
|-------------|-----|
| Development | `POST http://localhost:3000/api/v1/userAccount/logout` |
| Production | `POST https://web.openanalyst.com/api/v1/userAccount/logout` |

**Headers:**
```
Authorization: Bearer <ACCESS_TOKEN>
```

---

## Security Considerations

1. **Token Storage:** Store tokens securely using the operating system's secure storage (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux)

2. **Token Validation:** Always validate the JWT signature and expiration before using

3. **HTTPS Only:** Always use HTTPS in production for API calls

4. **Protocol Handler Security:** Ensure your protocol handler validates the origin of incoming URLs

5. **Clear on Logout:** Remove all stored tokens when user logs out

---

## Quick Reference

### URLs (Production)

| Purpose | URL |
|---------|-----|
| Sign In | `https://web.openanalyst.com/auth/sign-in?source=desktop` |
| API Base | `https://web.openanalyst.com/api/v1/` |
| OpenAnalyst API | `https://web.openanalyst.com/api/v1/openanalyst/` |

### URLs (Development)

| Purpose | URL |
|---------|-----|
| Sign In | `http://localhost:3000/auth/sign-in?source=desktop` |
| API Base | `http://localhost:3000/api/v1/` |
| OpenAnalyst API | `http://localhost:3000/api/v1/openanalyst/` |

### Callback URLs

| Event | Callback URL |
|-------|-------------|
| Success | `openanalyst://auth-callback?token=<TOKEN>` |
| Error | `openanalyst://auth-error?error=<MSG>&code=<CODE>` |
| Logout | `openanalyst://logout-complete` |
| Refresh | `openanalyst://token-refreshed?token=<TOKEN>` |

### Token Expiry

| Token Type | Expiry |
|------------|--------|
| Access Token | 30 days |
| Refresh Token | 90 days |

---

## Support

For questions or issues with desktop OAuth integration, contact the backend team or open an issue in the repository.
