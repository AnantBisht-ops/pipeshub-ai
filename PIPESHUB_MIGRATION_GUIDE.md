# 🚀 PIPESHUB ↔ OPENANALYST AUTHENTICATION INTEGRATION GUIDE

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [All Endpoints Summary](#all-endpoints-summary)
4. [Implementation Plan](#implementation-plan)
5. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
6. [Testing Guide](#testing-guide)
7. [Deployment Checklist](#deployment-checklist)
8. [What to Give OpenAnalyst](#what-to-give-openanalyst)

---

## 📊 OVERVIEW

This guide provides **100% executable code** to integrate OpenAnalyst VSCode extension authentication with your PipesHub backend. The integration uses a **unified authentication system** with a **single database** approach.

### Key Features

- ✅ Single MongoDB database (no data duplication)
- ✅ Unified authentication (web + extension)
- ✅ Source detection middleware (`?source=extension`)
- ✅ Enhanced JWT tokens (24-hour for extension, 15-min for web)
- ✅ Custom protocol redirect (`pipeshub://`)
- ✅ Complete extension API (providers, settings, usage tracking)
- ✅ No balance system (removed as per requirements)

---

## 🏗️ ARCHITECTURE

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. VSCode Extension (OpenAnalyst)                              │
│     Opens browser: http://localhost:3080/login?source=extension │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Source Detection Middleware                                 │
│     - Detects ?source=extension                                 │
│     - Sets req.isExtensionAuth = true                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. User Authenticates (Email/Password or OAuth)                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. LoginController                                             │
│     - Populates PipesHub fields if missing                     │
│     - Generates enhanced JWT (24 hours)                         │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Browser Redirects                                           │
│     pipeshub://pipeshub.extension/auth-callback?token=<JWT>     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Extension Stores Token & Makes API Calls                    │
│     Authorization: Bearer <JWT>                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   SINGLE MONGODB DATABASE                    │
│                        (PipesHub)                            │
├─────────────────────────────────────────────────────────────┤
│  Collections:                                                │
│  ├─ users          ← Extended with PipesHub fields         │
│  ├─ sessions       ← Shared authentication sessions         │
│  ├─ conversations  ← PipesHub web data                      │
│  └─ messages       ← PipesHub web data                      │
└─────────────────────────────────────────────────────────────┘
         ↑                              ↑
         │                              │
    ┌────┴─────┐                  ┌────┴──────┐
    │  Web UI  │                  │ Extension │
    │(Browser) │                  │ (VSCode)  │
    └──────────┘                  └───────────┘
```

---

## 📡 ALL ENDPOINTS SUMMARY

### Total Endpoints Created: **17**

#### 🔐 Authentication Endpoints (6)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| **POST** | `/api/auth/extension/token` | Generate JWT for authenticated extension users | ✅ JWT |
| **GET** | `/api/auth/extension/callback` | Handle OAuth callback for extension | ❌ OAuth |
| **POST** | `/api/auth/extension/register` | Register new extension user | ❌ |
| **GET** | `/api/auth/extension/profile` | Get extension user profile | ✅ JWT |
| **POST** | `/api/auth/login` | Enhanced login with source detection | ❌ |
| **POST** | `/api/auth/register` | Enhanced registration with source detection | ❌ |

#### 🔧 PipesHub Extension API (11)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| **GET** | `/api/pipeshub/health` | Check backend health | ❌ Public |
| **GET** | `/api/pipeshub/providers` | Get user's AI provider profiles | ✅ JWT |
| **POST** | `/api/pipeshub/providers` | Create new AI provider profile | ✅ JWT |
| **PUT** | `/api/pipeshub/providers/:id` | Update provider profile | ✅ JWT |
| **DELETE** | `/api/pipeshub/providers/:id` | Delete provider profile | ✅ JWT |
| **GET** | `/api/pipeshub/settings` | Get extension settings | ✅ JWT |
| **PUT** | `/api/pipeshub/settings` | Update extension settings | ✅ JWT |
| **POST** | `/api/pipeshub/usage/track` | Track API usage | ✅ JWT |
| **GET** | `/api/pipeshub/usage/stats` | Get usage statistics | ✅ JWT |
| **GET** | `/api/pipeshub/user/info` | Get user information | ✅ JWT |
| **PUT** | `/api/pipeshub/user/profile` | Update user profile | ✅ JWT |

---

## 🎯 IMPLEMENTATION PLAN

### Prerequisites

- ✅ Node.js 16+ installed
- ✅ MongoDB 4.4+ running
- ✅ Existing Express.js backend
- ✅ User authentication system (Passport.js or similar)

### Implementation Time Estimate

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Database Schema | 30 minutes |
| Phase 2: Source Detection Middleware | 20 minutes |
| Phase 3: Enhanced JWT Service | 45 minutes |
| Phase 4: Extension Auth Controller | 40 minutes |
| Phase 5: Update Auth Routes | 25 minutes |
| Phase 6: Update Login Controller | 30 minutes |
| Phase 7: PipesHub Extension API | 60 minutes |
| Phase 8: Mount Routes | 10 minutes |
| Phase 9: Environment Config | 15 minutes |
| Phase 10: CORS Config | 10 minutes |
| **Total** | **~4-5 hours** |

---

## 🔧 PHASE-BY-PHASE IMPLEMENTATION

### PHASE 1: DATABASE SCHEMA EXTENSION

**Location**: `packages/data-schemas/src/schema/user.ts` (or your User model file)

#### Add these fields to your User schema:

```typescript
// ============ PIPESHUB EXTENSION FIELDS ============

// User profile
firstName: {
  type: String,
  default: ''
},
lastName: {
  type: String,
  default: ''
},
imageUrl: {
  type: String,
  default: ''
},

// Subscription and permissions
plan: {
  type: String,
  enum: ['free', 'pro', 'enterprise'],
  default: 'free',
  index: true
},
permissions: {
  type: [String],
  default: ['basic_usage']
},

// Usage limits
dailyTokenLimit: {
  type: Number,
  default: 50000
},
monthlyTokenLimit: {
  type: Number,
  default: 1500000
},
dailyRequestLimit: {
  type: Number,
  default: 1000
},
monthlyRequestLimit: {
  type: Number,
  default: 30000
},

// Tracking
lastLoginAt: {
  type: Date,
  index: true
},

// AI Provider Profiles (API keys and configurations)
providerProfiles: [{
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    required: true
  }, // 'openai', 'anthropic', 'google', etc.
  settings: {
    type: Schema.Types.Mixed
  },
  encryptedKey: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: String
  }
}],

// Extension settings sync
extensionSettings: {
  settings: {
    type: Schema.Types.Mixed
  },
  version: {
    type: Number,
    default: 1
  },
  syncedAt: {
    type: Date
  }
},

// Usage history (last 1000 records)
usageHistory: [{
  id: String,
  userId: String,
  provider: String,  // 'openai', 'anthropic', etc.
  model: String,     // 'gpt-4', 'claude-3-opus', etc.
  tokens: Number,
  cost: Number,      // In dollars (optional)
  requests: Number,
  metadata: Schema.Types.Mixed,
  timestamp: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'extension'
  }
}]
```

#### If using Mongoose, complete schema example:

```javascript
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  // Existing fields
  email: { type: String, required: true, unique: true },
  password: { type: String },
  username: { type: String },
  provider: { type: String, default: 'local' },
  role: { type: String, default: 'user' },

  // PipesHub Extension Fields
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free', index: true },
  permissions: { type: [String], default: ['basic_usage'] },
  dailyTokenLimit: { type: Number, default: 50000 },
  monthlyTokenLimit: { type: Number, default: 1500000 },
  dailyRequestLimit: { type: Number, default: 1000 },
  monthlyRequestLimit: { type: Number, default: 30000 },
  lastLoginAt: { type: Date, index: true },

  providerProfiles: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    provider: { type: String, required: true },
    settings: { type: Schema.Types.Mixed },
    encryptedKey: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    userId: { type: String }
  }],

  extensionSettings: {
    settings: { type: Schema.Types.Mixed },
    version: { type: Number, default: 1 },
    syncedAt: { type: Date }
  },

  usageHistory: [{
    id: String,
    userId: String,
    provider: String,
    model: String,
    tokens: Number,
    cost: Number,
    requests: Number,
    metadata: Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
    source: { type: String, default: 'extension' }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
```

---

### PHASE 2: SOURCE DETECTION MIDDLEWARE

**Location**: `api/server/middleware/sourceDetection.js` (**CREATE NEW FILE**)

```javascript
const { logger } = require('@librechat/data-schemas');

/**
 * Authentication Source Types
 */
const AUTH_SOURCES = {
  WEB: 'web',
  EXTENSION: 'extension',
  UNKNOWN: 'unknown'
};

const VALID_SOURCES = [AUTH_SOURCES.WEB, AUTH_SOURCES.EXTENSION];

/**
 * Detects authentication source from query parameter
 * ?source=extension or ?source=web
 */
const detectAuthSource = (req, res, next) => {
  try {
    const sourceParam = req.query.source;

    let detectedSource = AUTH_SOURCES.WEB; // Default to web
    let isExtensionAuth = false;

    if (sourceParam) {
      const normalizedSource = String(sourceParam).toLowerCase().trim();

      if (VALID_SOURCES.includes(normalizedSource)) {
        detectedSource = normalizedSource;
        isExtensionAuth = normalizedSource === AUTH_SOURCES.EXTENSION;
      } else {
        logger.warn('[sourceDetection] Invalid source parameter', {
          source: sourceParam,
          ip: req.ip,
          url: req.originalUrl
        });
      }
    }

    // Set context on request
    req.authSource = detectedSource;
    req.isExtensionAuth = isExtensionAuth;
    req.headers['x-auth-source'] = detectedSource;

    logger.debug('[sourceDetection] Source detected', {
      source: detectedSource,
      isExtension: isExtensionAuth,
      url: req.originalUrl
    });

    next();

  } catch (error) {
    logger.error('[sourceDetection] Error', {
      error: error.message,
      stack: error.stack
    });

    // Set safe defaults
    req.authSource = AUTH_SOURCES.WEB;
    req.isExtensionAuth = false;
    next();
  }
};

/**
 * Require extension authentication middleware
 */
const requireExtensionAuth = (req, res, next) => {
  try {
    if (req.authSource === undefined) {
      logger.error('[requireExtensionAuth] Source detection not applied');
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'MIDDLEWARE_ORDER_ERROR'
      });
    }

    if (!req.isExtensionAuth || req.authSource !== AUTH_SOURCES.EXTENSION) {
      logger.warn('[requireExtensionAuth] Unauthorized extension access', {
        source: req.authSource,
        ip: req.ip,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: 'This endpoint is only available for VSCode extension authentication',
        code: 'EXTENSION_AUTH_REQUIRED'
      });
    }

    logger.debug('[requireExtensionAuth] Extension auth verified');
    next();

  } catch (error) {
    logger.error('[requireExtensionAuth] Error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'EXTENSION_AUTH_ERROR'
    });
  }
};

/**
 * Get authentication context with helper methods
 */
const getAuthContext = (req) => {
  return {
    source: req.authSource || AUTH_SOURCES.WEB,
    isExtension: req.isExtensionAuth || false,
    isWeb: !req.isExtensionAuth,

    /**
     * Generate success redirect URL based on auth source
     */
    getSuccessRedirectURL: (token) => {
      if (req.isExtensionAuth) {
        // VSCode extension callback - CUSTOMIZE THIS FOR PIPESHUB
        return `pipeshub://pipeshub.extension/auth-callback?token=${encodeURIComponent(token)}`;
      } else {
        // Web application redirect
        return `${process.env.DOMAIN_CLIENT || 'http://localhost:3000'}/c/new`;
      }
    },

    /**
     * Generate error redirect URL based on auth source
     */
    getErrorRedirectURL: (error) => {
      if (req.isExtensionAuth) {
        return `pipeshub://pipeshub.extension/auth-error?error=${encodeURIComponent(error)}`;
      } else {
        return `${process.env.DOMAIN_CLIENT || 'http://localhost:3000'}/login?error=${encodeURIComponent(error)}`;
      }
    }
  };
};

// Export middleware and utilities
module.exports = {
  // Core middleware
  detectAuthSource,
  requireExtensionAuth,

  // Constants
  AUTH_SOURCES,
  VALID_SOURCES,

  // Utilities
  getAuthContext,

  // Convenience exports
  extensionOnly: [detectAuthSource, requireExtensionAuth],
  sourceAware: detectAuthSource
};
```

---

### PHASE 3: ENHANCED JWT SERVICE

**Location**: `api/server/services/AuthService.js` (**MODIFY EXISTING FILE**)

Add these functions to your existing AuthService:

```javascript
const jwt = require('jsonwebtoken');
const { getUserById } = require('~/models');

/**
 * Generate enhanced JWT token for extension users
 * Contains plan, permissions, usage limits, and user profile
 */
const generateEnhancedToken = async (user, authSource = 'web') => {
  try {
    // Base payload (for both web and extension)
    const basePayload = {
      id: user._id.toString(),
      username: user.username,
      provider: user.provider,
      email: user.email
    };

    // Enhanced payload for extension
    const enhancedPayload = {
      ...basePayload,

      // Extension-specific fields
      userId: user._id.toString(),
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      imageUrl: user.imageUrl || '',
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',

      // Business logic
      plan: user.plan || 'free',
      permissions: user.permissions || ['basic_usage'],

      // Usage limits
      dailyTokenLimit: user.dailyTokenLimit || 50000,
      monthlyTokenLimit: user.monthlyTokenLimit || 1500000,
      dailyRequestLimit: user.dailyRequestLimit || 1000,
      monthlyRequestLimit: user.monthlyRequestLimit || 30000,

      // Timestamps
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.getTime() : Date.now(),
      createdAt: user.createdAt ? new Date(user.createdAt).getTime() : Date.now()
    };

    // Choose payload based on source
    const payload = authSource === 'extension' ? enhancedPayload : basePayload;

    // Token expiry: 24 hours for extension, 15 minutes for web
    const expiresIn = authSource === 'extension' ? '24h' : '15m';

    // Sign JWT token
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      {
        expiresIn,
        issuer: 'pipeshub-openanalyst'
      }
    );

    return token;

  } catch (error) {
    console.error('[generateEnhancedToken] Error:', error);
    throw error;
  }
};

/**
 * Set enhanced auth tokens with cookies
 */
const setEnhancedAuthTokens = async (userId, res, sessionId = null, authSource = 'web') => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate enhanced token
    const token = await generateEnhancedToken(user, authSource);

    // Set cookies based on auth source
    const isProduction = process.env.NODE_ENV === 'production';

    if (authSource === 'web') {
      res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      res.cookie('token_provider', 'pipeshub', {
        httpOnly: true,
        secure: isProduction
      });
    } else if (authSource === 'extension') {
      res.cookie('token_provider', 'pipeshub-extension', {
        httpOnly: true,
        secure: isProduction
      });
    }

    return token;

  } catch (error) {
    console.error('[setEnhancedAuthTokens] Error:', error);
    throw error;
  }
};

/**
 * Register PipesHub extension user
 * Creates user with default PipesHub profile fields
 */
const registerPipesHubUser = async (userData) => {
  const { email, password, firstName, lastName, username, provider } = userData;

  try {
    const { findUser, createUser } = require('~/models');

    // Check if user exists
    const existingUser = await findUser({ email: email.toLowerCase() });
    if (existingUser) {
      return {
        status: 409,
        message: 'User already exists'
      };
    }

    // Create user with PipesHub profile
    const newUserData = {
      provider: provider || 'pipeshub',
      email: email.toLowerCase(),
      password: password, // Will be hashed by your user model
      firstName: firstName || '',
      lastName: lastName || '',
      username: username || email.split('@')[0],

      // PipesHub extension fields
      plan: 'free',
      permissions: ['basic_usage', 'extension_access'],
      dailyTokenLimit: 50000,
      monthlyTokenLimit: 1500000,
      dailyRequestLimit: 1000,
      monthlyRequestLimit: 30000,
      lastLoginAt: new Date()
    };

    // Create user
    const newUser = await createUser(newUserData);

    console.log('[registerPipesHubUser] User created:', newUser.email);

    return {
      status: 200,
      message: 'User registered successfully',
      user: newUser
    };

  } catch (error) {
    console.error('[registerPipesHubUser] Error:', error);
    return {
      status: 500,
      message: 'Registration failed'
    };
  }
};

// Export functions
module.exports = {
  generateEnhancedToken,
  setEnhancedAuthTokens,
  registerPipesHubUser,
  // ... your existing exports
};
```

---

### PHASE 4: EXTENSION AUTH CONTROLLER

**Location**: `api/server/controllers/auth/ExtensionAuthController.js` (**CREATE NEW FILE**)

```javascript
const { logger } = require('@librechat/data-schemas');
const {
  registerPipesHubUser,
  generateEnhancedToken,
  setEnhancedAuthTokens
} = require('~/server/services/AuthService');
const {
  findUser,
  getUserById,
  updateUser
} = require('~/models');
const { getAuthContext } = require('~/server/middleware/sourceDetection');

/**
 * POST /api/auth/extension/token
 * Generate JWT token for authenticated extension users
 */
const generateExtensionToken = async (req, res) => {
  try {
    logger.info('[ExtensionAuth] Token generation requested', {
      ip: req.ip,
      authSource: req.authSource
    });

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const user = req.user;

    // Ensure user has PipesHub fields
    if (!user.plan || !user.permissions) {
      logger.info('[ExtensionAuth] Populating PipesHub fields', {
        userId: user._id,
        email: user.email
      });

      await updateUser(user._id, {
        plan: 'free',
        permissions: ['basic_usage', 'extension_access'],
        dailyTokenLimit: 50000,
        monthlyTokenLimit: 1500000,
        dailyRequestLimit: 1000,
        monthlyRequestLimit: 30000,
        lastLoginAt: new Date()
      });

      req.user = await getUserById(user._id);
    }

    // Generate enhanced JWT
    const token = await generateEnhancedToken(req.user, 'extension');
    const authContext = getAuthContext(req);

    logger.info('[ExtensionAuth] Token generated', {
      userId: req.user._id,
      email: req.user.email,
      plan: req.user.plan
    });

    res.json({
      success: true,
      token,
      user: {
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName || '',
        lastName: req.user.lastName || '',
        plan: req.user.plan || 'free',
        permissions: req.user.permissions || ['basic_usage'],
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
      },
      callbackUrl: authContext.getSuccessRedirectURL(token),
      expiresIn: 24 * 60 * 60, // 24 hours
      tokenType: 'Bearer'
    });

  } catch (error) {
    logger.error('[ExtensionAuth] Token generation error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate extension token',
      code: 'TOKEN_GENERATION_ERROR'
    });
  }
};

/**
 * GET /api/auth/extension/callback
 * Handle OAuth callback for extension
 */
const handleExtensionCallback = async (req, res) => {
  try {
    logger.info('[ExtensionAuth] Callback initiated', {
      authSource: req.authSource,
      ip: req.ip
    });

    if (!req.user) {
      logger.error('[ExtensionAuth] Callback without user');
      const authContext = getAuthContext(req);
      return res.redirect(authContext.getErrorRedirectURL('Authentication failed'));
    }

    const user = req.user;

    // Ensure PipesHub profile
    if (!user.plan || !user.permissions) {
      logger.info('[ExtensionAuth] Setting up PipesHub profile', {
        userId: user._id,
        email: user.email
      });

      const registrationResult = await registerPipesHubUser({
        email: user.email,
        firstName: user.firstName || user.name?.split(' ')[0] || '',
        lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
        username: user.username,
        provider: user.provider || 'extension-oauth'
      });

      if (registrationResult.status !== 200) {
        await updateUser(user._id, {
          plan: 'free',
          permissions: ['basic_usage', 'extension_access'],
          dailyTokenLimit: 50000,
          monthlyTokenLimit: 1500000,
          dailyRequestLimit: 1000,
          monthlyRequestLimit: 30000
        });
      }
    }

    const updatedUser = await getUserById(user._id);
    const token = await generateEnhancedToken(updatedUser, 'extension');
    await setEnhancedAuthTokens(updatedUser._id, res, null, 'extension');

    const authContext = getAuthContext(req);
    const callbackUrl = authContext.getSuccessRedirectURL(token);

    logger.info('[ExtensionAuth] Callback completed', {
      userId: updatedUser._id,
      email: updatedUser.email
    });

    res.redirect(callbackUrl);

  } catch (error) {
    logger.error('[ExtensionAuth] Callback error', {
      error: error.message,
      stack: error.stack
    });

    const authContext = getAuthContext(req);
    res.redirect(authContext.getErrorRedirectURL('Authentication failed'));
  }
};

/**
 * POST /api/auth/extension/register
 * Register new extension user
 */
const registerExtensionUser = async (req, res) => {
  try {
    logger.info('[ExtensionAuth] Registration requested', {
      email: req.body.email,
      ip: req.ip
    });

    const { email, password, firstName, lastName, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const existingUser = await findUser({ email: email.toLowerCase() });
    if (existingUser) {
      logger.warn('[ExtensionAuth] User already exists', { email });
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
        code: 'USER_ALREADY_EXISTS'
      });
    }

    const registrationResult = await registerPipesHubUser({
      email,
      password,
      firstName: firstName || '',
      lastName: lastName || '',
      username: username || email.split('@')[0],
      provider: 'extension-local'
    });

    if (registrationResult.status !== 200) {
      return res.status(registrationResult.status).json({
        success: false,
        error: registrationResult.message,
        code: 'REGISTRATION_FAILED'
      });
    }

    const newUser = await findUser({ email: email.toLowerCase() });
    const token = await generateEnhancedToken(newUser, 'extension');
    await setEnhancedAuthTokens(newUser._id, res, null, 'extension');

    logger.info('[ExtensionAuth] User registered', {
      userId: newUser._id,
      email: newUser.email
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName || '',
        lastName: newUser.lastName || '',
        plan: newUser.plan || 'free',
        permissions: newUser.permissions || ['basic_usage'],
        createdAt: newUser.createdAt
      },
      tokenType: 'Bearer',
      expiresIn: 24 * 60 * 60
    });

  } catch (error) {
    logger.error('[ExtensionAuth] Registration error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
};

/**
 * GET /api/auth/extension/profile
 * Get extension user profile
 */
const getExtensionProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    const user = req.user;

    const profile = {
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        imageUrl: user.imageUrl || '',
        plan: user.plan || 'free',
        permissions: user.permissions || ['basic_usage'],
        dailyTokenLimit: user.dailyTokenLimit || 50000,
        monthlyTokenLimit: user.monthlyTokenLimit || 1500000,
        dailyRequestLimit: user.dailyRequestLimit || 1000,
        monthlyRequestLimit: user.monthlyRequestLimit || 30000,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
      }
    };

    logger.debug('[ExtensionAuth] Profile retrieved', {
      userId: user._id,
      plan: user.plan
    });

    res.json(profile);

  } catch (error) {
    logger.error('[ExtensionAuth] Profile error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile',
      code: 'PROFILE_ERROR'
    });
  }
};

module.exports = {
  generateExtensionToken,
  handleExtensionCallback,
  registerExtensionUser,
  getExtensionProfile
};
```

---

### PHASE 5: UPDATE AUTH ROUTES

**Location**: `api/server/routes/auth.js` (**MODIFY EXISTING FILE**)

Add extension routes to your existing auth router:

```javascript
const express = require('express');
const router = express.Router();

// Import extension controllers
const {
  generateExtensionToken,
  handleExtensionCallback,
  registerExtensionUser,
  getExtensionProfile
} = require('~/server/controllers/auth/ExtensionAuthController');

// Import source detection middleware
const sourceDetection = require('~/server/middleware/sourceDetection');
const middleware = require('~/server/middleware');

// ===== EXTENSION AUTHENTICATION ROUTES =====

/**
 * Extension token generation
 * Requires JWT authentication
 */
router.post(
  '/extension/token',
  sourceDetection.extensionOnly,
  middleware.requireJwtAuth,
  generateExtensionToken
);

/**
 * Extension OAuth callback
 * Handles redirect after OAuth flow
 */
router.get(
  '/extension/callback',
  sourceDetection.detectAuthSource,
  handleExtensionCallback
);

/**
 * Extension user registration
 * Creates new user with PipesHub profile
 */
router.post(
  '/extension/register',
  sourceDetection.extensionOnly,
  middleware.registerLimiter,
  middleware.checkBan,
  registerExtensionUser
);

/**
 * Extension user profile
 * Returns user info with PipesHub fields
 */
router.get(
  '/extension/profile',
  sourceDetection.extensionOnly,
  middleware.requireJwtAuth,
  getExtensionProfile
);

// ===== ENHANCED EXISTING ROUTES =====
// Add source detection to your existing login and register routes

/**
 * Enhanced login route with source detection
 * Supports both web and extension authentication
 */
router.post(
  '/login',
  sourceDetection.detectAuthSource, // ADD THIS LINE
  middleware.loginLimiter,
  middleware.checkBan,
  middleware.requireLocalAuth, // Your existing auth middleware
  loginController // Your existing controller
);

/**
 * Enhanced registration route with source detection
 * Supports both web and extension registration
 */
router.post(
  '/register',
  sourceDetection.detectAuthSource, // ADD THIS LINE
  middleware.registerLimiter,
  middleware.checkBan,
  middleware.validateRegistration,
  registrationController // Your existing controller
);

// ... rest of your existing routes ...

module.exports = router;
```

---

### PHASE 6: UPDATE LOGIN CONTROLLER

**Location**: `api/server/controllers/auth/LoginController.js` (**MODIFY EXISTING FILE**)

Enhance your existing login controller with extension support:

```javascript
const { setEnhancedAuthTokens } = require('~/server/services/AuthService');
const { getAuthContext } = require('~/server/middleware/sourceDetection');
const { updateUser, getUserById } = require('~/models');

const loginController = async (req, res) => {
  try {
    const user = req.user; // From passport authentication
    const authSource = req.authSource || 'web';

    // ===== EXTENSION AUTHENTICATION HANDLING =====
    if (req.isExtensionAuth || authSource === 'extension') {

      // Ensure PipesHub fields are populated
      if (!user.plan || !user.permissions) {
        await updateUser(user._id, {
          plan: 'free',
          permissions: ['basic_usage', 'extension_access'],
          dailyTokenLimit: 50000,
          monthlyTokenLimit: 1500000,
          dailyRequestLimit: 1000,
          monthlyRequestLimit: 30000,
          lastLoginAt: new Date()
        });

        // Refresh user data
        const updatedUser = await getUserById(user._id);
        req.user = updatedUser;
      }

      // Generate enhanced 24-hour JWT
      const token = await setEnhancedAuthTokens(user._id, res, null, 'extension');

      // Get callback URL for VSCode redirect
      const authContext = getAuthContext(req);

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          plan: user.plan || 'free',
          permissions: user.permissions || ['basic_usage'],
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'development'
        },
        authSource: 'extension',
        callbackUrl: authContext.getSuccessRedirectURL(token),
        expiresIn: 24 * 60 * 60,
        tokenType: 'Bearer'
      });
    }

    // ===== WEB AUTHENTICATION HANDLING =====
    // Your existing web login code here
    // ...

  } catch (error) {
    console.error('[LoginController] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
};

module.exports = { loginController };
```

---

### PHASE 7: PIPESHUB EXTENSION API ROUTES

**Location**: `api/server/routes/pipeshub.js` (**CREATE NEW FILE**)

```javascript
const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const { detectAuthSource } = require('~/server/middleware/sourceDetection');
const { User } = require('~/models'); // Adjust based on your model location
const { logger } = require('@librechat/data-schemas');

const router = express.Router();

// ===== PUBLIC HEALTH CHECK =====

/**
 * GET /api/pipeshub/health
 * Public endpoint - no authentication required
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'PipesHub Extension API',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: [
      'Provider Profile Management',
      'Extension Settings Sync',
      'Usage Tracking & Analytics',
      'JWT Authentication Integration'
    ]
  });
});

// ===== AUTHENTICATED ROUTES =====
// Apply authentication middleware to all routes below
router.use(detectAuthSource);
router.use(requireJwtAuth);

// Request logger
router.use((req, res, next) => {
  if (req.isExtensionAuth) {
    logger.info(`[PipesHub API] ${req.method} ${req.path}`, {
      userId: req.user?.id || 'unknown',
      userAgent: req.get('User-Agent')
    });
  }
  next();
});

// ===== PROVIDER MANAGEMENT API =====

/**
 * GET /api/pipeshub/providers
 * Get user's AI provider profiles
 */
router.get('/providers', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('providerProfiles')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const profiles = user.providerProfiles || [];

    logger.info(`[PipesHub] Retrieved ${profiles.length} provider profiles`, {
      userId: req.user.id
    });

    res.json({
      success: true,
      data: profiles,
      message: `Retrieved ${profiles.length} provider profiles`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub Providers GET]', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider profiles',
      code: 'PROVIDERS_RETRIEVE_ERROR'
    });
  }
});

/**
 * POST /api/pipeshub/providers
 * Create new AI provider profile
 */
router.post('/providers', async (req, res) => {
  try {
    const { name, provider, settings, encryptedKey, isActive = true } = req.body;

    // Validation
    if (!name || !provider || !settings) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, provider, settings',
        code: 'VALIDATION_ERROR'
      });
    }

    // Create new profile
    const newProfile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: String(name).trim(),
      provider: String(provider).toLowerCase().trim(),
      settings: settings,
      encryptedKey: encryptedKey || null,
      isActive: Boolean(isActive),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: req.user.id
    };

    // Add to user's provider profiles
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: { providerProfiles: newProfile },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );

    logger.info(`[PipesHub] Created provider profile '${name}'`, {
      userId: req.user.id,
      provider: provider
    });

    res.status(201).json({
      success: true,
      data: newProfile,
      message: `Provider profile '${name}' created successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub Providers POST]', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create provider profile',
      code: 'PROVIDERS_CREATE_ERROR'
    });
  }
});

/**
 * PUT /api/pipeshub/providers/:id
 * Update existing provider profile
 */
router.put('/providers/:id', async (req, res) => {
  try {
    const profileId = req.params.id;
    const updateData = req.body;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: 'Provider profile ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Allowed update fields
    const allowedUpdates = ['name', 'settings', 'encryptedKey', 'isActive'];
    const updates = {};

    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[`providerProfiles.$.${key}`] = updateData[key];
      }
    });

    updates['providerProfiles.$.updatedAt'] = new Date();
    updates['updatedAt'] = new Date();

    // Update specific profile
    const result = await User.findOneAndUpdate(
      {
        _id: req.user.id,
        'providerProfiles.id': profileId
      },
      { $set: updates },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Provider profile not found',
        code: 'PROVIDER_NOT_FOUND'
      });
    }

    const updatedProfile = result.providerProfiles.find(p => p.id === profileId);

    logger.info(`[PipesHub] Updated provider profile '${profileId}'`, {
      userId: req.user.id
    });

    res.json({
      success: true,
      data: updatedProfile,
      message: 'Provider profile updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub Providers PUT]', {
      error: error.message,
      userId: req.user?.id,
      profileId: req.params.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update provider profile',
      code: 'PROVIDERS_UPDATE_ERROR'
    });
  }
});

/**
 * DELETE /api/pipeshub/providers/:id
 * Delete provider profile
 */
router.delete('/providers/:id', async (req, res) => {
  try {
    const profileId = req.params.id;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: 'Provider profile ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Remove profile from array
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $pull: { providerProfiles: { id: profileId } },
        $set: { updatedAt: new Date() }
      }
    );

    logger.info(`[PipesHub] Deleted provider profile '${profileId}'`, {
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Provider profile deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub Providers DELETE]', {
      error: error.message,
      userId: req.user?.id,
      profileId: req.params.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete provider profile',
      code: 'PROVIDERS_DELETE_ERROR'
    });
  }
});

// ===== SETTINGS MANAGEMENT API =====

/**
 * GET /api/pipeshub/settings
 * Get user's extension settings
 */
router.get('/settings', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('extensionSettings')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const settings = user.extensionSettings || {
      settings: {},
      version: 1,
      syncedAt: new Date()
    };

    logger.info('[PipesHub] Retrieved settings', {
      userId: req.user.id
    });

    res.json({
      success: true,
      data: settings,
      message: 'Extension settings retrieved successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub Settings GET]', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve settings',
      code: 'SETTINGS_RETRIEVE_ERROR'
    });
  }
});

/**
 * PUT /api/pipeshub/settings
 * Update user's extension settings
 */
router.put('/settings', async (req, res) => {
  try {
    const { settings, version } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Settings object is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const updatedSettings = {
      settings: settings,
      version: Number(version) || 1,
      syncedAt: new Date()
    };

    await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          extensionSettings: updatedSettings,
          updatedAt: new Date()
        }
      }
    );

    logger.info('[PipesHub] Updated settings', {
      userId: req.user.id,
      version: updatedSettings.version
    });

    res.json({
      success: true,
      data: updatedSettings,
      message: 'Extension settings updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub Settings PUT]', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      code: 'SETTINGS_UPDATE_ERROR'
    });
  }
});

// ===== USAGE TRACKING API =====

/**
 * POST /api/pipeshub/usage/track
 * Track API usage (tokens, requests, cost)
 */
router.post('/usage/track', async (req, res) => {
  try {
    const { provider, model, tokens, cost, requests = 1, metadata } = req.body;

    // Validation
    if (!provider || tokens === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: provider, tokens',
        code: 'VALIDATION_ERROR'
      });
    }

    const numTokens = Number(tokens);
    const numCost = cost !== undefined ? Number(cost) : 0;
    const numRequests = Number(requests);

    if (isNaN(numTokens) || isNaN(numCost) || isNaN(numRequests)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid numeric values',
        code: 'VALIDATION_ERROR'
      });
    }

    // Create usage record
    const usageRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: req.user.id,
      provider: String(provider).trim(),
      model: model ? String(model).trim() : null,
      tokens: numTokens,
      cost: numCost,
      requests: numRequests,
      metadata: metadata || {},
      timestamp: new Date(),
      source: 'extension'
    };

    // Add to user's usage history (keep last 1000 records)
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: {
          usageHistory: {
            $each: [usageRecord],
            $slice: -1000 // Keep only last 1000
          }
        },
        $set: { updatedAt: new Date() }
      }
    );

    logger.info('[PipesHub] Tracked usage', {
      userId: req.user.id,
      provider: provider,
      tokens: numTokens,
      cost: numCost
    });

    res.status(201).json({
      success: true,
      data: usageRecord,
      message: 'Usage tracked successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub Usage Track]', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to track usage',
      code: 'USAGE_TRACK_ERROR'
    });
  }
});

/**
 * GET /api/pipeshub/usage/stats
 * Get usage statistics with filtering
 */
router.get('/usage/stats', async (req, res) => {
  try {
    const {
      period = 'month',
      provider,
      limit = 100,
      startDate,
      endDate
    } = req.query;

    const user = await User.findById(req.user.id)
      .select('usageHistory')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Calculate date range
    const now = new Date();
    let filterStartDate;

    if (startDate) {
      filterStartDate = new Date(startDate);
    } else {
      switch (period) {
        case 'day':
          filterStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          filterStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          filterStartDate = new Date(now.getFullYear(), 0, 1);
          break;
        default: // month
          filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }

    const filterEndDate = endDate ? new Date(endDate) : now;

    // Filter usage records
    const usageHistory = user.usageHistory || [];
    const filteredUsage = usageHistory
      .filter(record => {
        const recordDate = new Date(record.timestamp);
        const dateMatch = recordDate >= filterStartDate && recordDate <= filterEndDate;
        const providerMatch = !provider || record.provider === provider;
        return dateMatch && providerMatch;
      })
      .slice(0, parseInt(limit));

    // Aggregate statistics
    const stats = {
      period: period,
      startDate: filterStartDate.toISOString(),
      endDate: filterEndDate.toISOString(),
      totalTokens: filteredUsage.reduce((sum, r) => sum + (r.tokens || 0), 0),
      totalCost: parseFloat(filteredUsage.reduce((sum, r) => sum + (r.cost || 0), 0).toFixed(4)),
      totalRequests: filteredUsage.reduce((sum, r) => sum + (r.requests || 1), 0),
      recordCount: filteredUsage.length,
      providerBreakdown: {}
    };

    // Provider breakdown
    filteredUsage.forEach(record => {
      const p = record.provider;
      if (!stats.providerBreakdown[p]) {
        stats.providerBreakdown[p] = {
          tokens: 0,
          cost: 0,
          requests: 0,
          recordCount: 0
        };
      }
      stats.providerBreakdown[p].tokens += record.tokens || 0;
      stats.providerBreakdown[p].cost += record.cost || 0;
      stats.providerBreakdown[p].requests += record.requests || 1;
      stats.providerBreakdown[p].recordCount += 1;
    });

    // Round costs
    Object.keys(stats.providerBreakdown).forEach(p => {
      stats.providerBreakdown[p].cost = parseFloat(
        stats.providerBreakdown[p].cost.toFixed(4)
      );
    });

    logger.info('[PipesHub] Retrieved usage stats', {
      userId: req.user.id,
      period: period,
      recordCount: stats.recordCount
    });

    res.json({
      success: true,
      data: stats,
      message: 'Usage statistics retrieved successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub Usage Stats]', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage statistics',
      code: 'USAGE_STATS_ERROR'
    });
  }
});

// ===== USER INFORMATION API =====

/**
 * GET /api/pipeshub/user/info
 * Get current user information
 */
router.get('/user/info', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'User information retrieved successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub User Info]', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user information',
      code: 'USER_INFO_ERROR'
    });
  }
});

/**
 * PUT /api/pipeshub/user/profile
 * Update user profile
 */
router.put('/user/profile', async (req, res) => {
  try {
    const { firstName, lastName, imageUrl } = req.body;

    const updates = {};
    if (firstName !== undefined) updates.firstName = String(firstName).trim();
    if (lastName !== undefined) updates.lastName = String(lastName).trim();
    if (imageUrl !== undefined) updates.imageUrl = String(imageUrl).trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        code: 'VALIDATION_ERROR'
      });
    }

    updates.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select('-password -__v');

    logger.info('[PipesHub] Updated user profile', {
      userId: req.user.id,
      fields: Object.keys(updates)
    });

    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[PipesHub User Profile]', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_ERROR'
    });
  }
});

module.exports = router;
```

---

### PHASE 8: MOUNT ROUTES IN MAIN SERVER

**Location**: `api/server/index.js` (**MODIFY EXISTING FILE**)

```javascript
const express = require('express');
const app = express();

// ... your existing middleware (body-parser, cors, etc.) ...

// Import routes
const authRoutes = require('./routes/auth');
const pipeshubRoutes = require('./routes/pipeshub');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/pipeshub', pipeshubRoutes);

// ... your other existing routes ...

module.exports = app;
```

---

### PHASE 9: ENVIRONMENT CONFIGURATION

**Location**: `.env` (**MODIFY EXISTING FILE**)

Add or update these environment variables:

```bash
# ===== JWT Configuration =====
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-too-min-32-chars

# Token Expiry
SESSION_EXPIRY=900000                      # 15 minutes in ms (web)
REFRESH_TOKEN_EXPIRY=604800000             # 7 days in ms
EXTENSION_TOKEN_EXPIRY=86400               # 24 hours in seconds

# ===== Server Configuration =====
DOMAIN_CLIENT=http://localhost:3080
DOMAIN_SERVER=http://localhost:3080
PORT=3080

# ===== Database =====
MONGO_URI=mongodb://127.0.0.1:27017/PipesHub

# ===== App Branding =====
APP_TITLE=PipesHub
HELP_AND_FAQ_URL=https://pipeshub.com

# ===== Node Environment =====
NODE_ENV=development

# ===== CORS Origins (comma-separated) =====
CORS_ORIGINS=http://localhost:3080,http://localhost:3090,vscode://pipeshub.pipeshub-extension,pipeshub://
```

---

### PHASE 10: CORS CONFIGURATION

**Location**: `api/server/index.js` (**MODIFY CORS SETUP**)

```javascript
const cors = require('cors');

// Parse CORS origins from environment
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3080',
      'http://localhost:3090',
      'vscode://pipeshub.pipeshub-extension',
      'pipeshub://'
    ];

// Configure CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is allowed
    if (corsOrigins.some(allowedOrigin => {
      // Exact match or wildcard match
      return allowedOrigin === origin ||
             allowedOrigin.startsWith('*') ||
             origin.startsWith(allowedOrigin.replace('*', ''));
    })) {
      return callback(null, true);
    }

    // Check for VSCode extension protocol
    if (origin.startsWith('vscode://') || origin.startsWith('pipeshub://')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-source'],
  exposedHeaders: ['set-cookie']
}));
```

---

## 🧪 TESTING GUIDE

### Test 1: Health Check

```bash
curl http://localhost:3080/api/pipeshub/health
```

**Expected Response:**
```json
{
  "success": true,
  "service": "PipesHub Extension API",
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "features": [
    "Provider Profile Management",
    "Extension Settings Sync",
    "Usage Tracking & Analytics",
    "JWT Authentication Integration"
  ]
}
```

### Test 2: Extension Login Flow

**Step 1: Open browser**
```
http://localhost:3080/login?source=extension
```

**Step 2: Login with credentials**

**Step 3: Verify redirect**
```
Should redirect to: pipeshub://pipeshub.extension/auth-callback?token=<JWT>
```

### Test 3: Verify JWT Token

```bash
# Decode JWT payload (replace YOUR_TOKEN with actual token)
node -e "const token = 'YOUR_TOKEN'; const parts = token.split('.'); const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()); console.log(JSON.stringify(payload, null, 2));"
```

**Expected JWT payload:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "userId": "user-id",
  "firstName": "John",
  "lastName": "Doe",
  "plan": "free",
  "permissions": ["basic_usage", "extension_access"],
  "dailyTokenLimit": 50000,
  "monthlyTokenLimit": 1500000,
  "dailyRequestLimit": 1000,
  "monthlyRequestLimit": 30000,
  "environment": "development",
  "iat": 1705320000,
  "exp": 1705406400,
  "iss": "pipeshub-openanalyst"
}
```

### Test 4: Provider API

```bash
# Get providers
curl -X GET http://localhost:3080/api/pipeshub/providers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create provider
curl -X POST http://localhost:3080/api/pipeshub/providers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OpenAI GPT-4",
    "provider": "openai",
    "settings": {
      "model": "gpt-4",
      "temperature": 0.7,
      "maxTokens": 2000
    },
    "encryptedKey": "encrypted-api-key-here",
    "isActive": true
  }'
```

### Test 5: Settings API

```bash
# Get settings
curl -X GET http://localhost:3080/api/pipeshub/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update settings
curl -X PUT http://localhost:3080/api/pipeshub/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "theme": "dark",
      "autoSave": true,
      "notifications": true
    },
    "version": 2
  }'
```

### Test 6: Usage Tracking

```bash
# Track usage
curl -X POST http://localhost:3080/api/pipeshub/usage/track \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4",
    "tokens": 150,
    "cost": 0.003,
    "requests": 1,
    "metadata": {
      "endpoint": "chat/completions",
      "responseTime": 1250
    }
  }'

# Get usage stats
curl -X GET "http://localhost:3080/api/pipeshub/usage/stats?period=month" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 7: Database Verification

```bash
# Connect to MongoDB
mongosh mongodb://127.0.0.1:27017/PipesHub

# Check user document
db.users.findOne({ email: "test@example.com" })

# Verify PipesHub fields exist
db.users.findOne(
  { email: "test@example.com" },
  {
    plan: 1,
    permissions: 1,
    providerProfiles: 1,
    extensionSettings: 1,
    usageHistory: 1
  }
)
```

---

## ✅ DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All phases implemented (1-10)
- [ ] Database schema extended
- [ ] All middleware created
- [ ] All controllers created
- [ ] All routes mounted
- [ ] Environment variables configured
- [ ] CORS configured

### Testing

- [ ] Health check endpoint works
- [ ] Extension login flow works
- [ ] JWT tokens generated correctly
- [ ] Providers API works (GET, POST, PUT, DELETE)
- [ ] Settings API works (GET, PUT)
- [ ] Usage tracking works (POST, GET)
- [ ] User info API works
- [ ] Database fields populated correctly

### Security

- [ ] JWT_SECRET changed from default (min 32 characters)
- [ ] JWT_REFRESH_SECRET changed from default (min 32 characters)
- [ ] CORS origins configured properly
- [ ] HTTPS enabled (production only)
- [ ] Rate limiting configured on auth endpoints
- [ ] Input validation implemented
- [ ] Password hashing enabled

### Production

- [ ] NODE_ENV=production
- [ ] Production MongoDB URI configured
- [ ] Production domain configured (DOMAIN_CLIENT, DOMAIN_SERVER)
- [ ] Secure cookies enabled (secure: true)
- [ ] Logging configured
- [ ] Error tracking setup (Sentry, etc.)
- [ ] Database indexes created
- [ ] Backup strategy implemented

### Documentation

- [ ] API endpoints documented
- [ ] OpenAnalyst team notified with:
  - Backend URL
  - Custom protocol (pipeshub://)
  - API endpoint list
- [ ] Internal team trained on new authentication flow

---

## 📤 WHAT TO GIVE OPENANALYST

### 1. Backend URL

```
Development: http://localhost:3080
Production: https://api.pipeshub.com  (or your domain)
```

### 2. Custom Protocol

```
pipeshub://pipeshub.extension/auth-callback
```

### 3. API Endpoints Documentation

Send this table to OpenAnalyst developers:

```markdown
# PipesHub API Endpoints for OpenAnalyst Extension

## Authentication Base URL
Development: http://localhost:3080
Production: https://api.pipeshub.com

## Authentication Endpoints

### Login (Web Browser)
GET /api/auth/login?source=extension

### Register (Web Browser)
GET /api/auth/register?source=extension

### Extension Token (After Auth)
POST /api/auth/extension/token
Headers: Authorization: Bearer <JWT>

### Extension Profile
GET /api/auth/extension/profile
Headers: Authorization: Bearer <JWT>

## Extension API (All require JWT)

### Health Check (Public)
GET /api/pipeshub/health

### Providers
GET    /api/pipeshub/providers
POST   /api/pipeshub/providers
PUT    /api/pipeshub/providers/:id
DELETE /api/pipeshub/providers/:id

### Settings
GET /api/pipeshub/settings
PUT /api/pipeshub/settings

### Usage
POST /api/pipeshub/usage/track
GET  /api/pipeshub/usage/stats

### User
GET /api/pipeshub/user/info
PUT /api/pipeshub/user/profile

All authenticated endpoints require:
Headers: {
  "Authorization": "Bearer <JWT>",
  "Content-Type": "application/json"
}
```

### 4. Authentication Flow Diagram

```
User clicks "Login" in Extension
    ↓
Extension opens browser:
http://localhost:3080/login?source=extension
    ↓
User authenticates (email/password or OAuth)
    ↓
PipesHub generates 24-hour JWT
    ↓
Browser redirects to:
pipeshub://pipeshub.extension/auth-callback?token=<JWT>
    ↓
Extension catches redirect, stores token
    ↓
Extension makes API calls with:
Authorization: Bearer <JWT>
```

### 5. JWT Token Structure

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "plan": "free",
  "permissions": ["basic_usage", "extension_access"],
  "dailyTokenLimit": 50000,
  "monthlyTokenLimit": 1500000,
  "dailyRequestLimit": 1000,
  "monthlyRequestLimit": 30000,
  "environment": "production",
  "exp": 1705406400
}
```

### 6. Error Handling

All API errors return:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `AUTHENTICATION_REQUIRED` (401)
- `EXTENSION_AUTH_REQUIRED` (403)
- `USER_NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `INTERNAL_ERROR` (500)

---

## 🎉 SUCCESS CRITERIA

Your implementation is successful when:

1. ✅ Health check returns 200 OK
2. ✅ Extension can open login page with `?source=extension`
3. ✅ User can authenticate and get redirected to `pipeshub://` protocol
4. ✅ JWT token contains all required fields
5. ✅ Extension can call all API endpoints successfully
6. ✅ User data persists across web and extension
7. ✅ Provider profiles can be created, updated, deleted
8. ✅ Settings sync between extension and database
9. ✅ Usage tracking stores data correctly
10. ✅ All tests pass (see Testing Guide)

---

## 📞 SUPPORT

If you encounter issues during implementation:

1. Check logs for error messages
2. Verify environment variables are set correctly
3. Ensure MongoDB is running and accessible
4. Test each phase independently
5. Use the testing guide to isolate problems

---

## 🔄 VERSION HISTORY

- **v1.0.0** - Initial migration guide (no balance system)
- Date: 2024-01-15
- Author: PipesHub Development Team

---

**🎯 This guide provides 100% executable code for successful OpenAnalyst integration with PipesHub!**
