# Testing Cron Scheduler - Quick Guide

## 🔑 Understanding the Authentication Flow

### Why You Need Credentials from Deepak:

The flow works like this:

```
1. Harsh's Frontend → Creates a scheduled job
                   ↓
2. Your Cron Scheduler → Stores the job with auth token
                   ↓  (At scheduled time)
3. Your Cron Worker → Calls Deepak's API
                   ↓
4. Deepak's Agent → Needs authentication to run
```

### The Two-Step Authentication:

**Step 1: Get Bearer Token** (This is what Harsh will do)
```bash
POST https://api.openanalyst.com:3456/api/auth/token
{
  "userId": "user-123",      # ← These are the credentials
  "apiKey": "master-key-1"   # ← you need from Deepak!
}
```
Returns: `{ "token": "Bearer eyJhbGci..." }`

**Step 2: Use Token for Agent** (Your cron worker does this)
```bash
POST https://api.openanalyst.com:3456/api/agent/run
Headers: Authorization: Bearer eyJhbGci...
{
  "prompt": "Generate report..."
}
```

## ⚠️ Important Notes:

1. **"master-key-1" and "user-123" are EXAMPLES!**
   - Ask Deepak: "What are the actual API credentials for my system?"
   - He should give you the real apiKey and userId

2. **These credentials are for YOUR SYSTEM**
   - Not for individual users
   - Your system uses them to authenticate with Deepak's API
   - Think of it as a "service account"

3. **The flow:**
   - Harsh gets token using these credentials
   - Harsh includes token when creating scheduled jobs
   - Your cron executes with that token

## 🧪 Quick Test (After Getting Credentials)

### 1. Test Authentication:
```bash
curl -X POST "https://api.openanalyst.com:3456/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_ACTUAL_USER_ID",
    "apiKey": "YOUR_ACTUAL_API_KEY"
  }'
```

If successful, you'll get:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

### 2. Test Your Cron Scheduler Health:
```bash
curl http://localhost:3000/api/v1/cron/health
```

### 3. Create a Test Job (using the token):
```bash
curl -X POST "http://localhost:3000/api/v1/cron/schedule" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Job",
    "prompt": "Say hello",
    "targetApi": "https://api.openanalyst.com:3456/api/agent/run",
    "scheduleType": "once",
    "timezone": "UTC",
    "oneTime": {
      "date": "2025-01-01",
      "time": "12:00"
    },
    "metadata": {
      "conversationId": "test_123",
      "sessionId": "test_session",
      "chatboxId": "test_chat",
      "deepakProjectId": "test_project"
    },
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN_FROM_STEP_1"
    }
  }'
```

## 📞 Ask Deepak:

"Hi Deepak, I need the API credentials for the cron scheduler integration.
What are the actual values for:
- apiKey (shown as 'master-key-1' in docs)
- userId (shown as 'user-123' in docs)
These will be used by my backend to authenticate with your API."

## 🎯 Once You Have Real Credentials:

1. Update `.env`:
   ```env
   OPENANALYST_API_KEY=actual-key-from-deepak
   OPENANALYST_USER_ID=actual-userid-from-deepak
   ```

2. Restart your backend

3. Your cron scheduler will be fully functional!