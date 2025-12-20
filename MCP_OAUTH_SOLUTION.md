# MCP OAuth Redirect Issue - Complete Solution Guide

## Problem Statement
After successful OAuth authorization on Composio, users are redirected to the MCP service root URL showing JSON:
```json
{
  "service": "MCP Integration Service",
  "version": "2.0.0",
  "status": "running"
}
```

Instead of being redirected to the app's callback URL.

## Root Cause
The MCP service (`https://mcp.openanalyst.com`) has not whitelisted your application's redirect URLs in its Composio integration configuration.

## Solutions

### Solution 1: Whitelist Redirect URLs (RECOMMENDED)

**Action Required:** Contact the MCP service administrator

**URLs to Whitelist:**
```
Development:
- http://localhost:3001/account/individual/settings/mcp/oauth/callback
- http://localhost:3001/account/company-settings/settings/mcp/oauth/callback

Production (replace with your domain):
- https://your-domain.com/account/individual/settings/mcp/oauth/callback
- https://your-domain.com/account/company-settings/settings/mcp/oauth/callback
```

**Steps:**
1. Contact admin@openanalyst.com (or MCP service administrator)
2. Request: "Please whitelist the above URLs in your Composio OAuth integration"
3. Provide your `user_id` or account information for verification
4. Wait for confirmation

**Expected Response Time:** 1-2 business days

---

### Solution 2: Manual Redirect Workaround (TEMPORARY)

Use this while waiting for Solution 1 to be implemented.

**Steps:**
1. Click "Connect Gmail" in your app
2. Complete OAuth authorization on Composio/Google
3. When you see the JSON response, note the URL in your browser:
   ```
   https://mcp.openanalyst.com/?status=success&appName=gmail&...
   ```
4. **Manually edit the URL:**
   - Remove: `https://mcp.openanalyst.com/`
   - Add: `http://localhost:3001/account/individual/settings/mcp/oauth/callback`
   - Keep the query parameters (`?status=success&appName=gmail`)
5. Press Enter - your app will process the callback successfully

**Final URL should look like:**
```
http://localhost:3001/account/individual/settings/mcp/oauth/callback?status=success&appName=gmail
```

---

### Solution 3: Alternative Implementation (If whitelisting not possible)

If the MCP service cannot whitelist your URLs, we can implement a polling-based approach:

**How it works:**
1. User initiates OAuth → Store connection ID
2. User completes OAuth on Composio
3. App polls MCP service every 2 seconds to check connection status
4. When status changes to "connected", show success message

This requires backend changes - contact support to implement.

---

## Testing After Fix

### 1. Test Individual Account OAuth
```
1. Navigate to: http://localhost:3001/account/individual/settings/mcp
2. Click "Connect Gmail"
3. Authorize on Google
4. Should redirect to: http://localhost:3001/account/individual/settings/mcp/oauth/callback?status=success&appName=gmail
5. Should see: "Successfully connected Gmail" message
6. Should show: Gmail as "Connected"
```

### 2. Test Business Account OAuth
```
1. Navigate to: http://localhost:3001/account/company-settings/settings/mcp
2. Click "Connect Gmail"
3. Authorize on Google
4. Should redirect to: http://localhost:3001/account/company-settings/settings/mcp/oauth/callback?status=success&appName=gmail
5. Should see: "Successfully connected Gmail" message
6. Should show: Gmail as "Connected"
```

---

## Current Implementation Status

✅ **Frontend Callback Handler:** Fully implemented
- Route: `/account/*/settings/mcp/oauth/callback`
- Handles: `status`, `appName`, `error`, `message` query parameters
- UI: Success/Error display with auto-redirect

✅ **Backend Integration:** Fully implemented
- API Key: `AGENT_API_KEY=vishal_agent_api_key`
- User ID extraction from JWT
- Proper error handling and logging

❌ **MCP Service Redirect Configuration:** NOT CONFIGURED
- Redirect URLs not whitelisted in Composio
- **ACTION REQUIRED:** Contact MCP service administrator

---

## Technical Details

### OAuth Flow (Current)
```
1. User → Frontend: Click "Connect Gmail"
2. Frontend → Backend: POST /api/v1/mcp/integrations/connect
   Headers: Authorization: Bearer <JWT>
   Body: { provider: "gmail", redirect_uri: "http://localhost:3001/..." }

3. Backend → MCP Service: POST /api/integrations/connect
   Headers: X-API-Key: vishal_agent_api_key
   Body: { user_id: "<extracted_from_JWT>", provider: "gmail", redirect_uri: "..." }

4. MCP Service → Frontend: { auth_url: "https://backend.composio.dev/..." }

5. Frontend: Redirect to auth_url

6. User → Composio: Authorize with Google

7. Composio → MCP Service: OAuth callback with tokens

8. ❌ MCP Service: Shows JSON response (SHOULD redirect to redirect_uri)

9. ✅ SHOULD BE: MCP Service → App: Redirect to redirect_uri?status=success&appName=gmail
```

### OAuth Flow (Expected After Fix)
```
Steps 1-7: Same as above

8. ✅ MCP Service → App: HTTP 302 Redirect to redirect_uri
   Location: http://localhost:3001/account/individual/settings/mcp/oauth/callback?status=success&appName=gmail

9. App Callback Handler:
   - Parse query parameters
   - Show success message
   - Update connection state
   - Redirect to MCP settings page
```

---

## Verification Commands

### Check MCP Service Health
```bash
curl http://localhost:3000/api/v1/mcp/health
```

### Test OAuth Initiation
```bash
curl -X POST http://localhost:3000/api/v1/mcp/integrations/connect \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gmail",
    "redirect_uri": "http://localhost:3001/account/individual/settings/mcp/oauth/callback"
  }'
```

### Backend Logs to Monitor
```
[MCP Integration] Connecting gmail for user: <user_id>
[MCP Integration] Redirect URI: http://localhost:3001/...
[MCP Integration] X-API-Key header is present
[MCP Integration] Connect response: {"auth_url":"https://...","message":"..."}
[MCP Controller] Extracted user ID from JWT: <user_id>
```

---

## Contact Information

**MCP Service Administrator:**
- Service: https://mcp.openanalyst.com
- Email: admin@openanalyst.com (check with service provider)
- Required Info: Your user_id, account details, redirect URLs

**Support:**
- For technical issues with your integration
- For alternative implementations if whitelisting not possible

---

## FAQs

**Q: Why can't we just change the redirect URL?**
A: The MCP service uses Composio's OAuth infrastructure. Composio requires redirect URLs to be pre-registered for security.

**Q: Can I test locally without whitelisting?**
A: Use the manual workaround (Solution 2) or implement polling (Solution 3).

**Q: Will this affect production?**
A: Yes - you'll need to whitelist production URLs separately.

**Q: How long does whitelisting take?**
A: Typically 1-2 business days after contacting the administrator.
