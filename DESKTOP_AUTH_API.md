# Desktop Authentication API Documentation

**Version:** 1.0.0
**Base URL:** `https://web.openanalyst.com`
**Last Updated:** December 22, 2025

---

## Table of Contents
1. [Overview](#overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Request/Response Examples](#requestresponse-examples)
4. [Error Codes](#error-codes)
5. [Token Management](#token-management)
6. [Security & Rate Limiting](#security--rate-limiting)
7. [Integration Guide](#integration-guide)

---

## Overview

This API provides authentication endpoints for desktop code editor applications to integrate with PipesHub. All endpoints return JSON responses and use JWT tokens for session management.

**Key Features:**
- Email/password authentication
- JWT token-based sessions
- Multi-organization support
- Automatic organization and project creation on signup
- Refresh token support for long-lived sessions
- Rate limiting for security

---

## Authentication Endpoints

### 1. Sign Up

Create a new user account with organization and default project.

**Endpoint:** `POST /api/v1/desktop/auth/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "fullName": "John Doe",
  "organizationName": "My Company",
  "accountType": "individual"
}
```

**Parameters:**

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| email | string | ✅ Required | User's email address | Valid email format |
| password | string | ✅ Required | User's password | Min 8 chars, uppercase, lowercase, number, special char |
| fullName | string | ✅ Required | User's full name | Non-empty string |
| organizationName | string | ✅ Required | Name for the organization to be created | Non-empty string |
| accountType | string | ❌ Optional | Type of account | "individual" or "business" (default: "individual") |

**Success Response (201 Created):**
```json
{
  "success": true,
  "isNewUser": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
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
        "role": "owner",
        "accountType": "individual"
      }
    ],
    "currentOrgId": "675e9a1b2c3d4e5f6a7b8c9e"
  }
}
```

**What Happens on Signup:**
1. Validates email and password
2. Creates new user account
3. Creates new organization with specified name
4. Creates default "General" project
5. Makes user the owner of the organization
6. Returns JWT tokens for immediate use

---

### 2. Sign In

Authenticate an existing user.

**Endpoint:** `POST /api/v1/desktop/auth/signin`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | ✅ Required | User's email address |
| password | string | ✅ Required | User's password |

**Success Response (200 OK):**
```json
{
  "success": true,
  "isNewUser": false,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
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
        "role": "owner",
        "accountType": "individual"
      },
      {
        "_id": "675e9a1b2c3d4e5f6a7b8c9f",
        "name": "Team Project",
        "slug": "team-project",
        "role": "member",
        "accountType": "business"
      }
    ],
    "currentOrgId": "675e9a1b2c3d4e5f6a7b8c9e"
  }
}
```

**What Happens on Signin:**
1. Validates credentials
2. Retrieves all user's organizations
3. Determines user's role in each organization
4. Returns JWT tokens with current organization context

---

### 3. Refresh Token

Get a new access token using a refresh token.

**Endpoint:** `POST /api/v1/desktop/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| refreshToken | string | ✅ Required | The refresh token received from signup/signin |

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

**When to Refresh:**
- When access token expires (API returns 401)
- Proactively before expiry (recommended: at 50 minutes)
- On desktop app startup if stored token is old

---

## Request/Response Examples

### cURL Examples

**Signup:**
```bash
curl -X POST https://web.openanalyst.com/api/v1/desktop/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe",
    "organizationName": "Acme Corp",
    "accountType": "business"
  }'
```

**Signin:**
```bash
curl -X POST https://web.openanalyst.com/api/v1/desktop/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Refresh:**
```bash
curl -X POST https://web.openanalyst.com/api/v1/desktop/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### JavaScript/TypeScript Examples

```typescript
// Signup
async function signup(email: string, password: string, fullName: string, organizationName: string) {
  const response = await fetch('https://web.openanalyst.com/api/v1/desktop/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      fullName,
      organizationName,
      accountType: 'individual'
    })
  });

  const data = await response.json();

  if (data.success) {
    // Store tokens securely
    secureStorage.setItem('accessToken', data.data.accessToken);
    secureStorage.setItem('refreshToken', data.data.refreshToken);

    // User is new - show welcome flow
    if (data.isNewUser) {
      showWelcomeScreen();
    }

    return data.data;
  } else {
    throw new Error(data.message);
  }
}

// Signin
async function signin(email: string, password: string) {
  const response = await fetch('https://web.openanalyst.com/api/v1/desktop/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (data.success) {
    secureStorage.setItem('accessToken', data.data.accessToken);
    secureStorage.setItem('refreshToken', data.data.refreshToken);
    return data.data;
  } else {
    throw new Error(data.message);
  }
}

// Refresh Token
async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://web.openanalyst.com/api/v1/desktop/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  const data = await response.json();

  if (data.success) {
    secureStorage.setItem('accessToken', data.data.accessToken);
    return data.data.accessToken;
  } else {
    // Refresh token expired - user needs to login again
    redirectToLogin();
    throw new Error(data.message);
  }
}

// Use Access Token in API Calls
async function makeAuthenticatedRequest(endpoint: string) {
  const accessToken = secureStorage.getItem('accessToken');

  const response = await fetch(`https://web.openanalyst.com${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Handle 401 - token expired
  if (response.status === 401) {
    const refreshToken = secureStorage.getItem('refreshToken');
    await refreshAccessToken(refreshToken);
    // Retry request with new token
    return makeAuthenticatedRequest(endpoint);
  }

  return response.json();
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| 200 | OK | Successful signin or refresh |
| 201 | Created | Successful signup - new user created |
| 400 | Bad Request | Invalid input (missing fields, weak password) |
| 401 | Unauthorized | Invalid credentials or expired token |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error (rare) |

### Application Error Codes

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| `BAD_REQUEST` | 400 | Missing required fields | Check request body has all required fields |
| `BAD_REQUEST` | 400 | Weak password | Use stronger password (see requirements) |
| `BAD_REQUEST` | 400 | Email already registered | User should signin instead or use different email |
| `UNAUTHORIZED` | 401 | Invalid credentials | Check email/password are correct |
| `UNAUTHORIZED` | 401 | Invalid refresh token | User needs to login again |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded | Wait before retrying |

---

## Token Management

### Token Structure

**Access Token:**
- **Purpose:** Authenticate API requests
- **Expiry:** 1 hour (3600 seconds)
- **Usage:** Include in `Authorization` header as `Bearer {token}`
- **Contains:** userId, email, orgId, orgSlug

**Refresh Token:**
- **Purpose:** Get new access tokens
- **Expiry:** 7 days
- **Usage:** Send to `/refresh` endpoint when access token expires
- **Contains:** userId

### Token Lifecycle

```
1. User Signs Up/In
   → Receive: accessToken + refreshToken
   → Store both securely

2. Make API Calls
   → Use: accessToken in Authorization header
   → Duration: 1 hour

3. Token Expires (after 1 hour)
   → API returns: 401 Unauthorized
   → Call: /refresh endpoint with refreshToken
   → Receive: new accessToken

4. Refresh Token Expires (after 7 days)
   → /refresh returns: 401 error
   → User must: Login again
```

### Recommended Token Storage

```typescript
// Good - Use OS secure storage
import keytar from 'keytar';  // Node.js keychain library

await keytar.setPassword('pipeshub-desktop', 'accessToken', token);
const token = await keytar.getPassword('pipeshub-desktop', 'accessToken');

// Bad - Plain text
localStorage.setItem('token', token);  // ❌ Not secure
fs.writeFileSync('token.txt', token);  // ❌ Not secure
```

---

## Security & Rate Limiting

### Password Requirements

Passwords must contain:
- ✅ Minimum 8 characters
- ✅ At least 1 uppercase letter (A-Z)
- ✅ At least 1 lowercase letter (a-z)
- ✅ At least 1 number (0-9)
- ✅ At least 1 special character (!@#$%^&*()_+{}[]|:;<>?,./~`)

**Examples:**
- ✅ `SecurePass123!`
- ✅ `MyP@ssw0rd`
- ❌ `password` (no uppercase, no number, no special)
- ❌ `Pass123` (too short, no special)
- ❌ `PASSWORD123!` (no lowercase)

### Rate Limits

| Endpoint | Limit | Window | What Happens When Exceeded |
|----------|-------|--------|----------------------------|
| `/signup` | 5 requests | 1 hour | 429 error, retry after 1 hour |
| `/signin` | 5 requests | 15 minutes | 429 error, retry after 15 minutes |
| `/refresh` | 10 requests | 1 minute | 429 error, retry after 1 minute |

**Rate Limit Headers:**
```
RateLimit-Limit: 5
RateLimit-Remaining: 4
RateLimit-Reset: 900
```

### Security Best Practices

1. **Store tokens securely** - Use OS keychain/credential manager
2. **HTTPS only** - Never send credentials over HTTP
3. **Clear tokens on logout** - Don't leave tokens in storage
4. **Handle 401 errors** - Refresh token or prompt login
5. **Implement retry logic** - With exponential backoff for rate limits

---

## Integration Guide

### Step 1: Implement Login Flow

```typescript
class AuthManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async signup(email: string, password: string, fullName: string, orgName: string) {
    const response = await fetch('https://web.openanalyst.com/api/v1/desktop/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        fullName,
        organizationName: orgName
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    // Store tokens
    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken;
    await this.saveTokensSecurely();

    return data;
  }

  async signin(email: string, password: string) {
    const response = await fetch('https://web.openanalyst.com/api/v1/desktop/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken;
    await this.saveTokensSecurely();

    return data;
  }

  async refresh() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://web.openanalyst.com/api/v1/desktop/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    const data = await response.json();

    if (!data.success) {
      // Refresh token expired - user needs to login again
      await this.clearTokens();
      throw new Error('Session expired. Please login again.');
    }

    this.accessToken = data.data.accessToken;
    await this.saveTokensSecurely();

    return data.data.accessToken;
  }

  async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}) {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };

    let response = await fetch(`https://web.openanalyst.com${endpoint}`, {
      ...options,
      headers
    });

    // If 401, try to refresh
    if (response.status === 401) {
      try {
        await this.refresh();
        // Retry with new token
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`https://web.openanalyst.com${endpoint}`, {
          ...options,
          headers
        });
      } catch (error) {
        // Refresh failed - redirect to login
        this.onAuthenticationFailed();
        throw error;
      }
    }

    return response.json();
  }

  private async saveTokensSecurely() {
    // Use OS keychain
    await keytar.setPassword('pipeshub', 'accessToken', this.accessToken!);
    await keytar.setPassword('pipeshub', 'refreshToken', this.refreshToken!);
  }

  private async loadTokens() {
    this.accessToken = await keytar.getPassword('pipeshub', 'accessToken');
    this.refreshToken = await keytar.getPassword('pipeshub', 'refreshToken');
  }

  private async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    await keytar.deletePassword('pipeshub', 'accessToken');
    await keytar.deletePassword('pipeshub', 'refreshToken');
  }

  private onAuthenticationFailed() {
    // Show login screen
    this.clearTokens();
  }
}
```

### Step 2: Handle Multi-Organization

```typescript
class OrganizationManager {
  private currentOrgId: string;
  private organizations: any[];

  setFromAuthResponse(authData: any) {
    this.organizations = authData.data.organizations;
    this.currentOrgId = authData.data.currentOrgId;
  }

  getCurrentOrg() {
    return this.organizations.find(org => org._id === this.currentOrgId);
  }

  getAllOrganizations() {
    return this.organizations;
  }

  // If you want to switch organizations later, you can call:
  // POST /api/v1/organizations/switch/:orgId
}
```

### Step 3: Error Handling

```typescript
async function handleAuthError(error: any) {
  if (error.error === 'TOO_MANY_REQUESTS') {
    showNotification('Too many attempts. Please wait and try again.');
  } else if (error.error === 'UNAUTHORIZED') {
    showNotification('Invalid email or password');
  } else if (error.error === 'BAD_REQUEST') {
    showNotification(error.message);  // Show specific validation error
  } else {
    showNotification('An error occurred. Please try again.');
  }
}
```

---

## Response Fields Reference

### User Object

| Field | Type | Description |
|-------|------|-------------|
| _id | string | Unique user identifier (MongoDB ObjectId) |
| email | string | User's email address |
| fullName | string | User's full name |
| slug | string | URL-friendly username (auto-generated) |

### Organization Object

| Field | Type | Description |
|-------|------|-------------|
| _id | string | Unique organization identifier |
| name | string | Organization name |
| slug | string | URL-friendly organization name |
| role | string | User's role: "owner", "admin", or "member" |
| accountType | string | "individual" or "business" |

### Auth Data Object

| Field | Type | Description |
|-------|------|-------------|
| accessToken | string | JWT token for API authentication (1 hour expiry) |
| refreshToken | string | JWT token for getting new access tokens (7 days expiry) |
| expiresIn | number | Seconds until access token expires (3600 = 1 hour) |
| user | object | User information |
| organizations | array | All organizations user belongs to |
| currentOrgId | string | Current organization context |

### isNewUser Flag

| Value | Meaning | Use Case |
|-------|---------|----------|
| `true` | User account just created | Show onboarding/welcome screen |
| `false` | User account already existed | Regular login flow |

---

## Testing Checklist

Before going to production, test:

- [ ] Signup with valid data → 201 response
- [ ] Signup with duplicate email → 400 error
- [ ] Signup with weak password → 400 error
- [ ] Signin with correct credentials → 200 response
- [ ] Signin with wrong password → 401 error
- [ ] Signin with non-existent email → 401 error
- [ ] Refresh with valid token → 200 response
- [ ] Refresh with invalid token → 401 error
- [ ] Refresh with expired token → 401 error
- [ ] Rate limiting triggers after limit exceeded → 429 error
- [ ] Access token works for authenticated endpoints
- [ ] isNewUser flag is correct (true for signup, false for signin)
- [ ] Multiple organizations returned for users with multiple orgs

---

## Support & Contact

**GitHub Repository:** https://github.com/AnantBisht-ops/pipeshub-ai
**Branch:** `feature/desktop-auth`
**Issues:** https://github.com/AnantBisht-ops/pipeshub-ai/issues

---

## Changelog

### Version 1.0.0 (December 22, 2025)
- Initial release
- Signup, Signin, Refresh endpoints
- JWT token authentication
- Multi-organization support
- isNewUser flag implementation
- Rate limiting
- Password validation
