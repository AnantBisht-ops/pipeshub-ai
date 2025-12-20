# MCP AI Agent Integration Guide

## Complete Integration Overview

This guide shows how all MCP components work together to enable AI agents to perform actions.

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. User → Settings → MCP → Connects Gmail/Slack                 │
│  2. User → QnA ChatBot → "Send email to john@example.com"        │
│  3. ChatBot → Shows: "✅ Email sent successfully"                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TECHNICAL FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Frontend (React)           Backend (Node.js)        MCP Service │
│  ────────────────           ──────────────────       ─────────── │
│                                                                   │
│  1. MCP Settings     ────→  [User connects Gmail]                │
│     OAuth Flow              JWT Auth              ←→ Composio    │
│                                                       OAuth       │
│                                                                   │
│  2. ChatBot UI       ────→  ChatBot Service                      │
│     User message            - Get MCP tools      ←→  GET /tools  │
│                             - LLM processes          (API Key)   │
│                             - Execute action     ←→  POST /exec  │
│                                                                   │
│  3. Show Result      ←────  Return success                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Locations

### Frontend Components (User Interface)

| Component | Location | Purpose |
|-----------|----------|---------|
| **MCP Settings Page** | `frontend/src/sections/accountdetails/mcp/` | Where users connect integrations |
| **Integration Cards** | `mcp/components/mcp-integration-card.tsx` | Gmail/Slack connection UI |
| **OAuth Callback** | `mcp/components/mcp-oauth-callback.tsx` | Handles OAuth returns |
| **API Service** | `mcp/services/api.ts` | Frontend API client |
| **Capabilities Panel** | `qna/components/mcp-capabilities-panel.tsx` | Shows AI capabilities |

### Backend Components (AI Agent)

| Component | Location | Purpose |
|-----------|----------|---------|
| **MCP Agent Service** | `backend/nodejs/apps/src/services/mcp-agent.service.ts` | Backend MCP client |
| **ChatBot Integration** | `modules/qna/mcp-integration.example.ts` | ChatBot with MCP |
| **Environment Config** | `backend/nodejs/apps/.env.mcp` | Backend configuration |

### Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **OAuth Flow** | `mcp/docs/OAUTH_FLOW.md` | OAuth implementation details |
| **AI Agent API** | `mcp/docs/AI_AGENT_API.md` | API documentation for agents |
| **Integration Guide** | `mcp/docs/INTEGRATION_GUIDE.md` | This document |

---

## Setup Instructions

### 1. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies (if not done)
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local:
# VITE_MCP_SERVICE_URL=https://mcp.openanalyst.com
# VITE_MCP_API_KEY=your_api_key_here

# Start development server
npm run dev
```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend/nodejs/apps

# Install dependencies
npm install

# Add MCP configuration to .env
cat .env.mcp >> .env
# Edit .env with actual values:
# MCP_SERVICE_URL=https://mcp.openanalyst.com
# MCP_API_KEY=your_api_key_here
# ENABLE_MCP_INTEGRATION=true

# Start backend server
npm run dev
```

### 3. MCP Service Configuration

The MCP service should be configured with:
- `COMPOSIO_API_KEY`: From Composio dashboard
- `AGENT_API_KEY`: Same as your backend's MCP_API_KEY
- `OAUTH_REDIRECT_BASE`: Your frontend URL

---

## Testing Workflow

### Phase 1: User Connection Test
1. Login to PipesHub
2. Navigate to **Settings → MCP**
3. Click **Connect Gmail**
4. Complete Google OAuth
5. Verify Gmail shows as "Connected"
6. Repeat for Slack

### Phase 2: Tool Discovery Test
```bash
# Test from backend
curl -X GET "https://mcp.openanalyst.com/api/tools?user_id=YOUR_USER_ID" \
  -H "X-API-Key: your_api_key"

# Should return available tools
```

### Phase 3: ChatBot Integration Test
1. Go to **QnA → ChatBot**
2. Type: "Send an email to test@example.com saying hello"
3. ChatBot should:
   - Detect email intent
   - Check if Gmail is connected
   - Send the email
   - Show success message

### Phase 4: Action Execution Test
```javascript
// Backend test script
const { mcpAgentService } = require('./services/mcp-agent.service');

async function test() {
  const userId = 'YOUR_USER_ID';

  // Get tools
  const tools = await mcpAgentService.getToolsForUser(userId);
  console.log('Available tools:', tools);

  // Send email
  const result = await mcpAgentService.sendEmail(
    userId,
    'test@example.com',
    'Test Subject',
    'Test body'
  );
  console.log('Email result:', result);
}
```

---

## Common Integration Scenarios

### Scenario 1: Email Assistant
```
User: "Send an email to the team about tomorrow's meeting"
ChatBot: "I'll help you send that email. What's the team email address?"
User: "team@company.com"
ChatBot: [Sends email] "✅ Email sent to team@company.com about tomorrow's meeting"
```

### Scenario 2: Slack Notifications
```
User: "Post in #general that the deployment is complete"
ChatBot: [Posts to Slack] "✅ Posted to #general: 'Deployment is complete'"
```

### Scenario 3: Multi-Action Workflow
```
User: "Send the report to john@example.com and notify #reports channel"
ChatBot:
  1. [Sends email] "✅ Email sent to john@example.com"
  2. [Posts to Slack] "✅ Notified #reports channel"
```

### Scenario 4: No Integration
```
User: "Send an email to client"
ChatBot: "I'd love to help! Please connect your Gmail account in Settings → MCP first."
```

---

## Troubleshooting

### Issue: "User does not have gmail connected"
**Solution**: User needs to connect Gmail in Settings → MCP

### Issue: OAuth callback fails
**Check**:
- Redirect URI is correctly configured
- MCP service is running
- OAuth credentials are valid

### Issue: Tools not showing in ChatBot
**Check**:
- API key is configured in backend
- User ID is correctly passed
- MCP service is accessible

### Issue: Action execution fails
**Check**:
- All required parameters are provided
- OAuth tokens haven't expired
- User has necessary permissions

---

## Security Best Practices

1. **API Keys**
   - Never expose MCP_API_KEY in frontend
   - Use environment variables
   - Rotate keys regularly

2. **User Authentication**
   - Always verify user JWT tokens
   - Check user permissions before actions
   - Log all actions for audit

3. **OAuth Tokens**
   - Tokens stored securely by Composio
   - Never log or expose tokens
   - Handle token expiration gracefully

4. **Rate Limiting**
   - Implement rate limits for API calls
   - Cache tool discovery results
   - Queue actions if needed

---

## Deployment Checklist

### Frontend Deployment
- [ ] Set VITE_MCP_SERVICE_URL to production URL
- [ ] Remove debug logging
- [ ] Configure OAuth redirect URLs
- [ ] Test all user flows

### Backend Deployment
- [ ] Set MCP_SERVICE_URL to production URL
- [ ] Configure MCP_API_KEY securely
- [ ] Enable MCP_INTEGRATION flag
- [ ] Test API endpoints

### MCP Service Deployment
- [ ] Configure Composio API key
- [ ] Set AGENT_API_KEY
- [ ] Configure OAuth redirect URLs
- [ ] Test with production domains

---

## Support & Maintenance

### Monitoring
- Monitor API response times
- Track OAuth success/failure rates
- Log all action executions

### Updates
- Keep Composio SDK updated
- Update OAuth scopes as needed
- Add new providers when available

### User Support
- Provide clear connection instructions
- Show helpful error messages
- Guide users to reconnect expired tokens