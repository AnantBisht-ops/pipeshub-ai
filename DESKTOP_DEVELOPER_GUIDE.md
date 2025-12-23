# OpenAnalyst Desktop Extension - Developer Guide

Complete integration guide for desktop developers to implement OpenAnalyst authentication using the `?source=extension` parameter.

**Date:** 2025-12-23
**Branch:** feature/desktop-oauth-flow
**Production URL:** https://web.openanalyst.com

---

## Table of Contents

- [Quick Overview](#quick-overview)
- [Authentication Flow](#authentication-flow)
- [URLs and Endpoints](#urls-and-endpoints)
- [Step-by-Step Implementation](#step-by-step-implementation)
- [JWT Token Details](#jwt-token-details)
- [Frontend Requirements](#frontend-requirements)
- [Code Examples](#code-examples)
- [Testing](#testing)
- [Common Issues](#common-issues)

---

## Quick Overview

### What You Need to Build

Your desktop app needs to:

1. **Open browser** to OpenAnalyst web signin with `?source=extension` parameter
2. **Register protocol handler** for `openanalyst://` URLs
3. **Receive callback** when user completes authentication
4. **Decode JWT token** to get access tokens and user data
5. **Store tokens securely** and use for API calls

### What Backend Provides

- ✅ Authentication success page with "Open OpenAnalyst" button
- ✅ Auto-popup of `openanalyst://auth/callback?token=JWT` after 1.5 seconds
- ✅ JWT token containing: access token, refresh token, user data, ALL organizations
- ✅ Multi-organization support (users can belong to multiple orgs)

---

## Authentication Flow

```
Desktop App                        Browser                      Backend
    │                                 │                            │
    │  1. Open browser with          │                            │
    │     ?source=extension           │                            │
    ├────────────────────────────────>│                            │
    │                                 │                            │
    │                                 │  2. User enters            │
    │                                 │     credentials            │
    │                                 ├───────────────────────────>│
    │                                 │                            │
    │                                 │  3. Backend detects        │
    │                                 │     source=extension       │
    │                                 │     in session             │
    │                                 │                            │
    │                                 │  4. Returns HTML page      │
    │                                 │     with success message   │
    │                                 │<───────────────────────────┤
    │                                 │                            │
    │                                 │  5. Page shows:            │
    │                                 │     ✓ Success              │
    │                                 │     "Open OpenAnalyst"     │
    │                                 │     Auto-popup             │
    │                                 │                            │
    │  6. Protocol triggers           │                            │
    │     openanalyst://              │                            │
    │<────────────────────────────────┤                            │
    │                                 │                            │
    │  7. Desktop app opens           │                            │
    │     Decodes JWT token           │                            │
    │     Stores auth data            │                            │
    │                                 │                            │
    ▼                                 ▼                            ▼
```

---

## URLs and Endpoints

### Authentication URLs (Browser-Based)

**Sign In (Extension):**
```
https://web.openanalyst.com/?source=extension
```
Then user clicks "Sign In" button on the page.

**Sign Up (Extension):**
```
https://web.openanalyst.com/?source=extension
```
Then user clicks "Sign Up" button on the page.

**Important:** The `?source=extension` parameter must be present in the initial URL for the backend to detect it's a desktop/extension request.

---

### What Happens After Authentication

After successful authentication, the browser shows an HTML page with:

**Title:** "Authentication Successful!"

**Content:**
- Green checkmark (✓)
- Message: "You have successfully signed in to OpenAnalyst. Click the button below to open the desktop application."
- Big "Open OpenAnalyst" button
- Info box: "Desktop App Required"
- Auto-redirect after 1.5 seconds

**Callback URL:**
```
openanalyst://auth/callback?token={JWT_TOKEN}
```

This triggers your desktop app's protocol handler.

---

### API Endpoints (For Reference)

These are the backend endpoints your app indirectly uses through the browser flow:

**Initialize Authentication:**
```
POST /api/v1/userAccount/initAuth?source=extension
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Authenticate:**
```
POST /api/v1/userAccount/authenticate
Headers:
  x-session-token: {SESSION_TOKEN_FROM_INIT}
  Content-Type: application/json

{
  "method": "password",
  "credentials": {
    "password": "userPassword123"
  }
}
```

**Response (if source=extension):**
- Content-Type: text/html
- HTML page with redirect to `openanalyst://auth/callback?token=...`

**Response (if no source - normal web):**
- Content-Type: application/json
- JSON with `{ accessToken, refreshToken }`

---

### Refresh Token Endpoint

When access token expires, use refresh token to get a new one:

```
POST /api/v1/userAccount/refresh/token
Headers:
  Authorization: Bearer {REFRESH_TOKEN}

Response:
{
  "user": { ... },
  "accessToken": "new_access_token_here"
}
```

---

## Step-by-Step Implementation

### Step 1: Register Custom Protocol Handler

**Required:** Your app MUST register `openanalyst://` protocol before authentication will work.

**Electron (Windows):**
```javascript
const { app } = require('electron');

// Register protocol
app.setAsDefaultProtocolClient('openanalyst');

// Handle second instance (Windows)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.pop();
    if (url?.startsWith('openanalyst://')) {
      handleAuthCallback(url);
    }
  });
}
```

**Electron (macOS):**
```javascript
app.setAsDefaultProtocolClient('openanalyst');

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});
```

---

### Step 2: Trigger Authentication

When user clicks "Sign In" in your desktop app:

```typescript
import { shell } from 'electron';

function openLogin() {
  // IMPORTANT: Must include ?source=extension
  const authUrl = 'https://web.openanalyst.com/?source=extension';

  shell.openExternal(authUrl);

  // Desktop app now waits for callback via protocol handler
}
```

---

### Step 3: Handle Protocol Callback

```typescript
function handleAuthCallback(url: string) {
  try {
    // URL format: openanalyst://auth/callback?token=JWT_TOKEN
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');

    if (!token) {
      console.error('No token in callback URL');
      showError('Authentication failed: No token received');
      return;
    }

    // Decode the JWT token
    const authData = decodeAuthToken(token);

    // Store authentication data
    storeAuthData(authData);

    // Update UI
    if (mainWindow) {
      mainWindow.webContents.send('auth-success', {
        user: authData.user,
        organizations: authData.organizations,
        isNewUser: authData.isNewUser
      });
    }

    // Focus main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    console.log('✅ Authentication successful!');

  } catch (error) {
    console.error('Auth callback error:', error);
    showError('Authentication failed: ' + error.message);
  }
}
```

---

### Step 4: Decode JWT Token

```typescript
import jwt from 'jsonwebtoken';

// CRITICAL: Get this secret from backend team
const JWT_SECRET = process.env.OPENANALYST_JWT_SECRET!;

interface Organization {
  id: string;
  slug: string;
  name: string;
  registeredName: string;
  accountType: 'individual' | 'business';
  role: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
}

interface AuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;          // 3600 seconds (1 hour)
  user: User;
  organizations: Organization[]; // Array of ALL organizations user belongs to
  currentOrgId: string;
  isNewUser: boolean;         // true for signup, false for signin
}

function decodeAuthToken(token: string): AuthData {
  try {
    // Verify and decode JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    return {
      accessToken: decoded.accessToken,
      refreshToken: decoded.refreshToken,
      expiresIn: decoded.expiresIn,
      user: decoded.user,
      organizations: decoded.organizations,
      currentOrgId: decoded.currentOrgId,
      isNewUser: decoded.isNewUser,
    };
  } catch (error) {
    throw new Error('Invalid authentication token: ' + error.message);
  }
}
```

---

### Step 5: Store Auth Data Securely

```typescript
import Store from 'electron-store';

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: User;
  organizations: Organization[];
  currentOrgId: string;
}

const store = new Store<{ auth: StoredAuth | null }>({
  name: 'openanalyst-auth',
  encryptionKey: 'your-secure-encryption-key-min-16-chars',
});

class AuthStorage {
  static save(authData: AuthData) {
    const expiresAt = Date.now() + (authData.expiresIn * 1000);

    store.set('auth', {
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      expiresAt,
      user: authData.user,
      organizations: authData.organizations,
      currentOrgId: authData.currentOrgId,
    });
  }

  static get(): StoredAuth | null {
    return store.get('auth', null);
  }

  static clear() {
    store.delete('auth');
  }

  static isExpired(): boolean {
    const auth = this.get();
    if (!auth) return true;
    return Date.now() >= auth.expiresAt;
  }

  static getAccessToken(): string | null {
    const auth = this.get();
    if (!auth || this.isExpired()) return null;
    return auth.accessToken;
  }
}
```

---

### Step 6: Make API Calls

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://web.openanalyst.com/api/v1',
});

// Add auth header to all requests
apiClient.interceptors.request.use((config) => {
  const token = AuthStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;

      // Try to refresh token
      const auth = AuthStorage.get();
      if (auth?.refreshToken) {
        try {
          const response = await axios.post(
            'https://web.openanalyst.com/api/v1/userAccount/refresh/token',
            {},
            { headers: { Authorization: `Bearer ${auth.refreshToken}` } }
          );

          // Update token
          AuthStorage.save({
            ...auth,
            accessToken: response.data.accessToken,
            expiresIn: 3600,
          });

          // Retry original request
          error.config.headers.Authorization = `Bearer ${response.data.accessToken}`;
          return axios.request(error.config);
        } catch (refreshError) {
          // Refresh failed - logout
          AuthStorage.clear();
          // Trigger re-login UI
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## JWT Token Details

### Token Structure

The JWT token you receive contains:

```typescript
{
  // Authentication Tokens
  accessToken: "eyJhbGc...",     // Use for API calls (valid 1 hour)
  refreshToken: "eyJhbGc...",    // Use to get new access token (valid 30 days)
  expiresIn: 3600,              // Seconds until access token expires

  // User Information
  user: {
    id: "694a54143443da94dad024eb",
    email: "user@example.com",
    fullName: "John Doe",
    firstName: "John",
    lastName: "Doe"
  },

  // Organizations (Can be multiple!)
  organizations: [
    {
      id: "694a54143443da94dad024ea",
      slug: "acme-corp",
      name: "Acme Corp",
      registeredName: "Acme Corporation Ltd",
      accountType: "business",
      role: "admin"
    },
    // User might belong to more organizations...
  ],

  // Current Context
  currentOrgId: "694a54143443da94dad024ea",
  isNewUser: false,              // true for signup, false for signin

  // JWT Metadata (auto-added)
  scopes: ["user:lookup"],
  iat: 1766489342,               // Issued at timestamp
  exp: 1766489642                // Expires at timestamp (5 min from issue)
}
```

### Important Notes

- **Callback Token Expiry:** 5 minutes - Decode it immediately!
- **Access Token Expiry:** 1 hour - Use for API calls
- **Refresh Token Expiry:** 30 days - Use to get new access tokens
- **Multiple Organizations:** Always an array, even if user has only one org

---

## Frontend Requirements

### ⚠️ Important: Frontend Team Needs to Preserve `?source` Parameter

**Current Issue:** When user opens `https://web.openanalyst.com/?source=extension`, React Router may strip the parameter during navigation.

**Frontend Fix Needed:**

The frontend auth code needs to:

1. **Capture** `?source=extension` from URL on page load
2. **Store** it (e.g., localStorage or state)
3. **Pass** it to `/api/v1/userAccount/initAuth?source=extension` when making API call

**Example Frontend Code (React):**

```typescript
// In auth page component
import { useSearchParams } from 'react-router-dom';

function AuthPage() {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source'); // Gets "extension"

  // When calling initAuth API:
  const initAuthUrl = source
    ? `/api/v1/userAccount/initAuth?source=${source}`
    : `/api/v1/userAccount/initAuth`;

  await fetch(initAuthUrl, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}
```

**Until frontend is updated:** Backend team can test using browser console injection (see Testing section).

---

## Code Examples

### Complete Electron Main Process

```typescript
// main.ts
import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { decodeAuthToken, AuthStorage } from './auth';

let mainWindow: BrowserWindow | null = null;

// ===== 1. Register Protocol =====
app.setAsDefaultProtocolClient('openanalyst');

// ===== 2. Handle Protocol Callback =====
function handleAuthCallback(url: string) {
  try {
    console.log('📱 Received callback:', url);

    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');

    if (!token) {
      console.error('❌ No token in URL');
      return;
    }

    // Decode JWT
    const authData = decodeAuthToken(token);

    // Store securely
    AuthStorage.save(authData);

    console.log('✅ Auth successful!');
    console.log(`   User: ${authData.user.email}`);
    console.log(`   Organizations: ${authData.organizations.length}`);
    console.log(`   Is new user: ${authData.isNewUser}`);

    // Notify renderer
    if (mainWindow) {
      mainWindow.webContents.send('auth-success', {
        user: authData.user,
        organizations: authData.organizations,
        currentOrgId: authData.currentOrgId,
        isNewUser: authData.isNewUser,
      });

      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

  } catch (error) {
    console.error('❌ Auth error:', error);
    if (mainWindow) {
      mainWindow.webContents.send('auth-error', {
        message: error.message,
      });
    }
  }
}

// ===== 3. Platform-Specific Handlers =====

// macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

// Windows/Linux
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.pop();
    if (url?.startsWith('openanalyst://')) {
      handleAuthCallback(url);
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });
}

// ===== 4. Create Window =====
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');
});

// ===== 5. Login Trigger =====
export function triggerLogin() {
  const authUrl = 'https://web.openanalyst.com/?source=extension';
  shell.openExternal(authUrl);
}
```

---

### Organization Switcher

Users can belong to multiple organizations. Show an org switcher in your UI:

```typescript
// renderer/OrgSwitcher.tsx
import { useState, useEffect } from 'react';

function OrganizationSwitcher() {
  const [orgs, setOrgs] = useState([]);
  const [currentOrgId, setCurrentOrgId] = useState('');

  useEffect(() => {
    // Get from electron store
    window.electronAPI.getAuth().then((auth) => {
      if (auth) {
        setOrgs(auth.organizations);
        setCurrentOrgId(auth.currentOrgId);
      }
    });
  }, []);

  const switchOrg = (orgId: string) => {
    window.electronAPI.setCurrentOrg(orgId);
    setCurrentOrgId(orgId);
    // Reload data for new org
    window.location.reload();
  };

  return (
    <select value={currentOrgId} onChange={(e) => switchOrg(e.target.value)}>
      {orgs.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name} ({org.accountType})
        </option>
      ))}
    </select>
  );
}
```

---

## Testing

### Test 1: Protocol Handler Registration

**Create test HTML file:**
```html
<a href="openanalyst://test">Test Protocol Handler</a>
```

Click it. Your app should open. If not, protocol handler isn't registered.

---

### Test 2: Full Authentication Flow

**Using Browser Console (Until Frontend is Updated):**

1. Open: `https://web.openanalyst.com/`
2. Press F12 (DevTools) → Console tab
3. Paste this code:

```javascript
// Inject source=extension into API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  let url = args[0];
  if (typeof url === 'string' && url.includes('/userAccount/initAuth')) {
    url = url + '?source=extension';
    args[0] = url;
  }
  return originalFetch.apply(this, args);
};
console.log('✅ Source=extension injected');
```

4. Sign in normally
5. After auth, you should see the desktop redirect page
6. Browser tries to open `openanalyst://auth/callback?token=...`
7. Your app should open and receive the token

---

### Test 3: Token Decoding

```typescript
const jwt = require('jsonwebtoken');

// For debugging - decode without verifying
const decoded = jwt.decode(token, { complete: true });

console.log('Token expires:', new Date(decoded.payload.exp * 1000));
console.log('Organizations:', decoded.payload.organizations);
console.log('User:', decoded.payload.user);
```

---

## Common Issues

### Issue 1: `?source=extension` parameter disappears

**Cause:** Frontend React Router not preserving URL parameters
**Status:** Frontend team needs to add parameter preservation
**Workaround:** Use browser console injection (see Testing section)

---

### Issue 2: Protocol handler not triggering

**Windows:**
```powershell
# Check registry
reg query HKCU\Software\Classes\openanalyst
```

**macOS:**
```bash
# Rebuild launch services
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user
```

**Linux:**
```bash
# Check .desktop file
cat ~/.local/share/applications/openanalyst.desktop

# Re-register
xdg-mime default openanalyst.desktop x-scheme-handler/openanalyst
```

---

### Issue 3: JWT decode error "Invalid signature"

**Cause:** Wrong JWT secret
**Fix:** Ask backend team for the correct `JWT_SECRET` from `.env` file

---

### Issue 4: Access token expired

**Solution:** Use refresh token:

```typescript
async function refreshAccessToken() {
  const auth = AuthStorage.get();

  const response = await axios.post(
    'https://web.openanalyst.com/api/v1/userAccount/refresh/token',
    {},
    { headers: { Authorization: `Bearer ${auth.refreshToken}` } }
  );

  AuthStorage.save({
    ...auth,
    accessToken: response.data.accessToken,
    expiresIn: 3600,
  });

  return response.data.accessToken;
}
```

---

## Required from Backend Team

### 1. JWT Secret

You MUST get the `JWT_SECRET` from the backend team. This is required to decode the callback token.

**Ask for:**
- `JWT_SECRET` value from `.env` file
- Confirm it's the same secret used in `desktopCallbackJwtGenerator()`

---

### 2. Frontend Update

Frontend team needs to preserve `?source=extension` parameter:

**Files to modify:**
- `frontend/src/auth/view/auth/authentication-view.tsx`
- `frontend/src/auth/context/jwt/auth-provider.tsx`

**Change needed:** Pass `?source=extension` to initAuth API call when present in URL.

---

## Summary for Desktop Developers

### What You Build:

1. ✅ Register `openanalyst://` protocol handler
2. ✅ Open browser to `https://web.openanalyst.com/?source=extension` when user clicks login
3. ✅ Handle protocol callback to receive JWT token
4. ✅ Decode JWT with `JWT_SECRET` (get from backend team)
5. ✅ Store tokens securely (electron-store with encryption)
6. ✅ Use access token for all API calls
7. ✅ Implement org switcher if user has multiple organizations
8. ✅ Auto-refresh tokens when expired

### What Backend Provides:

- ✅ Session-based authentication with `?source=extension` detection
- ✅ Beautiful HTML success page after auth
- ✅ Auto-popup + manual button to trigger `openanalyst://` callback
- ✅ JWT token with all user data and organizations
- ✅ Multi-organization support
- ✅ Refresh token endpoint

### What Frontend Needs to Add:

- ⚠️ Preserve `?source=extension` URL parameter
- ⚠️ Pass it to initAuth API call

---

## Next Steps

1. **Get JWT_SECRET** from backend team
2. **Implement protocol handler** (Step 1)
3. **Test protocol** with test HTML file
4. **Implement login trigger** (Step 2)
5. **Implement callback handler** (Step 3-4)
6. **Test end-to-end** using browser console method
7. **Coordinate with frontend team** for parameter preservation
8. **Final testing** once frontend is updated

---

## Support & Resources

- **GitHub Repo:** https://github.com/AnantBisht-ops/pipeshub-ai
- **Branch:** feature/desktop-oauth-flow
- **Backend Contact:** Backend team for JWT_SECRET and API questions
- **Frontend Contact:** Frontend team for `?source=extension` preservation

---

## API Reference

### Base URL
```
https://web.openanalyst.com/api/v1
```

### Authentication Endpoints

All authentication goes through the web browser flow. Your app doesn't call these directly - the browser does.

**For Desktop:**
- Open browser to: `https://web.openanalyst.com/?source=extension`
- User completes auth in browser
- Receive callback: `openanalyst://auth/callback?token=JWT`

### Using API with Access Token

**Example: Get User Projects**
```bash
GET /projects
Headers:
  Authorization: Bearer {ACCESS_TOKEN}

Response:
{
  "projects": [...]
}
```

**Example: Create Document**
```bash
POST /documents
Headers:
  Authorization: Bearer {ACCESS_TOKEN}
Body:
{
  "title": "My Document",
  "content": "...",
  "projectId": "..."
}
```

---

## Security Best Practices

1. ✅ **Encrypt stored tokens** - Use electron-store with encryption
2. ✅ **Never log tokens** in production
3. ✅ **Clear on logout** - Call `AuthStorage.clear()`
4. ✅ **Validate expiry** - Check before API calls
5. ✅ **HTTPS only** - All API calls must use HTTPS
6. ✅ **Handle refresh** - Auto-refresh before expiry

---

## FAQ

**Q: Can I test without opening the browser?**
A: No, the flow requires browser interaction for authentication. This is by design for security and UX.

**Q: What if user has multiple organizations?**
A: The JWT includes ALL organizations in the `organizations` array. Show an org switcher in your UI.

**Q: How do I know if it's a new user vs existing user?**
A: Check the `isNewUser` boolean in the JWT payload.

**Q: What happens if the desktop app isn't installed?**
A: Browser will show "No app found to open this link" error. User needs to install your app first.

**Q: Can I use direct API endpoints instead of browser flow?**
A: Not in this implementation. The `?source=extension` approach uses browser-based OAuth-style flow for better UX and security.

---

**Ready to integrate!** 🚀

Start with Step 1 (protocol handler) and work through each step. Test after each step to ensure everything works before moving forward.
