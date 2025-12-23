/**
 * MCP OAuth Callback Handler Component
 *
 * Handles the OAuth callback from Google/Slack after user authentication.
 * Processes query parameters and redirects back to the MCP settings page.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  Typography,
  Paper,
  Alert,
  Button,
  Stack,
  useTheme,
  alpha,
} from '@mui/material';
import { Iconify } from 'src/components/iconify';
import checkCircleIcon from '@iconify-icons/mdi/check-circle';
import alertCircleIcon from '@iconify-icons/mdi/alert-circle';
import arrowLeftIcon from '@iconify-icons/mdi/arrow-left';
import { useAuthContext } from 'src/auth/hooks';

const McpOAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const { user } = useAuthContext();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState<string>('');
  const [provider, setProvider] = useState<string>('');

  // Determine the correct path based on account type
  const navigateToMcp = useCallback(() => {
    const isBusiness = user?.accountType === 'business' || user?.accountType === 'organization';
    const basePath = isBusiness
      ? '/account/company-settings/settings/mcp'
      : '/account/individual/settings/mcp';
    navigate(basePath);
  }, [navigate, user?.accountType]);

  useEffect(() => {
    // Parse query parameters
    const statusParam = searchParams.get('status');
    const appName = searchParams.get('appName');
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    // Get provider from localStorage (set during connection initiation)
    const connectingProvider = localStorage.getItem('mcp_connecting_provider') || appName || '';
    setProvider(connectingProvider);

    // Process OAuth callback
    if (statusParam === 'success' && appName) {
      setStatus('success');
      setMessage(`Successfully connected ${appName}. Redirecting to MCP settings...`);

      // Store success message for the main page
      localStorage.setItem('mcp_oauth_success', appName);
      localStorage.removeItem('mcp_connecting_provider');

      // Redirect after a short delay to show success message
      setTimeout(() => {
        navigateToMcp();
      }, 2000);
    } else if (statusParam === 'error' || errorParam) {
      setStatus('error');
      const errorMessage = messageParam || errorParam || 'OAuth authentication failed';
      setMessage(errorMessage);

      // Store error message for the main page
      localStorage.setItem('mcp_oauth_error', errorMessage);
      localStorage.removeItem('mcp_connecting_provider');
    } else {
      // No valid parameters, might be a direct access
      setStatus('error');
      setMessage('Invalid OAuth callback. No status parameters found.');
    }
  }, [searchParams, navigateToMcp]);

  // Handle manual navigation back to MCP
  const handleBackToMcp = () => {
    navigateToMcp();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(theme.palette.background.default, 0.5),
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 500,
          width: '100%',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          textAlign: 'center',
        }}
      >
        {/* Status Icon */}
        {status === 'processing' && (
          <Box sx={{ mb: 3 }}>
            <CircularProgress size={60} thickness={4} />
          </Box>
        )}

        {status === 'success' && (
          <Box
            sx={{
              mb: 3,
              display: 'inline-flex',
              p: 2,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.success.main, 0.1),
            }}
          >
            <Iconify
              icon={checkCircleIcon}
              width={60}
              height={60}
              sx={{ color: theme.palette.success.main }}
            />
          </Box>
        )}

        {status === 'error' && (
          <Box
            sx={{
              mb: 3,
              display: 'inline-flex',
              p: 2,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.error.main, 0.1),
            }}
          >
            <Iconify
              icon={alertCircleIcon}
              width={60}
              height={60}
              sx={{ color: theme.palette.error.main }}
            />
          </Box>
        )}

        {/* Title */}
        <Typography variant="h4" gutterBottom fontWeight="600">
          {status === 'processing' && 'Processing OAuth'}
          {status === 'success' && 'Connection Successful'}
          {status === 'error' && 'Connection Failed'}
        </Typography>

        {/* Message */}
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 3, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {status === 'processing' && 'Validating OAuth callback parameters...'}
          {status !== 'processing' && message}
        </Typography>

        {/* Provider Info */}
        {provider && (
          <Alert
            severity={status === 'success' ? 'success' : status === 'error' ? 'error' : 'info'}
            sx={{ mb: 3 }}
          >
            {status === 'success' && `${provider} has been successfully connected to your account.`}
            {status === 'error' && `Failed to connect ${provider}. Please try again.`}
          </Alert>
        )}

        {/* Actions */}
        {status !== 'processing' && (
          <Stack spacing={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Iconify icon={arrowLeftIcon} />}
              onClick={handleBackToMcp}
              fullWidth
            >
              Back to MCP Settings
            </Button>

            {status === 'error' && (
              <Typography variant="caption" color="text.secondary">
                If the problem persists, please contact support or check your OAuth configuration.
              </Typography>
            )}
          </Stack>
        )}

        {/* Debug Information (only in development) */}
        {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
          <Box
            sx={{
              mt: 3,
              p: 2,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.grey[500], 0.08),
              textAlign: 'left',
            }}
          >
            <Typography variant="caption" color="text.secondary" component="pre">
              Debug Info:{'\n'}
              Status: {searchParams.get('status')}{'\n'}
              App: {searchParams.get('appName')}{'\n'}
              Error: {searchParams.get('error')}{'\n'}
              Message: {searchParams.get('message')}{'\n'}
              Path: {location.pathname}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default McpOAuthCallback;