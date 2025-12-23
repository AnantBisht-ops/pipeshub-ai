# MCP Integration Service - Complete Workflow

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Connector Types](#connector-types)
4. [User Journey: OAuth Connectors](#user-journey-oauth-connectors)
5. [User Journey: Database Connectors](#user-journey-database-connectors)
6. [Agent Tool Execution](#agent-tool-execution)
7. [API Endpoints](#api-endpoints)
8. [Data Storage](#data-storage)
9. [Security Model](#security-model)
10. [OA Team Requirements](#oa-team-requirements)

---

## System Overview

The MCP Integration Service is a unified API gateway that enables AI agents to:
- Connect to user's SaaS applications (Gmail, Slack, BigQuery) via OAuth
- Connect to user's databases (PostgreSQL, MySQL, Redis, MongoDB) via credentials
- Execute tools/actions on behalf of authenticated users

**Production URL:** `https://mcp.openanalyst.com`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│                              OPEN ANALYST (OA) SYSTEM                               │
│                                                                                     │
│   ┌─────────────────┐         ┌─────────────────────────────────────────────────┐   │
│   │                 │         │                                                 │   │
│   │   OA Frontend   │◀───────▶│                  OA Backend                     │   │
│   │   (User UI)     │         │                                                 │   │
│   │                 │         │                                                 │   │
│   └─────────────────┘         └──────────────────────┬──────────────────────────┘   │
│                                                      │                              │
└──────────────────────────────────────────────────────┼──────────────────────────────┘
                                                       │
                                                       │ X-API-Key + user_id
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│                         MCP SERVICE (mcp.openanalyst.com)                           │
│                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                              API LAYER                                       │   │
│   │                                                                              │   │
│   │   /api/integrations    /api/databases    /api/tools                          │   │
│   │   (OAuth connectors)   (DB credentials)  (Tool execution)                    │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                            SERVICE LAYER                                     │   │
│   │                                                                              │   │
│   │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │   │
│   │   │    Composio     │  │    Database     │  │   Integration   │              │   │
│   │   │    Service      │  │    Service      │  │    Service      │              │   │
│   │   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │   │
│   │            │                    │                    │                       │   │
│   └────────────┼────────────────────┼────────────────────┼───────────────────────┘   │
│                │                    │                    │                           │
│   ┌────────────┼────────────────────┼────────────────────┼───────────────────────┐   │
│   │            │              MONGODB                    │                       │   │
│   │            │                    │                    │                       │   │
│   │   ┌────────▼────────┐  ┌───────▼────────┐  ┌────────▼────────┐               │   │
│   │   │  integrations   │  │ user_databases │  │     (other)     │               │   │
│   │   │  (OAuth tokens) │  │  (DB creds)    │  │                 │               │   │
│   │   └─────────────────┘  └────────────────┘  └─────────────────┘               │   │
│   │                                                                              │   │
│   └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
└───────────────────┬─────────────────────────────────┬───────────────────────────────┘
                    │                                 │
                    ▼                                 ▼
          ┌─────────────────┐               ┌─────────────────┐
          │                 │               │                 │
          │    COMPOSIO     │               │  USER'S OWN     │
          │    (OAuth)      │               │   DATABASES     │
          │                 │               │                 │
          │  Gmail, Slack   │               │ PostgreSQL      │
          │  BigQuery       │               │ MySQL, Redis    │
          │                 │               │ MongoDB         │
          └─────────────────┘               └─────────────────┘
```

---

## Connector Types

### Type 1: OAuth Connectors (via Composio)

| Connector | Auth Method | User Action |
|-----------|-------------|-------------|
| Gmail | OAuth 2.0 | Click Connect → Google Login → Grant Permission |
| Slack | OAuth 2.0 | Click Connect → Slack Login → Grant Permission |
| BigQuery | OAuth 2.0 | Click Connect → Google Login → Grant Permission |

**Characteristics:**
- User redirected to provider (Google/Slack) for authentication
- OAuth token stored and managed by Composio
- Token refresh handled automatically
- User can only access their own account

### Type 2: Database Connectors (via Toolbox)

| Connector | Auth Method | User Action |
|-----------|-------------|-------------|
| PostgreSQL | Credentials | Fill form: host, port, database, user, password |
| MySQL | Credentials | Fill form: host, port, database, user, password |
| Redis | Credentials | Fill form: host, port, password |
| MongoDB | Credentials | Fill form: connection string |

**Characteristics:**
- User provides database credentials via form
- Credentials encrypted and stored in MCP's MongoDB
- MCP connects to user's database when executing queries
- User responsible for providing valid credentials

---

## User Journey: OAuth Connectors

### Step 1: User Clicks "Connect Gmail"

```
┌─────────────────────────────────────────────────────────────────┐
│                      OA Connectors Page                         │
│                                                                 │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐        │
│   │  Gmail  │   │  Slack  │   │BigQuery │   │PostgreSQL│        │
│   │         │   │         │   │         │   │         │        │
│   │[Connect]│   │[Connect]│   │[Connect]│   │[Connect]│        │
│   └────┬────┘   └─────────┘   └─────────┘   └─────────┘        │
│        │                                                        │
│        │ User clicks                                            │
│        ▼                                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: OA Backend Calls MCP

```http
POST /api/integrations/connect
Headers:
  X-API-Key: oa_secret_key
  Content-Type: application/json
Body:
{
  "user_id": "user_123",
  "provider": "gmail",
  "redirect_url": "https://app.openanalyst.com/connectors?callback=true"
}
```

**Response:**
```json
{
  "auth_url": "https://accounts.google.com/oauth?client_id=...&redirect_uri=..."
}
```

### Step 3: User Redirected to Google

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sign in with Google                          │
│                                                                 │
│    Choose an account to continue to OpenAnalyst                 │
│                                                                 │
│    ┌──────────────────────────────────────────────────┐         │
│    │  👤  user@gmail.com                              │         │
│    └──────────────────────────────────────────────────┘         │
│                                                                 │
│    OpenAnalyst wants to:                                        │
│    ✓ Read and send emails                                       │
│    ✓ Manage drafts                                              │
│                                                                 │
│              [ Cancel ]    [ Allow ]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step 4: OAuth Callback

Google redirects to MCP's callback endpoint:
```
GET /api/integrations/callback?status=success&appName=gmail
```

MCP Service:
1. Stores OAuth token via Composio
2. Updates integration status to "active"
3. Redirects user to OA's redirect_url

### Step 5: Connection Complete

```
┌─────────────────────────────────────────────────────────────────┐
│                      OA Connectors Page                         │
│                                                                 │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐        │
│   │  Gmail  │   │  Slack  │   │BigQuery │   │PostgreSQL│        │
│   │    ✓    │   │         │   │         │   │         │        │
│   │Connected│   │[Connect]│   │[Connect]│   │[Connect]│        │
│   └─────────┘   └─────────┘   └─────────┘   └─────────┘        │
│                                                                 │
│   ✅ Gmail connected successfully!                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Journey: Database Connectors

### Step 1: User Clicks "Connect PostgreSQL"

OA fetches form schema from MCP:

```http
GET /api/databases/schema?db_type=postgres
Headers:
  X-API-Key: oa_secret_key
```

**Response:**
```json
{
  "db_type": "postgres",
  "name": "PostgreSQL",
  "fields": [
    { "name": "connection_name", "label": "Connection Name", "type": "text", "required": true },
    { "name": "host", "label": "Host", "type": "text", "required": true },
    { "name": "port", "label": "Port", "type": "number", "default": 5432 },
    { "name": "database", "label": "Database Name", "type": "text", "required": true },
    { "name": "username", "label": "Username", "type": "text", "required": true },
    { "name": "password", "label": "Password", "type": "password", "required": true },
    { "name": "ssl", "label": "SSL Required", "type": "checkbox", "default": false }
  ]
}
```

### Step 2: OA Renders Dynamic Form

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     Connect PostgreSQL                          │
│                                                                 │
│   Connection Name:  [ My Analytics DB              ]            │
│                                                                 │
│   Host:             [ analytics.db.example.com     ]            │
│                                                                 │
│   Port:             [ 5432                         ]            │
│                                                                 │
│   Database:         [ campaigns                    ]            │
│                                                                 │
│   Username:         [ db_user                      ]            │
│                                                                 │
│   Password:         [ ••••••••••                   ]            │
│                                                                 │
│   [✓] SSL Required                                              │
│                                                                 │
│                [ Test Connection ]    [ Connect ]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: User Clicks "Test Connection"

```http
POST /api/databases/test
Headers:
  X-API-Key: oa_secret_key
  Content-Type: application/json
Body:
{
  "db_type": "postgres",
  "host": "analytics.db.example.com",
  "port": 5432,
  "database": "campaigns",
  "username": "db_user",
  "password": "secret123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful"
}
```

### Step 4: User Clicks "Connect" (Save)

```http
POST /api/databases/connect
Headers:
  X-API-Key: oa_secret_key
  Content-Type: application/json
Body:
{
  "user_id": "user_123",
  "db_type": "postgres",
  "name": "My Analytics DB",
  "host": "analytics.db.example.com",
  "port": 5432,
  "database": "campaigns",
  "username": "db_user",
  "password": "secret123",
  "ssl": true
}
```

MCP Service:
1. Encrypts password
2. Stores credentials in MongoDB
3. Returns database ID

**Response:**
```json
{
  "db_id": "db_abc123",
  "name": "My Analytics DB",
  "status": "connected"
}
```

### Step 5: Connection Complete

```
┌─────────────────────────────────────────────────────────────────┐
│                      OA Connectors Page                         │
│                                                                 │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌───────────┐      │
│   │  Gmail  │   │  Slack  │   │BigQuery │   │PostgreSQL │      │
│   │    ✓    │   │[Connect]│   │[Connect]│   │     ✓     │      │
│   │Connected│   │         │   │         │   │ Connected │      │
│   └─────────┘   └─────────┘   └─────────┘   └───────────┘      │
│                                                                 │
│   Connected Databases:                                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  📊 My Analytics DB                                      │   │
│   │     PostgreSQL • analytics.db.example.com                │   │
│   │     Status: Connected ✓           [ Disconnect ]         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Tool Execution

### Scenario: User asks agent to analyze data and send email

**User prompt:**
> "Analyze my ad campaign performance from last week and email the summary to marketing@company.com"

### Step 1: Agent Gets Available Tools

```http
GET /api/tools?user_id=user_123
Headers:
  X-API-Key: oa_secret_key
```

**Response:**
```json
{
  "tools": [
    {
      "name": "GMAIL_SEND_EMAIL",
      "description": "Send an email via Gmail",
      "provider": "gmail",
      "parameters": {
        "recipient_email": "string",
        "subject": "string",
        "body": "string"
      }
    },
    {
      "name": "DB_QUERY_db_abc123",
      "description": "Query 'My Analytics DB' (PostgreSQL)",
      "provider": "postgres",
      "parameters": {
        "query": "string (SQL query)"
      }
    }
  ]
}
```

### Step 2: Agent Queries Database

```http
POST /api/tools/execute
Headers:
  X-API-Key: oa_secret_key
  Content-Type: application/json
Body:
{
  "user_id": "user_123",
  "action": "DB_QUERY_db_abc123",
  "params": {
    "query": "SELECT campaign_name, spend, clicks FROM campaigns WHERE date >= CURRENT_DATE - INTERVAL '7 days'"
  }
}
```

MCP Service internally:
1. Looks up db_abc123 credentials for user_123
2. Decrypts password
3. Connects to user's PostgreSQL
4. Executes query
5. Returns results

**Response:**
```json
{
  "success": true,
  "result": [
    { "campaign_name": "Black Friday", "spend": 5000, "clicks": 15000 },
    { "campaign_name": "Holiday Sale", "spend": 3000, "clicks": 8000 }
  ]
}
```

### Step 3: Agent Sends Email

```http
POST /api/tools/execute
Headers:
  X-API-Key: oa_secret_key
  Content-Type: application/json
Body:
{
  "user_id": "user_123",
  "action": "GMAIL_SEND_EMAIL",
  "params": {
    "recipient_email": "marketing@company.com",
    "subject": "Weekly Ad Campaign Summary",
    "body": "Campaign Performance Summary:\n\nBlack Friday: $5,000 spent, 15,000 clicks\nHoliday Sale: $3,000 spent, 8,000 clicks\n\nTotal: $8,000 spent, 23,000 clicks"
  }
}
```

MCP Service internally:
1. Routes to Composio (Gmail is OAuth)
2. Uses user_123's Gmail OAuth token
3. Sends email via Gmail API

**Response:**
```json
{
  "success": true,
  "result": {
    "messageId": "abc123",
    "status": "sent"
  }
}
```

### Step 4: Agent Responds to User

```
Agent: "I've analyzed your campaign data and sent the summary.

📊 Summary:
• Black Friday: $5,000 spent, 15,000 clicks
• Holiday Sale: $3,000 spent, 8,000 clicks
• Total: $8,000 spent, 23,000 clicks

✅ Email sent to marketing@company.com"
```

---

## API Endpoints

### Integrations (OAuth - Composio)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List available OAuth integrations |
| POST | `/api/integrations/connect` | Start OAuth flow |
| GET | `/api/integrations/connected?user_id=x` | List user's connected integrations |
| POST | `/api/integrations/disconnect` | Remove OAuth connection |
| GET | `/api/integrations/callback` | OAuth callback (internal) |

### Databases (Credentials - Toolbox)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/databases/types` | List supported database types |
| GET | `/api/databases/schema?db_type=x` | Get form fields for database type |
| POST | `/api/databases/test` | Test connection (before saving) |
| POST | `/api/databases/connect` | Save encrypted credentials |
| GET | `/api/databases?user_id=x` | List user's connected databases |
| POST | `/api/databases/disconnect` | Remove database connection |

### Tools (Unified Execution)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tools?user_id=x` | Get all tools (OAuth + DB) for user |
| POST | `/api/tools/execute` | Execute any tool |
| GET | `/api/tools/health` | Health check |

---

## Data Storage

### MongoDB Collections

#### Collection: `integrations`

Stores OAuth connections (Composio-managed).

```javascript
{
  "_id": "int_001",
  "user_id": "user_123",
  "provider": "gmail",
  "status": "active",
  "composio_entity_id": "user_user_123",
  "composio_connection_id": "conn_xyz",
  "connected_email": "user@gmail.com",
  "created_at": "2025-12-18T10:00:00Z",
  "updated_at": "2025-12-18T10:00:00Z"
}
```

#### Collection: `user_databases`

Stores database credentials (encrypted).

```javascript
{
  "_id": "db_abc123",
  "user_id": "user_123",
  "db_type": "postgres",
  "name": "My Analytics DB",
  "host": "analytics.db.example.com",
  "port": 5432,
  "database": "campaigns",
  "username": "db_user",
  "password": "ENCRYPTED_STRING_HERE",  // Encrypted!
  "ssl": true,
  "status": "connected",
  "created_at": "2025-12-18T10:00:00Z",
  "updated_at": "2025-12-18T10:00:00Z"
}
```

---

## Security Model

### Layer 1: OA Authentication

- OA authenticates users via their own login system
- OA knows the real `user_id` from session
- End users NEVER call MCP directly

### Layer 2: API Key Authentication

- All MCP endpoints require `X-API-Key` header
- Only OA backend has the API key
- MCP trusts requests with valid API key

### Layer 3: User Isolation

- All queries include `user_id` parameter
- Users can only access their own:
  - OAuth connections
  - Database credentials
  - Query results

### Layer 4: Credential Encryption

- Database passwords encrypted at rest using Fernet (AES-128)
- Encryption key stored as environment variable
- Decrypted only when executing queries

### Security Flow

```
End User → OA Frontend → OA Backend → MCP Service → Resources
              │              │             │
              │              │             └── Validates X-API-Key
              │              │
              │              └── Sets correct user_id from session
              │
              └── User cannot modify user_id
```

---

## OA Team Requirements

### UI Components to Build

#### 1. Connectors Page

Grid of available connectors showing:
- OAuth connectors (Gmail, Slack, BigQuery)
- Database connectors (PostgreSQL, MySQL, Redis, MongoDB)
- Connection status for each

#### 2. OAuth Connect Button

Simple button that:
1. Calls `POST /api/integrations/connect`
2. Redirects user to returned `auth_url`
3. Handles callback redirect

#### 3. Database Connect Form

Dynamic form that:
1. Fetches schema from `GET /api/databases/schema?db_type=x`
2. Renders form fields dynamically
3. Implements "Test Connection" button
4. Submits to `POST /api/databases/connect`

#### 4. Connected Items List

Shows:
- Connected OAuth services
- Connected databases with name, type, host
- Disconnect button for each

### API Integration

```javascript
// Example: OA Backend API calls

const MCP_BASE_URL = 'https://mcp.openanalyst.com';
const API_KEY = process.env.MCP_API_KEY;

// Connect OAuth integration
async function connectIntegration(userId, provider, redirectUrl) {
  const response = await fetch(`${MCP_BASE_URL}/api/integrations/connect`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      provider: provider,
      redirect_url: redirectUrl
    })
  });
  return response.json();
}

// Connect database
async function connectDatabase(userId, dbConfig) {
  const response = await fetch(`${MCP_BASE_URL}/api/databases/connect`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      ...dbConfig
    })
  });
  return response.json();
}

// Get user's tools for agent
async function getUserTools(userId) {
  const response = await fetch(`${MCP_BASE_URL}/api/tools?user_id=${userId}`, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  return response.json();
}

// Execute tool
async function executeTool(userId, action, params) {
  const response = await fetch(`${MCP_BASE_URL}/api/tools/execute`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      action: action,
      params: params
    })
  });
  return response.json();
}
```

---

## Environment Variables

### MCP Service (.env)

```bash
# Required
COMPOSIO_API_KEY=your_composio_api_key
AGENT_API_KEY=your_agent_api_key
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mcp_integrations
DB_ENCRYPTION_KEY=your_32_byte_encryption_key

# Optional
MONGODB_DB_NAME=mcp_integrations
MCP_SERVICE_HOST=0.0.0.0
MCP_SERVICE_PORT=8001
OAUTH_REDIRECT_BASE=https://mcp.openanalyst.com
```

### OA Backend

```bash
MCP_API_KEY=your_agent_api_key
MCP_BASE_URL=https://mcp.openanalyst.com
```

---

## Summary

| Feature | Implementation | User Experience |
|---------|----------------|-----------------|
| Gmail/Slack/BigQuery | Composio (OAuth) | Click Connect → Login → Grant Permission |
| PostgreSQL/MySQL/Redis | Toolbox (Credentials) | Fill Form → Test → Connect |
| Tool Execution | Unified API | Agent calls `/api/tools/execute` |
| Security | API Key + user_id | User data isolated |
| Credentials | Encrypted in MongoDB | Secure storage |

---

## Next Steps

1. **MCP Team:** Implement `/api/databases/*` endpoints
2. **OA Team:** Build connector UI with dynamic forms
3. **Testing:** End-to-end test with real databases
4. **Deployment:** Deploy updated MCP service to EC2
