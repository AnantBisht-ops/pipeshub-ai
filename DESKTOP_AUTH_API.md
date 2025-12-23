# OpenAnalyst Desktop Authentication API

Complete guide for integrating OpenAnalyst authentication into desktop applications.

## Table of Contents

- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [Custom Protocol Setup](#custom-protocol-setup)
- [JWT Token Structure](#jwt-token-structure)
- [Desktop Integration](#desktop-integration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

OpenAnalyst provides an OAuth-style authentication flow for desktop applications. After successful authentication through the web interface, users are automatically redirected back to the desktop app with a JWT token containing all necessary authentication data.

### Key Features

- **OAuth-style Flow**: Users authenticate via web browser, then return to desktop app
- **Single JWT Token**: All auth data (tokens, user info, organizations) in one encrypted package
- **Auto-Redirect**: Seamless browser-to-app transition with fallback manual link
- **Secure**: Short-lived tokens (5 minutes) with JWT encryption
- **Complete Data**: Full user profile and organization details included

---

## Authentication Flow

```
┌─────────────┐
│  Desktop    │
│     App     │
└──────┬──────┘
       │
       │ 1. Open browser
       │
       ▼
┌─────────────────────────────────┐
│  https://web.openanalyst.com    │
│  /auth/signin  or  /auth/signup │
└────────────┬────────────────────┘
             │
             │ 2. User signs in/up
             │
             ▼
┌─────────────────────────────────┐
│   Authentication Complete       │
│   (Backend generates JWT)       │
└────────────┬────────────────────┘
             │
             │ 3. Redirect with token
             │
             ▼
┌─────────────────────────────────┐
│  HTML Page with Auto-Redirect   │
│  openanalyst://auth/callback    │
│         ?token=JWT_TOKEN         │
└────────────┬────────────────────┘
             │
             │ 4. Protocol handler
             │    triggers desktop app
             ▼
┌─────────────┐
│  Desktop    │
│  App Opens  │
│  & Decodes  │
│  JWT Token  │
└─────────────┘
```

### Step-by-Step Process

1. **Desktop App Initiates**: Opens user's default browser to OpenAnalyst web auth
2. **User Authenticates**: Signs in or creates account via web interface
3. **Backend Generates JWT**: Packages all auth data into encrypted token
4. **Redirect Page**: Beautiful HTML page with auto-redirect to custom protocol
5. **Desktop App Receives**: Protocol handler captures token and decodes it

---

## Custom Protocol Setup

Your desktop app must register a custom protocol handler for `openanalyst://`

### Windows (Electron Example)

```javascript
// main.js
const { app, protocol } = require('electron');

// Register protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('openanalyst', process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient('openanalyst');
}

// Handle protocol URL
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

// Windows-specific: handle second instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Protocol handler for Windows
    const url = commandLine.pop();
    if (url && url.startsWith('openanalyst://')) {
      handleAuthCallback(url);
    }
  });
}

function handleAuthCallback(url) {
  // Extract token from URL
  // url format: openanalyst://auth/callback?token=JWT_TOKEN
  const urlObj = new URL(url);
  const token = urlObj.searchParams.get('token');

  if (token) {
    // Decode and process token (see JWT Token Structure section)
    decodeAndStoreAuth(token);
  }
}
```

### macOS (Electron Example)

```javascript
// main.js
const { app } = require('electron');

app.setAsDefaultProtocolClient('openanalyst');

app.on('open-url', (event, url) => {
  event.preventDefault();

  // Parse the callback URL
  const urlObj = new URL(url);
  const token = urlObj.searchParams.get('token');

  if (token) {
    decodeAndStoreAuth(token);
  }
});
```

### Linux (Electron Example)

```javascript
// Similar to Windows, but also need to create .desktop file

// ~/.local/share/applications/openanalyst.desktop
/*
[Desktop Entry]
Type=Application
Name=OpenAnalyst
Exec=/path/to/openanalyst %u
MimeType=x-scheme-handler/openanalyst;
*/
```

---

## JWT Token Structure

The callback JWT token contains the complete authentication response.

### Token Payload

```typescript
interface DesktopCallbackPayload {
  // Authentication tokens
  accessToken: string;          // Main JWT for API calls (expires in 1 hour)
  refreshToken: string;          // Refresh token (expires in 30 days)
  expiresIn: number;            // 3600 seconds (1 hour)

  // User information
  user: {
    id: string;                 // User MongoDB ObjectId
    email: string;              // User email address
    fullName: string;           // Full display name
    firstName?: string;         // First name (optional)
    lastName?: string;          // Last name (optional)
  };

  // Organization data
  organizations: Array<{
    id: string;                 // Organization MongoDB ObjectId
    slug: string;               // URL-friendly org identifier
    name: string;               // Display name (shortName or registeredName)
    registeredName: string;     // Official registered name
    accountType: 'individual' | 'business';
    role: string;               // User's role in this org (e.g., "admin")
  }>;

  // Current context
  currentOrgId: string;         // Active organization ID
  isNewUser: boolean;           // true if first-time signup, false if signin

  // Metadata (added by JWT library)
  scopes: string[];             // Token scopes
  iat: number;                  // Issued at timestamp
  exp: number;                  // Expiration timestamp
}
```

### JWT Secret

The desktop callback JWT is signed with your **main JWT secret** (same as `jwtSecret` in environment config).

**Important**: The `accessToken` and `refreshToken` inside the payload are themselves JWTs signed with the same secret.

---

## Desktop Integration

### 1. Trigger Authentication

```typescript
// desktop-app/src/auth/auth-service.ts
import { shell } from 'electron';

export class AuthService {
  /**
   * Initiates the OAuth-style authentication flow
   */
  async login() {
    const authUrl = 'https://web.openanalyst.com/auth/signin';

    // Open browser to auth page
    await shell.openExternal(authUrl);

    // Wait for callback (handled by protocol handler)
  }

  async signup() {
    const authUrl = 'https://web.openanalyst.com/auth/signup';
    await shell.openExternal(authUrl);
  }
}
```

### 2. Decode JWT Token

```typescript
// desktop-app/src/auth/jwt-decoder.ts
import jwt from 'jsonwebtoken';

// IMPORTANT: Get this from your environment config
const JWT_SECRET = process.env.OPENANALYST_JWT_SECRET;

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
  organizations: Array<{
    id: string;
    slug: string;
    name: string;
    registeredName: string;
    accountType: 'individual' | 'business';
    role: string;
  }>;
  currentOrgId: string;
  isNewUser: boolean;
}

export function decodeAuthToken(token: string): AuthData {
  try {
    // Verify and decode the JWT
    const decoded = jwt.verify(token, JWT_SECRET) as AuthData;

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

### 3. Store Authentication Data

```typescript
// desktop-app/src/auth/auth-storage.ts
import Store from 'electron-store';

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Timestamp when token expires
  user: any;
  organizations: any[];
  currentOrgId: string;
}

const store = new Store<{ auth: StoredAuth | null }>({
  name: 'openanalyst-auth',
  encryptionKey: 'your-encryption-key', // Use a secure key
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
}
```

### 4. Use Access Token for API Calls

```typescript
// desktop-app/src/api/api-client.ts
import axios from 'axios';
import { AuthStorage } from '../auth/auth-storage';

const apiClient = axios.create({
  baseURL: 'https://web.openanalyst.com/api/v1',
});

// Add auth token to all requests
apiClient.interceptors.request.use((config) => {
  const auth = AuthStorage.get();

  if (auth && auth.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  return config;
});

// Handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, try to refresh
      const auth = AuthStorage.get();
      if (auth?.refreshToken) {
        try {
          const response = await axios.post(
            'https://web.openanalyst.com/api/v1/auth/refresh/token',
            {},
            {
              headers: {
                Authorization: `Bearer ${auth.refreshToken}`,
              },
            }
          );

          // Update stored access token
          AuthStorage.save({
            ...auth,
            accessToken: response.data.accessToken,
          });

          // Retry original request
          error.config.headers.Authorization = `Bearer ${response.data.accessToken}`;
          return axios.request(error.config);
        } catch (refreshError) {
          // Refresh failed, logout user
          AuthStorage.clear();
          // Redirect to login
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

### 5. Complete Integration Example

```typescript
// desktop-app/src/main.ts
import { app, BrowserWindow } from 'electron';
import { decodeAuthToken } from './auth/jwt-decoder';
import { AuthStorage } from './auth/auth-storage';

let mainWindow: BrowserWindow | null = null;

// Register protocol
app.setAsDefaultProtocolClient('openanalyst');

// Handle protocol callback
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

// Windows: handle second instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    const url = commandLine.pop();
    if (url?.startsWith('openanalyst://')) {
      handleAuthCallback(url);

      // Focus main window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });
}

function handleAuthCallback(url: string) {
  try {
    // Parse URL: openanalyst://auth/callback?token=JWT_TOKEN
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token');

    if (!token) {
      console.error('No token in callback URL');
      return;
    }

    // Decode JWT
    const authData = decodeAuthToken(token);

    // Store authentication data
    AuthStorage.save(authData);

    // Notify renderer process
    if (mainWindow) {
      mainWindow.webContents.send('auth-success', {
        user: authData.user,
        isNewUser: authData.isNewUser,
      });
    }

    console.log('Authentication successful!');
    console.log('User:', authData.user.email);
    console.log('Is new user:', authData.isNewUser);
    console.log('Organizations:', authData.organizations.length);
  } catch (error) {
    console.error('Auth callback error:', error);

    if (mainWindow) {
      mainWindow.webContents.send('auth-error', {
        message: 'Authentication failed',
      });
    }
  }
}

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
```

---

## Testing

### Manual Testing

1. **Start Desktop App**:
   ```bash
   npm run dev
   ```

2. **Trigger Login**:
   - Click "Sign In" button in your app
   - Browser opens to `https://web.openanalyst.com/auth/signin`

3. **Complete Authentication**:
   - Enter credentials and sign in
   - Watch for redirect page showing "Redirecting to OpenAnalyst..."
   - Desktop app should automatically open and focus

4. **Verify Token**:
   - Check console logs for decoded token data
   - Verify user info is correct
   - Test API calls with stored access token

### Test with Mock Token

```typescript
// For development/testing
const mockToken = 'eyJhbGci...' // Get from actual auth flow

handleAuthCallback(`openanalyst://auth/callback?token=${mockToken}`);
```

### Debugging Protocol Handler

**Windows**:
```powershell
# Check registry for protocol registration
reg query HKCU\Software\Classes\openanalyst
```

**macOS**:
```bash
# Check default handler
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -dump | grep openanalyst
```

**Linux**:
```bash
# Check .desktop file
cat ~/.local/share/applications/openanalyst.desktop
```

---

## Troubleshooting

### Issue: Protocol handler not triggering

**Windows**:
- Ensure app is set as default protocol handler in settings
- Try running app as administrator
- Check Windows registry for correct protocol registration

**macOS**:
- Check System Preferences → Security & Privacy
- Verify app is allowed to open links
- Rebuild protocol database: `/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -kill -r -domain local -domain system -domain user`

**Linux**:
- Ensure .desktop file has correct executable path
- Run: `xdg-mime default openanalyst.desktop x-scheme-handler/openanalyst`

### Issue: JWT decode error

**Check**:
1. JWT secret matches backend configuration
2. Token hasn't expired (5 minute lifetime)
3. Token is properly URL-encoded

**Debug**:
```typescript
const jwt = require('jsonwebtoken');

// Don't verify, just decode to inspect
const decoded = jwt.decode(token, { complete: true });
console.log('Token header:', decoded.header);
console.log('Token payload:', decoded.payload);
console.log('Token expires:', new Date(decoded.payload.exp * 1000));
```

### Issue: Desktop app doesn't receive callback

**Check**:
1. Single instance lock is working (only one app instance running)
2. Protocol handler is registered before app.whenReady()
3. Event listeners are properly set up

**Debug**:
```typescript
// Add logging
app.on('open-url', (event, url) => {
  console.log('Received protocol URL:', url);
  event.preventDefault();
  handleAuthCallback(url);
});

app.on('second-instance', (event, commandLine) => {
  console.log('Second instance launched with:', commandLine);
});
```

### Issue: Access token expired

**Solution**: Use refresh token to get new access token

```typescript
async function refreshAccessToken() {
  const auth = AuthStorage.get();
  if (!auth?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await axios.post(
    'https://web.openanalyst.com/api/v1/auth/refresh/token',
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

## Security Considerations

1. **Token Storage**:
   - Use encrypted storage (e.g., electron-store with encryption)
   - Never log tokens in production
   - Clear tokens on logout

2. **JWT Secret**:
   - Keep secret secure and in environment variables
   - Never commit to version control
   - Rotate periodically

3. **HTTPS Only**:
   - Always use HTTPS for API calls
   - Validate SSL certificates

4. **Token Expiration**:
   - Access token: 1 hour
   - Refresh token: 30 days
   - Callback token: 5 minutes
   - Handle expiration gracefully

5. **Protocol Security**:
   - Validate callback URLs before processing
   - Check token format and structure
   - Implement rate limiting for auth attempts

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/AnantBisht-ops/pipeshub-ai/issues
- Email: contact@pipeshub.com

---

## Changelog

### 2025-12-23
- Initial implementation of desktop OAuth-style flow
- Added JWT callback token generation
- Implemented HTML redirect page with auto-redirect
- Complete desktop integration documentation
