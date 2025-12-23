# PipesHub Frontend Desktop Integration - Implementation Plan

**Based on**: LibreChat Phase 3 Frontend Integration Analysis
**Date**: 2025-12-23
**Status**: Ready for Implementation

---

## Problem Statement

**Current Issues**:
1. ❌ `?source=extension` parameter gets lost during navigation
2. ❌ Signup → Signin redirect doesn't preserve source
3. ❌ Page refresh loses extension context
4. ❌ No visual indicator for desktop users
5. ❌ Backend expects source but frontend doesn't send it properly

**Root Cause**: Frontend has NO state management for source parameter

---

## Solution Overview

Replicate LibreChat Phase 3 approach:
- URL parameter detection with React hooks
- Source state management in auth components
- Pass source to backend API calls
- Desktop-specific callback pages
- Protocol-based desktop app integration

---

## Implementation Phases

### Phase 1: Utility Functions ✅ COMPLETED
- [x] Created `frontend/src/utils/desktop-integration.ts`
- [x] DesktopDetector class for source detection
- [x] CallbackGenerator for protocol URLs
- [x] MessageHandler for desktop communication

### Phase 2: Modify Auth API Layer
**File**: `frontend/src/auth/context/jwt/action.ts`

**Change authInitConfig to accept source**:
```typescript
// BEFORE
export const authInitConfig = async (email: string): Promise<AuthInitResponse> => {
  const response = await axios.post(
    `${CONFIG.authUrl}/api/v1/userAccount/initAuth`,
    { email }
  );
  // ...
};

// AFTER
export const authInitConfig = async (
  email: string,
  source?: string  // NEW: Accept source parameter
): Promise<AuthInitResponse> => {
  // Build URL with source parameter
  const url = source
    ? `${CONFIG.authUrl}/api/v1/userAccount/initAuth?source=${source}`
    : `${CONFIG.authUrl}/api/v1/userAccount/initAuth`;

  const response = await axios.post(url, { email });
  // ...
};
```

**Similarly update all auth functions**:
- `signInWithPassword`
- `signInWithOtp`
- `signInWithGoogle`
- etc.

### Phase 3: Modify Authentication View Component
**File**: `frontend/src/auth/view/auth/authentication-view.tsx`

**Add source detection**:
```typescript
import { useSearchParams } from 'react-router-dom';
import { DesktopIntegration } from 'src/utils/desktop-integration';

export default function AuthenticationView() {
  // Get URL search params
  const [searchParams] = useSearchParams();

  // DESKTOP INTEGRATION: Detect source
  const [isDesktopAuth, setIsDesktopAuth] = useState(false);
  const [authSource, setAuthSource] = useState<string>('web');

  useEffect(() => {
    const detectedState = DesktopIntegration.DesktopDetector.detectDesktopAuth(
      searchParams,
      navigator.userAgent
    );

    setIsDesktopAuth(detectedState.isExtension);
    setAuthSource(detectedState.source);

    // Log for debugging
    if (detectedState.isExtension) {
      console.log('🖥️ Desktop authentication detected:', detectedState);
    }
  }, [searchParams]);

  // Pass source to initAuth
  const handleEmailSubmit = async (data: { email: string }) => {
    const response = await authInitConfig(data.email, authSource); // Pass source
    // ... rest of logic
  };

  return (
    <Box>
      {/* Desktop indicator badge */}
      {isDesktopAuth && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Iconify icon="mdi:desktop-mac" />
            <Typography variant="body2">
              Authenticating for Desktop Application
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Rest of auth component */}
    </Box>
  );
}
```

### Phase 4: Modify Password Sign-In Component
**File**: `frontend/src/auth/view/auth/password-sign-in.tsx`

**Pass source through authentication**:
```typescript
// Receive source from parent
interface PasswordSignInProps {
  email: string;
  source?: string; // NEW
  onSuccess?: () => void;
}

// Pass to authentication call
const handlePasswordSignIn = async (password: string) => {
  await signInWithPassword({
    email,
    password,
    source, // NEW: Include source
  });
};
```

### Phase 5: Create Desktop Callback Success Page
**File**: `frontend/src/auth/view/desktop/desktop-callback.tsx` (NEW)

```typescript
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { DesktopIntegration } from 'src/utils/desktop-integration';

export default function DesktopCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  // Get token from location state or URL
  const token = location.state?.token || searchParams.get('token');
  const userId = location.state?.userId || searchParams.get('userId');

  useEffect(() => {
    if (!token) {
      navigate('/auth/desktop/error', {
        state: { error: 'No authentication token received' },
      });
      return;
    }

    // Generate desktop callback URL
    const callbackUrl = DesktopIntegration.CallbackGenerator.generateDesktopCallback(
      token,
      userId
    );

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Auto-redirect to desktop app
          window.location.href = callbackUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [token, userId, navigate]);

  const handleManualOpen = () => {
    const callbackUrl = DesktopIntegration.CallbackGenerator.generateDesktopCallback(
      token,
      userId
    );
    window.location.href = callbackUrl;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Box
        sx={{
          bgcolor: 'white',
          borderRadius: 4,
          p: 6,
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: 450,
        }}
      >
        {/* Success Icon */}
        <Box
          sx={{
            width: 80,
            height: 80,
            margin: '0 auto 24px',
            bgcolor: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            color: 'white',
          }}
        >
          ✓
        </Box>

        <Typography variant="h4" gutterBottom fontWeight={600}>
          Authentication Successful!
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Opening Desktop Application in {countdown} seconds...
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={handleManualOpen}
          fullWidth
          sx={{
            py: 2,
            fontSize: '18px',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          Open PipesHub Desktop Now
        </Button>

        <Box
          sx={{
            mt: 4,
            p: 2,
            bgcolor: '#f7fafc',
            borderRadius: 2,
            borderLeft: '4px solid #667eea',
          }}
        >
          <Typography variant="body2" fontWeight={600} gutterBottom>
            📱 Desktop App Required
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Make sure you have the PipesHub desktop application installed on your computer.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
```

### Phase 6: Create Desktop Error Page
**File**: `frontend/src/auth/view/desktop/desktop-error.tsx` (NEW)

```typescript
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Alert } from '@mui/material';

export default function DesktopError() {
  const location = useLocation();
  const navigate = useNavigate();

  const error = location.state?.error || 'Authentication failed';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Box
        sx={{
          bgcolor: 'white',
          borderRadius: 4,
          p: 6,
          textAlign: 'center',
          maxWidth: 450,
        }}
      >
        <Typography variant="h4" gutterBottom color="error">
          Authentication Failed
        </Typography>

        <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
          {error}
        </Alert>

        <Button
          variant="contained"
          onClick={() => navigate('/?source=extension')}
          fullWidth
        >
          Try Again
        </Button>
      </Box>
    </Box>
  );
}
```

### Phase 7: Update Router Configuration
**File**: `frontend/src/routes/sections/auth.tsx`

**Add desktop routes**:
```typescript
import { lazy } from 'react';

const DesktopCallback = lazy(() => import('src/auth/view/desktop/desktop-callback'));
const DesktopError = lazy(() => import('src/auth/view/desktop/desktop-error'));

// Add to routes array
{
  path: 'desktop',
  children: [
    {
      path: 'callback',
      element: <DesktopCallback />,
    },
    {
      path: 'error',
      element: <DesktopError />,
    },
  ],
}
```

---

## Key Implementation Details

### Source Parameter Flow

```
User opens: https://web.openanalyst.com/?source=extension
           ↓
AuthenticationView detects source from URL
           ↓
Stores in component state: setAuthSource('extension')
           ↓
User submits email
           ↓
Calls: authInitConfig(email, 'extension')
           ↓
Backend receives: POST /initAuth?source=extension
           ↓
Backend stores in session
           ↓
User completes auth
           ↓
Backend returns HTML redirect page
           ↓
Browser shows desktop callback page
```

### Testing Checklist

**Test 1: Source Detection**
- [ ] Open `https://web.openanalyst.com/?source=extension`
- [ ] Check console for "🖥️ Desktop authentication detected"
- [ ] Verify desktop indicator badge shows

**Test 2: Auth Init with Source**
- [ ] Submit email on desktop auth page
- [ ] Check Network tab: `POST /initAuth?source=extension`
- [ ] Verify session token returned

**Test 3: Desktop Callback**
- [ ] Complete authentication
- [ ] Should see success page with countdown
- [ ] Browser attempts to open `openanalyst://auth/callback?token=...`

**Test 4: Signup → Signin Flow**
- [ ] Signup with `?source=extension`
- [ ] After signup, redirect should preserve source
- [ ] Sign in should maintain desktop context

---

## Files to Create/Modify Summary

### New Files
1. ✅ `frontend/src/utils/desktop-integration.ts`
2. ⏳ `frontend/src/auth/view/desktop/desktop-callback.tsx`
3. ⏳ `frontend/src/auth/view/desktop/desktop-error.tsx`

### Modified Files
1. ⏳ `frontend/src/auth/context/jwt/action.ts` - Add source parameter
2. ⏳ `frontend/src/auth/view/auth/authentication-view.tsx` - Detect source
3. ⏳ `frontend/src/auth/view/auth/password-sign-in.tsx` - Pass source
4. ⏳ `frontend/src/routes/sections/auth.tsx` - Add desktop routes

---

## Next Steps

1. Modify auth API functions to accept source
2. Update authentication-view.tsx with source detection
3. Create desktop callback pages
4. Update router
5. Test each phase
6. Debug any issues
7. Build and verify
8. Get approval before pushing

---

**Ready to implement!** Starting with Phase 2...
