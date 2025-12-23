# AI Agent Integration API Documentation

## Overview

This document describes how AI agents (ChatBot/QnA) integrate with MCP to perform actions on behalf of users.

---

## Authentication

AI agents use **API Key authentication** (not JWT tokens) for all operations.

```javascript
headers: {
  'X-API-Key': 'your_mcp_api_key'
}
```

---

## Endpoints for AI Agents

### 1. Get User Tools

Discover what actions are available for a specific user based on their connected integrations.

**Endpoint:** `GET /api/tools`

**Headers:**
```
X-API-Key: your_api_key
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| user_id | string | Yes | User's ID (e.g., Google OAuth ID) |

**Example Request:**
```bash
curl -X GET "https://mcp.openanalyst.com/api/tools?user_id=110610502660943882433" \
  -H "X-API-Key: your_api_key"
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
        "type": "object",
        "properties": {
          "recipient_email": {
            "type": "string",
            "description": "Email address of the recipient"
          },
          "subject": {
            "type": "string",
            "description": "Email subject line"
          },
          "body": {
            "type": "string",
            "description": "Email body content"
          }
        },
        "required": ["recipient_email", "subject", "body"]
      }
    },
    {
      "name": "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
      "description": "Send a message to a Slack channel",
      "provider": "slack",
      "parameters": {
        "type": "object",
        "properties": {
          "channel": {
            "type": "string",
            "description": "Slack channel (e.g., #general)"
          },
          "text": {
            "type": "string",
            "description": "Message text"
          }
        },
        "required": ["channel", "text"]
      }
    }
  ]
}
```

**Notes:**
- Returns empty array if user has no integrations
- Only returns tools for connected services
- Tool definitions are OpenAI function-calling compatible

---

### 2. Execute Action

Execute an action on behalf of a user using their connected integrations.

**Endpoint:** `POST /api/tools/execute`

**Headers:**
```
X-API-Key: your_api_key
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": "110610502660943882433",
  "action": "GMAIL_SEND_EMAIL",
  "params": {
    "recipient_email": "john@example.com",
    "subject": "Meeting Tomorrow",
    "body": "Hi John,\n\nOur meeting is at 3pm tomorrow.\n\nBest regards"
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "result": {
    "id": "18c5f5d1a2b3c4d5",
    "threadId": "18c5f5d1a2b3c4d5",
    "labelIds": ["SENT"]
  },
  "error": null
}
```

**Response (Error):**
```json
{
  "success": false,
  "result": null,
  "error": "User does not have gmail connected"
}
```

---

## Available Actions by Provider

### Gmail Actions

| Action | Description | Required Parameters |
|--------|-------------|---------------------|
| `GMAIL_SEND_EMAIL` | Send an email | recipient_email, subject, body |
| `GMAIL_FETCH_EMAILS` | Fetch/search emails | (optional) query, max_results |
| `GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID` | Get specific email | message_id |
| `GMAIL_CREATE_EMAIL_DRAFT` | Create a draft | recipient_email, subject, body |
| `GMAIL_LIST_LABELS` | List all labels | (none) |
| `GMAIL_DELETE_MESSAGE` | Delete an email | message_id |

### Slack Actions

| Action | Description | Required Parameters |
|--------|-------------|---------------------|
| `SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL` | Send message | channel, text |
| `SLACK_LIST_ALL_SLACK_TEAM_CHANNELS_WITH_PAGINATION` | List channels | (optional) cursor, limit |
| `SLACK_FETCHES_CONVERSATION_HISTORY` | Get channel history | channel |
| `SLACK_SEARCH_MESSAGES_IN_SLACK` | Search messages | query |

---

## Integration Flow for AI Agents

### Step 1: User Query Processing

```javascript
// User says: "Send an email to john@example.com about the meeting"

// 1. Extract user ID from session
const userId = req.user.id; // "110610502660943882433"

// 2. Get available tools
const tools = await fetch(`/api/tools?user_id=${userId}`, {
  headers: { 'X-API-Key': apiKey }
});

// 3. Check if GMAIL_SEND_EMAIL is available
const canSendEmail = tools.find(t => t.name === 'GMAIL_SEND_EMAIL');
```

### Step 2: LLM Integration

```javascript
// Send to OpenAI with available tools
const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "user", content: userMessage }
  ],
  tools: tools, // Pass MCP tools
  tool_choice: "auto"
});

// LLM returns function call
const functionCall = completion.choices[0].message.tool_calls[0];
// functionCall.function.name = "GMAIL_SEND_EMAIL"
// functionCall.function.arguments = JSON string of parameters
```

### Step 3: Execute Action

```javascript
// Execute the action via MCP
const result = await fetch('/api/tools/execute', {
  method: 'POST',
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: userId,
    action: functionCall.function.name,
    params: JSON.parse(functionCall.function.arguments)
  })
});
```

### Step 4: Response to User

```javascript
if (result.success) {
  return "✅ Email sent successfully to john@example.com";
} else {
  return "❌ " + result.error;
}
```

---

## Error Handling

### Common Error Responses

| Error | Message | Solution |
|-------|---------|----------|
| No integration | "User does not have {provider} connected" | User needs to connect integration in Settings → MCP |
| Invalid action | "Action {action} not found" | Check available tools first |
| Missing params | "Missing required parameter: {param}" | Ensure all required params are provided |
| OAuth expired | "OAuth token expired for {provider}" | User needs to reconnect integration |
| Rate limit | "Rate limit exceeded" | Implement backoff strategy |

### Error Response Format

All errors return with HTTP status codes:
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `404` - Not found (user or action not found)
- `500` - Server error

```json
{
  "detail": "Detailed error message"
}
```

---

## Best Practices

### 1. Tool Discovery
- Cache user tools for 5 minutes to reduce API calls
- Refresh cache when user connects/disconnects integration

### 2. Action Execution
- Always validate parameters before execution
- Provide clear feedback to users about what action will be performed
- Handle errors gracefully with user-friendly messages

### 3. Security
- Never expose API keys in frontend code
- Validate user permissions for each action
- Log all actions for audit trail

### 4. User Experience
- Show loading states during action execution
- Provide suggestions based on available tools
- Guide users to connect integrations when needed

---

## Example Implementation

### Node.js/TypeScript

```typescript
import axios from 'axios';

class McpAgentClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://mcp.openanalyst.com';
  }

  async getTools(userId: string) {
    const response = await axios.get(`${this.baseUrl}/api/tools`, {
      params: { user_id: userId },
      headers: { 'X-API-Key': this.apiKey }
    });
    return response.data.tools;
  }

  async execute(userId: string, action: string, params: any) {
    const response = await axios.post(
      `${this.baseUrl}/api/tools/execute`,
      { user_id: userId, action, params },
      { headers: { 'X-API-Key': this.apiKey } }
    );
    return response.data;
  }
}
```

### Python

```python
import requests

class McpAgentClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://mcp.openanalyst.com'

    def get_tools(self, user_id):
        response = requests.get(
            f'{self.base_url}/api/tools',
            params={'user_id': user_id},
            headers={'X-API-Key': self.api_key}
        )
        return response.json()['tools']

    def execute(self, user_id, action, params):
        response = requests.post(
            f'{self.base_url}/api/tools/execute',
            json={
                'user_id': user_id,
                'action': action,
                'params': params
            },
            headers={'X-API-Key': self.api_key}
        )
        return response.json()
```

---

## Testing

### Test User Creation
1. User connects Gmail in Settings → MCP
2. User connects Slack in Settings → MCP
3. Verify tools are available via API

### Test Cases
1. **Tool Discovery**
   - User with no integrations → Returns empty array
   - User with Gmail only → Returns Gmail tools
   - User with both → Returns all tools

2. **Action Execution**
   - Send email with valid params → Success
   - Send email without Gmail → Error
   - Invalid action name → 404 error
   - Missing parameters → 400 error

### Example Test Script

```bash
# Test tool discovery
curl -X GET "https://mcp.openanalyst.com/api/tools?user_id=TEST_USER_ID" \
  -H "X-API-Key: your_api_key"

# Test email sending
curl -X POST "https://mcp.openanalyst.com/api/tools/execute" \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "TEST_USER_ID",
    "action": "GMAIL_SEND_EMAIL",
    "params": {
      "recipient_email": "test@example.com",
      "subject": "Test",
      "body": "Test message"
    }
  }'
```