/**
 * MCP Integrations Main Page
 *
 * Main page for managing MCP integrations (Gmail, Slack, etc.)
 * Similar to the Data Connectors page in design and functionality
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Alert,
  Snackbar,
  Paper,
  alpha,
  useTheme,
  Skeleton,
  Button,
  Divider,
} from '@mui/material';

import magnifyIcon from '@iconify-icons/mdi/magnify';
import refreshIcon from '@iconify-icons/mdi/refresh';
import informationOutlineIcon from '@iconify-icons/mdi/information-outline';

import { Iconify } from 'src/components/iconify';

import { McpIntegrationCard } from './components/mcp-integration-card';
import { OAuthErrorDialog } from './components/oauth-error-dialog';
import { useOAuthRetry } from './hooks/use-retry-operation';
import { mcpApiService, McpApiService } from './services/api';
import { McpIntegration, ProviderType } from './services/types';
import { connectionStateManager, ConnectionState } from './utils/connection-state-manager';
import { mcpErrorHandler, McpError, McpErrorType } from './utils/error-handler';

export const McpIntegrations: React.FC = () => {
  const theme = useTheme();
  const [integrations, setIntegrations] = useState<McpIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<ProviderType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'not-configured'>('all');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Error handling states
  const [oauthError, setOauthError] = useState<McpError | null>(null);
  const [currentProvider, setCurrentProvider] = useState<ProviderType | undefined>();

  // OAuth retry hook
  const { shouldRetryOAuth, handleOAuthRetry, resetAttempts } = useOAuthRetry(
    currentProvider || 'gmail'
  );

  // Setup connection state listeners
  useEffect(() => {
    const unsubscribe = connectionStateManager.onStateChange((event) => {
      console.log(`[MCP] State change for ${event.provider}: ${event.currentState}`);

      // Handle state changes
      if (event.currentState === ConnectionState.CONNECTED) {
        loadIntegrations(false);
        setSnackbar({
          open: true,
          message: `Successfully connected ${event.provider}`,
          severity: 'success',
        });
      } else if (event.currentState === ConnectionState.ERROR && event.error) {
        const error = event.error as McpError;
        if (error.type === McpErrorType.OAUTH_CANCELLED) {
          // User cancelled - show info message
          setSnackbar({
            open: true,
            message: 'Connection cancelled. You can try again anytime.',
            severity: 'info',
          });
        } else if (error.type === McpErrorType.OAUTH_TOKEN_EXPIRED) {
          // Token expired - show warning
          setSnackbar({
            open: true,
            message: `Your ${event.provider} connection has expired. Please reconnect.`,
            severity: 'warning',
          });
        } else {
          // Other errors - show error dialog
          setOauthError(error);
          setCurrentProvider(event.provider);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Load integrations on mount
  useEffect(() => {
    loadIntegrations();

    // Initialize connection states
    connectionStateManager.refreshIntegrations();

    // Check for OAuth callback success/error messages
    const oauthSuccess = localStorage.getItem('mcp_oauth_success');
    const oauthErrorMsg = localStorage.getItem('mcp_oauth_error');

    if (oauthSuccess) {
      setSnackbar({
        open: true,
        message: `Successfully connected ${oauthSuccess}`,
        severity: 'success',
      });
      localStorage.removeItem('mcp_oauth_success');
    } else if (oauthErrorMsg) {
      // Parse OAuth error
      const error = mcpErrorHandler.handleError(
        { error: oauthErrorMsg },
        'OAuth callback'
      );
      setOauthError(error);
      localStorage.removeItem('mcp_oauth_error');
    }
  }, []);

  // Load integrations from API
  const loadIntegrations = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await mcpApiService.getConnectedIntegrations();

      // Create integration objects for all providers
      const providers = McpApiService.getAvailableProviders();
      const integrationsMap = new Map<ProviderType, McpIntegration>();

      // Add connected integrations
      if (response.integrations) {
        response.integrations.forEach((integration) => {
          integrationsMap.set(integration.provider, integration);
        });
      }

      // Add disconnected placeholders for providers without integrations
      providers.forEach((provider) => {
        if (!integrationsMap.has(provider)) {
          integrationsMap.set(provider, {
            provider,
            status: 'disconnected',
          });
        }
      });

      setIntegrations(Array.from(integrationsMap.values()));
    } catch (error: any) {
      console.error('Failed to load integrations:', error);

      // If authentication error, still show providers as disconnected
      if (error.response?.status === 401 || error.response?.status === 403) {
        const providers = McpApiService.getAvailableProviders();
        setIntegrations(
          providers.map((provider) => ({
            provider,
            status: 'disconnected',
          }))
        );
        setSnackbar({
          open: true,
          message: 'Authentication required. Please log in to manage integrations.',
          severity: 'warning',
        });
      } else {
        setSnackbar({
          open: true,
          message: 'Failed to load integrations. Please try again.',
          severity: 'error',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh button click
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadIntegrations(false);
  }, []);

  // Handle connect integration with retry logic
  const handleConnect = useCallback(async (provider: ProviderType) => {
    try {
      setLoadingProvider(provider);
      setCurrentProvider(provider);
      resetAttempts();

      // Update connection state
      await connectionStateManager.initiateConnection(provider);
    } catch (error: any) {
      console.error('Failed to connect:', error);

      // Process error through error handler
      const mcpError = mcpErrorHandler.handleError(error, `Connect ${provider}`);

      // Check if we should show the error dialog
      if (mcpError.type === McpErrorType.OAUTH_CANCELLED ||
          mcpError.type === McpErrorType.OAUTH_PERMISSION_DENIED ||
          mcpError.type === McpErrorType.OAUTH_TOKEN_EXPIRED) {
        setOauthError(mcpError);
      } else {
        // For other errors, show snackbar
        setSnackbar({
          open: true,
          message: mcpError.userMessage,
          severity: 'error',
        });
      }
    } finally {
      setLoadingProvider(null);
    }
  }, [resetAttempts]);

  // Handle disconnect integration
  const handleDisconnect = async (provider: ProviderType) => {
    try {
      setLoadingProvider(provider);
      setCurrentProvider(provider);

      // Update connection state
      await connectionStateManager.initiateDisconnection(provider);
      await loadIntegrations(false);

      setSnackbar({
        open: true,
        message: `Successfully disconnected ${McpApiService.getProviderInfo(provider).name}`,
        severity: 'success',
      });
    } catch (error: any) {
      console.error('Failed to disconnect:', error);

      // Process error through error handler
      const mcpError = mcpErrorHandler.handleError(error, `Disconnect ${provider}`);

      setSnackbar({
        open: true,
        message: mcpError.userMessage,
        severity: 'error',
      });
    } finally {
      setLoadingProvider(null);
    }
  };

  // Handle OAuth error retry
  const handleOAuthErrorRetry = useCallback(async () => {
    if (!currentProvider) return;

    handleOAuthRetry();
    setOauthError(null);
    await handleConnect(currentProvider);
  }, [currentProvider, handleOAuthRetry, handleConnect]);

  // Handle OAuth error reconnect
  const handleOAuthErrorReconnect = useCallback(async () => {
    if (!currentProvider) return;

    setOauthError(null);
    await handleConnect(currentProvider);
  }, [currentProvider, handleConnect]);

  // Get integration for a specific provider
  const getIntegration = (provider: ProviderType): McpIntegration | undefined =>
    integrations.find((i) => i.provider === provider);

  // Filter providers based on search and filter
  const filteredIntegrations = integrations.filter((integration) => {
    // Search filter
    const providerInfo = McpApiService.getProviderInfo(integration.provider);
    if (
      searchQuery &&
      !providerInfo.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !providerInfo.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Status filter
    const isActive = integration.status === 'active';
    const isNotConfigured = integration.status === 'disconnected' || !integration.status;

    if (selectedFilter === 'active' && !isActive) return false;
    if (selectedFilter === 'not-configured' && !isNotConfigured) return false;

    return true;
  });

  // Calculate counts
  const activeCount = integrations.filter((i) => i.status === 'active').length;
  const notConfiguredCount = integrations.filter(
    (i) => i.status === 'disconnected' || !i.status
  ).length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h4" fontWeight="600">
            MCP AI Agent Integrations
          </Typography>
          <Button
            startIcon={<Iconify icon={refreshIcon} />}
            onClick={handleRefresh}
            disabled={refreshing}
            size="small"
            variant="outlined"
          >
            Refresh
          </Button>
        </Stack>
        <Typography variant="body1" color="text.secondary">
          Connect external services to enable AI agents to perform actions on your behalf
        </Typography>
      </Box>

      {/* Search and Filters */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon={magnifyIcon} />
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Filter:
            </Typography>
            <Chip
              label={`All (${integrations.length})`}
              onClick={() => setSelectedFilter('all')}
              color={selectedFilter === 'all' ? 'primary' : 'default'}
              variant={selectedFilter === 'all' ? 'filled' : 'outlined'}
              clickable
            />
            <Chip
              label={`Active (${activeCount})`}
              onClick={() => setSelectedFilter('active')}
              color={selectedFilter === 'active' ? 'primary' : 'default'}
              variant={selectedFilter === 'active' ? 'filled' : 'outlined'}
              clickable
            />
            <Chip
              label={`Not Configured (${notConfiguredCount})`}
              onClick={() => setSelectedFilter('not-configured')}
              color={selectedFilter === 'not-configured' ? 'primary' : 'default'}
              variant={selectedFilter === 'not-configured' ? 'filled' : 'outlined'}
              clickable
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Integration Cards Grid */}
      {loading ? (
        <Grid container spacing={3}>
          {[1, 2].map((index) => (
            <Grid item xs={12} sm={6} md={6} key={index}>
              <Skeleton variant="rectangular" height={380} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : filteredIntegrations.length > 0 ? (
        <Grid container spacing={3}>
          {filteredIntegrations.map((integration) => (
            <Grid item xs={12} sm={6} md={6} key={integration.provider}>
              <McpIntegrationCard
                provider={integration.provider}
                integration={integration}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                loading={loadingProvider === integration.provider}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body1" color="text.secondary">
            No integrations found matching your search criteria
          </Typography>
        </Paper>
      )}

      {/* Information Panel */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mt: 4,
          borderRadius: 2,
          backgroundColor: alpha(theme.palette.info.main, 0.05),
          border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Iconify
            icon={informationOutlineIcon}
            width={24}
            height={24}
            sx={{ color: theme.palette.info.main, mt: 0.5 }}
          />
          <Box>
            <Typography variant="h6" gutterBottom color="info.dark">
              How MCP Integrations Work
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                  OAuth Authentication
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  When you connect an integration, you will be redirected to the service provider
                  (Google/Slack) to grant permissions. Your OAuth tokens are securely stored by
                  Composio and never exposed to PipesHub or AI agents directly.
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                  AI Agent Capabilities
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Once connected, AI agents can perform actions on your behalf using the MCP
                  service. All actions are logged and can be audited. You can disconnect
                  integrations at any time to revoke access.
                </Typography>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                  Security & Privacy
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • OAuth tokens are encrypted and stored securely by Composio
                  <br />
                  • AI agents never see your credentials directly
                  <br />
                  • All API calls are authenticated and rate-limited
                  <br />
                  • You maintain full control over connected integrations
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* OAuth Error Dialog */}
      <OAuthErrorDialog
        open={Boolean(oauthError)}
        error={oauthError}
        provider={currentProvider}
        onClose={() => setOauthError(null)}
        onRetry={handleOAuthErrorRetry}
        onReconnect={handleOAuthErrorReconnect}
      />
    </Box>
  );
};

export default McpIntegrations;