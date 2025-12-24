# Desktop OAuth Integration Guide

This document provides complete integration details for desktop application developers (VSCode Extension / OpenAnalyst) to implement OAuth authentication with PipesHub.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Custom Protocol Scheme](#custom-protocol-scheme)
5. [Callback URL Format](#callback-url-format)
6. [Token Details](#token-details)
7. [API Authentication](#api-authentication)
8. [Error Handling](#error-handling)
9. [Token Refresh](#token-refresh)
10. [Logout](#logout)

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
```
https://<your-domain>/auth/sign-in?source=desktop
```

**Development:**
```
http://localhost:3000/auth/sign-in?source=desktop
```

**Production:**
```
https://web.openanalyst.com/auth/sign-in?source=desktop
```

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
openanalyst://auth-callback?token=<JWT_ACCESS_TOKEN>
```

Your application should:
1. Parse the URL to extract the `token` parameter
2. URL-decode the token value
3. Store the token securely
4. Update the UI to show authenticated state

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
```
https://<domain>/auth/desktop-success?callbackUrl=<ENCODED_CALLBACK_URL>
```

The page displays:
- "Authentication Successful!" message
- "Open OpenAnalyst" button
- **Immediately triggers** the browser's native "Open app?" dialog on page load

When the button is clicked (or auto-triggered), it opens:
```
openanalyst://auth-callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Extracting the Token

The token is URL-encoded. After extracting from the URL:

1. Get the `token` query parameter
2. URL-decode the value
3. The result is a valid JWT

**Example:**
```
Input URL: openanalyst://auth-callback?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Extracted token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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

**Note:** The refresh token is included in the API response but not in the callback URL by default. If you need both tokens in the callback URL, contact the backend team to enable `getSuccessCallbackUrlWithTokens`.

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

### Example Request Headers

```
GET /api/v1/user/profile
Host: web.openanalyst.com
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

```
POST /api/v1/userAccount/refresh-token
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

```
POST /api/v1/userAccount/logout
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

### URLs

| Purpose | URL |
|---------|-----|
| Sign In | `https://<domain>/auth/sign-in?source=desktop` |
| API Base | `https://<domain>/api/v1/` |

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
