# OpenAnalyst Desktop Extension - Integration Guide

Complete guide for integrating OpenAnalyst authentication into desktop/extension applications using the OAuth-style flow with `?source=extension` parameter.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication Flow](#authentication-flow)
- [Implementation Steps](#implementation-steps)
- [Custom Protocol Setup](#custom-protocol-setup)
- [JWT Token Structure](#jwt-token-structure)
- [Code Examples](#code-examples)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### For Desktop Developers

Your desktop app needs to:

1. **Open browser** to: `https://web.openanalyst.com/auth/signin?source=extension`
2. **User authenticates** on the web page
3. **Web redirects** to a success page with "Click to Open OpenAnalyst" button
4. **User clicks** → Your app opens via `openanalyst://auth/callback?token=JWT`
5. **Decode JWT** to get access tokens, user data, and all organizations
6. **Store tokens** securely and use for API calls

---

## Authentication Flow

```
┌──────────────────┐
│  Desktop App     │
│  Triggers Login  │
└────────┬─────────┘
         │
         │ 1. Opens browser with ?source=extension
         │
         ▼
┌─────────────────────────────────────────────┐
│  https://web.openanalyst.com/auth/signin    │
│  ?source=extension                          │
└──────────────────┬──────────────────────────┘
                   │
                   │ 2. User enters credentials
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  Backend detects source=extension            │
│  Stores in session                           │
└──────────────────┬───────────────────────────┘
                   │
                   │ 3. Authentication completes
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  Success Page with:                          │
│  ✓ "Authentication Successful!"              │
│  ✓ "Open OpenAnalyst" button                 │
│  ✓ Auto-popup after 1.5s                     │
│  ✓ openanalyst://auth/callback?token=JWT    │
└──────────────────┬───────────────────────────┘
                   │
                   │ 4. Protocol handler triggers
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  Desktop App Opens                           │
│  Receives & Decodes JWT                      │
│  Extracts: tokens, user, organizations       │
└──────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Register Custom Protocol Handler

Your app MUST register `openanalyst://` protocol before authentication will work.

**Windows (Electron):**
```javascript
// main.js
const { app } = require('electron');

app.setAsDefaultProtocolClient('openanalyst');

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

**macOS (Electron):**
```javascript
app.setAsDefaultProtocolClient('openanalyst');

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});
```

---

### Step 2: Trigger Authentication

```typescript
// When user clicks "Sign In" in your desktop app
import { shell } from 'electron';

function loginWithOpenAnalyst() {
  // IMPORTANT: Include ?source=extension parameter!
  const authUrl = 'https://web.openanalyst.com/auth/signin?source=extension';

  shell.openExternal(authUrl);

  // Desktop app waits for callback via protocol handler
}

function signupWithOpenAnalyst() {
  const authUrl = 'https://web.openanalyst.com/auth/signup?source=extension';

  shell.openExternal(authUrl);
}
```

---

### Step 3: Handle Protocol Callback

```typescript
// main.js
function handleAuthCallback(url: string) {
  try {
    // URL format: openanalyst://auth/callback?token=JWT_TOKEN
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');

    if (!token) {
      console.error('No token in callback URL');
      return;
    }

    // Decode and store the token
    const authData = decodeAuthToken(token);

    // Store authentication data
    storeAuthData(authData);

    // Notify UI that login succeeded
    if (mainWindow) {
      mainWindow.webContents.send('auth-success', {
        user: authData.user,
        organizations: authData.organizations,
        isNewUser: authData.isNewUser
      });
    }

    // Focus/show main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

  } catch (error) {
    console.error('Auth callback error:', error);
  }
}
```

---

### Step 4: Decode JWT Token

```typescript
// auth/jwt-decoder.ts
import jwt from 'jsonwebtoken';

// IMPORTANT: Get this secret from your backend team
const JWT_SECRET = process.env.OPENANALYST_JWT_SECRET!;

interface Organization {
  id: string;
  slug: string;
  name: string;
  registeredName: string;
  accountType: 'individual' | 'business';
  role: string;
}

interface AuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
  };
  organizations: Organization[];
  currentOrgId: string;
  isNewUser: boolean;
}

export function decodeAuthToken(token: string): AuthData {
  try {
    // Verify and decode the JWT
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
    console.error('Failed to decode auth token:', error);
    throw new Error('Invalid authentication token');
  }
}
```

---

### Step 5: Store Authentication Data Securely

```typescript
// auth/auth-storage.ts
import Store from 'electron-store';

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: any;
  organizations: any[];
  currentOrgId: string;
}

const store = new Store<{ auth: StoredAuth | null }>({
  name: 'openanalyst-auth',
  encryptionKey: 'your-secure-encryption-key-here',
});

export class AuthStorage {
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

  static isTokenExpired(): boolean {
    const auth = this.get();
    if (!auth) return true;
    return Date.now() >= auth.expiresAt;
  }

  static getAccessToken(): string | null {
    const auth = this.get();
    return auth?.accessToken || null;
  }
}
```

---

### Step 6: Make API Calls

```typescript
// api/api-client.ts
import axios from 'axios';
import { AuthStorage } from '../auth/auth-storage';

const apiClient = axios.create({
  baseURL: 'https://web.openanalyst.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add access token to all requests
apiClient.interceptors.request.use((config) => {
  const accessToken = AuthStorage.getAccessToken();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

// Handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;

      const auth = AuthStorage.get();
      if (auth?.refreshToken) {
        try {
          // Refresh access token
          const response = await axios.post(
            'https://web.openanalyst.com/api/v1/userAccount/refresh/token',
            {},
            {
              headers: {
                Authorization: `Bearer ${auth.refreshToken}`,
              },
            }
          );

          // Update stored token
          const newAccessToken = response.data.accessToken;
          AuthStorage.save({
            ...auth,
            accessToken: newAccessToken,
          });

          // Retry original request with new token
          error.config.headers.Authorization = `Bearer ${newAccessToken}`;
          return axios.request(error.config);
        } catch (refreshError) {
          // Refresh failed - logout
          AuthStorage.clear();
          // Trigger re-login
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## Custom Protocol Setup

### Windows

**Registry Entry (Electron handles this automatically):**
```
HKEY_CURRENT_USER\Software\Classes\openanalyst
  (Default) = "URL:OpenAnalyst Protocol"
  URL Protocol = ""

HKEY_CURRENT_USER\Software\Classes\openanalyst\shell\open\command
  (Default) = "C:\Path\To\OpenAnalyst.exe" "%1"
```

**Electron automatically registers this when you use:**
```javascript
app.setAsDefaultProtocolClient('openanalyst');
```

---

### macOS

**Info.plist configuration:**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>openanalyst</string>
    </array>
    <key>CFBundleURLName</key>
    <string>com.openanalyst.auth</string>
  </dict>
</array>
```

---

### Linux

**Create .desktop file:**
```ini
[Desktop Entry]
Type=Application
Name=OpenAnalyst
Exec=/path/to/openanalyst %u
MimeType=x-scheme-handler/openanalyst;
Terminal=false
```

**Register:**
```bash
xdg-mime default openanalyst.desktop x-scheme-handler/openanalyst
```

---

## JWT Token Structure

### Callback Token Payload

The token you receive at `openanalyst://auth/callback?token=...` contains:

```typescript
{
  // Authentication Tokens
  accessToken: string;        // JWT for API calls (valid 1 hour)
  refreshToken: string;        // JWT for refreshing access token (valid 30 days)
  expiresIn: number;          // 3600 (seconds)

  // User Information
  user: {
    id: string;               // MongoDB ObjectId
    email: string;            // User's email
    fullName: string;         // Display name
    firstName?: string;
    lastName?: string;
  };

  // Organizations (MULTIPLE!)
  organizations: [
    {
      id: string;             // Organization MongoDB ObjectId
      slug: string;           // URL-safe identifier
      name: string;           // Display name
      registeredName: string; // Official name
      accountType: 'individual' | 'business';
      role: string;           // User's role in this org (e.g., "admin")
    },
    // ... more organizations if user is member of multiple orgs
  ];

  // Current Context
  currentOrgId: string;       // Active organization ID
  isNewUser: boolean;         // true for signup, false for signin

  // JWT Metadata
  scopes: string[];
  iat: number;                // Issued at timestamp
  exp: number;                // Expiration timestamp (5 minutes from issue)
}
```

### Important Notes

- **Token Expiry:** The callback token expires in **5 minutes**. Decode it immediately!
- **Access Token:** Valid for **1 hour**. Use for all API calls.
- **Refresh Token:** Valid for **30 days**. Use to get new access tokens.
- **Multiple Organizations:** User can belong to multiple orgs. Show org switcher in your UI.

---

## Code Examples

### Complete Electron Integration

```typescript
// src/main.ts
import { app, BrowserWindow } from 'electron';
import { decodeAuthToken } from './auth/jwt-decoder';
import { AuthStorage } from './auth/auth-storage';
import { shell } from 'electron';

let mainWindow: BrowserWindow | null = null;

// Register protocol
app.setAsDefaultProtocolClient('openanalyst');

// Handle auth callback
function handleAuthCallback(url: string) {
  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');

    if (!token) {
      console.error('No token in callback URL');
      return;
    }

    // Decode JWT
    const authData = decodeAuthToken(token);

    // Store securely
    AuthStorage.save(authData);

    // Notify renderer
    if (mainWindow) {
      mainWindow.webContents.send('auth-success', {
        user: authData.user,
        organizations: authData.organizations,
        currentOrgId: authData.currentOrgId,
        isNewUser: authData.isNewUser,
      });
    }

    console.log('✅ Authentication successful!');
    console.log(`User: ${authData.user.email}`);
    console.log(`Organizations: ${authData.organizations.length}`);
    console.log(`Is new user: ${authData.isNewUser}`);

    // Show/focus main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  } catch (error) {
    console.error('Auth callback error:', error);

    if (mainWindow) {
      mainWindow.webContents.send('auth-error', {
        message: 'Authentication failed',
        error: error.message,
      });
    }
  }
}

// macOS: handle open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

// Windows: handle second-instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.pop();
    if (url?.startsWith('openanalyst://')) {
      handleAuthCallback(url);

      // Focus window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });
}

// Create window
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');
});

// Trigger login function
export function triggerLogin() {
  const authUrl = 'https://web.openanalyst.com/auth/signin?source=extension';
  shell.openExternal(authUrl);
}

export function triggerSignup() {
  const authUrl = 'https://web.openanalyst.com/auth/signup?source=extension';
  shell.openExternal(authUrl);
}
```

---

### Organization Switcher UI

Since users can belong to multiple organizations, your app should show an org switcher:

```typescript
// renderer/components/OrganizationSwitcher.tsx
import { useState, useEffect } from 'react';
import { AuthStorage } from '../auth/auth-storage';

export function OrganizationSwitcher() {
  const [organizations, setOrganizations] = useState([]);
  const [currentOrgId, setCurrentOrgId] = useState('');

  useEffect(() => {
    const auth = AuthStorage.get();
    if (auth) {
      setOrganizations(auth.organizations);
      setCurrentOrgId(auth.currentOrgId);
    }
  }, []);

  const switchOrganization = (orgId: string) => {
    // Update current org in storage
    const auth = AuthStorage.get();
    if (auth) {
      AuthStorage.save({
        ...auth,
        currentOrgId: orgId,
      });
      setCurrentOrgId(orgId);

      // Refresh app with new org context
      window.location.reload();
    }
  };

  return (
    <div className="org-switcher">
      <select value={currentOrgId} onChange={(e) => switchOrganization(e.target.value)}>
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name} ({org.accountType})
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## Testing

### Test Protocol Handler

**Create test link:**
```html
<a href="openanalyst://auth/callback?token=test">Test Protocol Handler</a>
```

Click it. Your app should open. If not, protocol handler isn't registered.

---

### Test Authentication Flow

1. **Start your desktop app**
2. **Click "Sign In"** button
3. **Browser opens** to: `https://web.openanalyst.com/auth/signin?source=extension`
4. **Sign in** with test credentials
5. **See success page** with "Open OpenAnalyst" button
6. **Automatic popup** after 1.5 seconds tries to open your app
7. **Click button** manually if auto-popup didn't work
8. **Your app opens** and receives the token
9. **Check logs** for decoded user and organization data

---

### Debug Token

To see what's in the token without verifying signature:

```typescript
const jwt = require('jsonwebtoken');

// Decode without verifying (for debugging only!)
const decoded = jwt.decode(token, { complete: true });

console.log('Token header:', decoded.header);
console.log('Token payload:', decoded.payload);
console.log('Organizations:', decoded.payload.organizations);
console.log('Expires:', new Date(decoded.payload.exp * 1000));
```

---

## API Usage Examples

### Fetch User Projects

```typescript
import apiClient from './api/api-client';

async function getUserProjects() {
  const auth = AuthStorage.get();

  const response = await apiClient.get(`/projects`, {
    params: {
      orgId: auth.currentOrgId,
    },
  });

  return response.data;
}
```

### Create Document

```typescript
async function createDocument(title: string, content: string) {
  const auth = AuthStorage.get();

  const response = await apiClient.post('/documents', {
    title,
    content,
    orgId: auth.currentOrgId,
    projectId: 'project-id-here',
  });

  return response.data;
}
```

---

## Troubleshooting

### Issue: Protocol handler not working

**Windows:**
```powershell
# Check registry
reg query HKCU\Software\Classes\openanalyst

# Should show openanalyst key exists
```

**macOS:**
```bash
# Rebuild launch services database
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

### Issue: JWT decode error

**Check:**
1. JWT secret matches backend (ask backend team for `JWT_SECRET`)
2. Token hasn't expired (5 minute lifetime from callback)
3. Token is complete (not truncated)

**Debug:**
```typescript
console.log('Token length:', token.length);
console.log('Token starts with:', token.substring(0, 20));
console.log('Token parts:', token.split('.').length); // Should be 3
```

---

### Issue: Desktop app doesn't open

**Check:**
1. Only one app instance running (single instance lock)
2. Protocol handler registered BEFORE app.whenReady()
3. Event listeners set up correctly

**Add logging:**
```typescript
app.on('open-url', (event, url) => {
  console.log('📱 Received protocol URL:', url);
  event.preventDefault();
  handleAuthCallback(url);
});

app.on('second-instance', (event, commandLine) => {
  console.log('📱 Second instance with:', commandLine);
});
```

---

### Issue: Access token expired

Use refresh token to get new access token:

```typescript
async function refreshAccessToken() {
  const auth = AuthStorage.get();

  if (!auth?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await axios.post(
    'https://web.openanalyst.com/api/v1/userAccount/refresh/token',
    {},
    {
      headers: {
        Authorization: `Bearer ${auth.refreshToken}`,
      },
    }
  );

  // Update stored token
  AuthStorage.save({
    ...auth,
    accessToken: response.data.accessToken,
  });

  return response.data.accessToken;
}
```

---

## Key Differences from Previous Approach

### Previous: Direct API Endpoints

```
Desktop → POST /api/v1/desktop/auth/signup
       ← JSON response with tokens
```

**Issues:**
- Different from web flow
- Requires separate backend logic
- No UI for user

### Current: OAuth-Style Flow

```
Desktop → Opens browser to /auth/signin?source=extension
       → User authenticates on web
       → Beautiful success page
       → Desktop app receives token via protocol
```

**Benefits:**
- ✅ Uses same web authentication UI
- ✅ Supports all auth methods (password, OTP, SSO, etc.)
- ✅ Better UX with visual feedback
- ✅ Secure token delivery via custom protocol

---

## Important URLs

**Production:**
- Signin: `https://web.openanalyst.com/auth/signin?source=extension`
- Signup: `https://web.openanalyst.com/auth/signup?source=extension`
- API Base: `https://web.openanalyst.com/api/v1`

**Callback:**
- Protocol: `openanalyst://auth/callback?token={JWT}`

---

## Required from Backend Team

Ask your backend team for:

1. **JWT_SECRET** - Required to decode the callback token
2. **API Documentation** - List of available API endpoints
3. **.env Example** - For local development

---

## Security Best Practices

1. **Encrypt stored tokens** - Use electron-store with encryption
2. **Never log tokens** in production builds
3. **Clear tokens on logout** - Call `AuthStorage.clear()`
4. **Validate token expiry** - Check before making API calls
5. **Use HTTPS only** - Never make HTTP API calls
6. **Handle refresh properly** - Auto-refresh before expiry

---

## Support

- **GitHub:** https://github.com/AnantBisht-ops/pipeshub-ai
- **Branch:** feature/desktop-oauth-flow
- **Documentation:** DESKTOP_AUTH_API.md
- **Testing Guide:** EC2_DEPLOYMENT_TEST_CHECKLIST.md

---

## Changelog

### 2025-12-23
- Implemented `?source=extension` parameter-based routing
- Added multi-organization support in JWT payload
- Created beautiful authentication success page
- Auto-popup + manual button for opening desktop app
- Web flow remains unchanged (backward compatible)

---

**Ready to integrate!** 🚀

All backend changes are complete and pushed to GitHub. Start with Step 1 (Register Protocol Handler) and follow the implementation steps in order.
