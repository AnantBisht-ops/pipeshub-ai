# MCP OAuth Flow Documentation

## OAuth Connect Flow

### 1. User Initiates Connection
**Location**: `mcp-integrations.tsx`
```typescript
const handleConnect = async (provider: ProviderType) => {
  // 1. Set loading state
  setLoadingProvider(provider);

  // 2. Store provider for callback reference
  localStorage.setItem('mcp_connecting_provider', provider);

  // 3. Call API to get OAuth URL
  const response = await mcpApiService.connectIntegration(provider);

  // 4. Redirect to OAuth provider
  window.location.href = response.auth_url;
}
```

### 2. API Service Prepares OAuth Request
**Location**: `services/api.ts`
```typescript
async connectIntegration(provider: ProviderType) {
  // 1. Get JWT token
  const token = this.getAuthToken();

  // 2. Store return URL for after OAuth
  sessionStorage.setItem('mcp_oauth_return_url', currentUrl);

  // 3. Build callback URL
  const redirectUri = `${window.location.origin}/account/.../mcp/oauth/callback`;

  // 4. Send request to MCP service
  POST /api/integrations/connect
  Body: { provider, redirect_uri }

  // 5. Return OAuth URL
  return { auth_url: "https://accounts.google.com/oauth..." }
}
```

### 3. User Authenticates with Provider
- User is redirected to Google/Slack
- User logs in and grants permissions
- Provider redirects back to PipesHub callback URL

### 4. OAuth Callback Processing
**Location**: `components/mcp-oauth-callback.tsx`
```typescript
// Parse query parameters
const status = searchParams.get('status');
const appName = searchParams.get('appName');
const error = searchParams.get('error');

if (status === 'success') {
  // Store success for notification
  localStorage.setItem('mcp_oauth_success', appName);

  // Redirect to MCP settings page
  navigate('/account/.../settings/mcp');
} else {
  // Store error for notification
  localStorage.setItem('mcp_oauth_error', error);

  // Redirect to MCP settings page
  navigate('/account/.../settings/mcp');
}
```

### 5. Main Page Displays Result
**Location**: `mcp-integrations.tsx`
```typescript
useEffect(() => {
  // Check for OAuth callback messages
  const oauthSuccess = localStorage.getItem('mcp_oauth_success');
  const oauthError = localStorage.getItem('mcp_oauth_error');

  if (oauthSuccess) {
    showSnackbar('Successfully connected', 'success');
    localStorage.removeItem('mcp_oauth_success');
  } else if (oauthError) {
    showSnackbar(oauthError, 'error');
    localStorage.removeItem('mcp_oauth_error');
  }

  // Reload integrations list
  loadIntegrations();
}, []);
```

---

## OAuth Disconnect Flow

### 1. User Initiates Disconnection
**Location**: `mcp-integrations.tsx`
```typescript
const handleDisconnect = async (provider: ProviderType) => {
  // 1. Set loading state
  setLoadingProvider(provider);

  // 2. Call API to disconnect
  await mcpApiService.disconnectIntegration(provider);

  // 3. Reload integrations list
  await loadIntegrations(false);

  // 4. Show success notification
  setSnackbar({
    open: true,
    message: `Successfully disconnected ${provider}`,
    severity: 'success',
  });
}
```

### 2. API Service Sends Disconnect Request
**Location**: `services/api.ts`
```typescript
async disconnectIntegration(provider: ProviderType) {
  // 1. Get JWT token
  const token = this.getAuthToken();

  // 2. Send DELETE request to MCP service
  DELETE /api/integrations/{provider}
  Headers: { Authorization: Bearer ${token} }

  // 3. Return success message
  return { message: "Successfully disconnected" }
}
```

### 3. UI Updates
- Integration card shows "Not Connected" status
- Connect button reappears
- Success notification displayed
- Integration removed from active list

---

## Error Handling

### Authentication Errors
- **No JWT Token**: Show "Please log in" message
- **Token Expired**: Redirect to login page
- **403 Forbidden**: Show "Access denied" message

### OAuth Errors
- **User Cancellation**: Show "Authentication cancelled" message
- **Permission Denied**: Show "Permission denied by provider" message
- **Invalid State**: Show "OAuth state mismatch" error
- **Network Error**: Show "Connection failed" message with retry option

### API Errors
- **500 Server Error**: Show "Service temporarily unavailable"
- **404 Not Found**: Show "Integration not found"
- **400 Bad Request**: Show validation error details
- **Network Timeout**: Show "Request timed out" with retry

### Recovery Strategies
1. **Automatic Retry**: For network errors (3 attempts with exponential backoff)
2. **Manual Retry**: User can click refresh button to reload integrations
3. **Force Re-auth**: Option to reconnect with `force_reauth: true`
4. **Fallback Display**: Show disconnected state if can't load integrations

---

## Security Considerations

### Token Management
- JWT tokens stored in localStorage
- Tokens never exposed in URLs
- API key only used for agent operations

### OAuth Security
- State parameter prevents CSRF attacks
- Redirect URLs validated by MCP service
- OAuth tokens stored securely by Composio

### Error Information
- Sensitive details hidden from user
- Full errors logged to console for debugging
- Generic messages for production

---

## Testing Checklist

### Connect Flow
- [ ] Click Connect button
- [ ] Verify loading state appears
- [ ] Verify redirect to OAuth provider
- [ ] Complete OAuth authentication
- [ ] Verify callback processing
- [ ] Verify success notification
- [ ] Verify integration shows as connected

### Disconnect Flow
- [ ] Click Disconnect button
- [ ] Verify confirmation (if implemented)
- [ ] Verify loading state
- [ ] Verify API call succeeds
- [ ] Verify success notification
- [ ] Verify integration shows as disconnected

### Error Scenarios
- [ ] Test with no authentication
- [ ] Test with expired token
- [ ] Test OAuth cancellation
- [ ] Test network failure
- [ ] Test invalid provider
- [ ] Test server errors