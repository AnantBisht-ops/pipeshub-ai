/**
 * OAuth Error Dialog Component
 *
 * Displays user-friendly error messages and recovery options
 * when OAuth authentication fails
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Stack,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  useTheme,
  alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

import closeIcon from '@iconify-icons/mdi/close';
import alertCircleIcon from '@iconify-icons/mdi/alert-circle';
import refreshIcon from '@iconify-icons/mdi/refresh';
import linkIcon from '@iconify-icons/mdi/link';
import checkCircleIcon from '@iconify-icons/mdi/check-circle';
import chevronDownIcon from '@iconify-icons/mdi/chevron-down';
import chevronUpIcon from '@iconify-icons/mdi/chevron-up';
import shieldCheckIcon from '@iconify-icons/mdi/shield-check';
import accountIcon from '@iconify-icons/mdi/account';
import clockIcon from '@iconify-icons/mdi/clock-outline';

import { Iconify } from 'src/components/iconify';

import { ProviderType } from '../services/types';
import { McpError, McpErrorType } from '../utils/error-handler';

interface OAuthErrorDialogProps {
  open: boolean;
  error: McpError | null;
  provider?: ProviderType;
  onClose: () => void;
  onRetry?: () => void;
  onReconnect?: () => void;
}

export const OAuthErrorDialog: React.FC<OAuthErrorDialogProps> = ({
  open,
  error,
  provider,
  onClose,
  onRetry,
  onReconnect,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Get error-specific information
  const getErrorInfo = () => {
    if (!error) return null;

    const errorConfigs: Record<string, any> = {
      [McpErrorType.OAUTH_CANCELLED]: {
        title: 'Connection Cancelled',
        icon: closeIcon,
        color: theme.palette.warning.main,
        description: 'You cancelled the connection process. You can try again anytime.',
        solutions: [
          { icon: refreshIcon, text: 'Try connecting again', action: 'retry' },
          { icon: linkIcon, text: 'Use a different account', action: 'retry' },
        ],
      },
      [McpErrorType.OAUTH_PERMISSION_DENIED]: {
        title: 'Permission Denied',
        icon: shieldCheckIcon,
        color: theme.palette.error.main,
        description: 'The necessary permissions were not granted. PipesHub needs these permissions to work with your account.',
        solutions: [
          { icon: checkCircleIcon, text: 'Grant all requested permissions', action: 'retry' },
          { icon: accountIcon, text: 'Check account settings', action: 'external' },
        ],
      },
      [McpErrorType.OAUTH_TOKEN_EXPIRED]: {
        title: 'Connection Expired',
        icon: clockIcon,
        color: theme.palette.warning.main,
        description: 'Your connection has expired and needs to be renewed.',
        solutions: [
          { icon: refreshIcon, text: 'Reconnect your account', action: 'reconnect' },
          { icon: linkIcon, text: 'Use a different account', action: 'retry' },
        ],
      },
      [McpErrorType.OAUTH_INVALID_STATE]: {
        title: 'Authentication Failed',
        icon: alertCircleIcon,
        color: theme.palette.error.main,
        description: 'There was a security issue with the authentication process. This is usually temporary.',
        solutions: [
          { icon: refreshIcon, text: 'Try again', action: 'retry' },
          { icon: clockIcon, text: 'Wait a moment and retry', action: 'wait' },
        ],
      },
      [McpErrorType.OAUTH_REDIRECT_MISMATCH]: {
        title: 'Configuration Error',
        icon: alertCircleIcon,
        color: theme.palette.error.main,
        description: 'There is a configuration issue with the OAuth setup. Please contact support.',
        solutions: [
          { icon: alertCircleIcon, text: 'Contact support team', action: 'support' },
        ],
      },
      [McpErrorType.AUTH_TOKEN_EXPIRED]: {
        title: 'Session Expired',
        icon: clockIcon,
        color: theme.palette.warning.main,
        description: 'Your login session has expired. Please log in again to continue.',
        solutions: [
          { icon: accountIcon, text: 'Log in again', action: 'login' },
        ],
      },
      [McpErrorType.NETWORK_TIMEOUT]: {
        title: 'Connection Timeout',
        icon: clockIcon,
        color: theme.palette.warning.main,
        description: 'The connection took too long. This might be due to network issues.',
        solutions: [
          { icon: refreshIcon, text: 'Try again', action: 'retry' },
          { icon: alertCircleIcon, text: 'Check your internet connection', action: 'check' },
        ],
      },
      [McpErrorType.NETWORK_OFFLINE]: {
        title: 'No Internet Connection',
        icon: alertCircleIcon,
        color: theme.palette.error.main,
        description: 'You appear to be offline. Please check your internet connection.',
        solutions: [
          { icon: alertCircleIcon, text: 'Check internet connection', action: 'check' },
          { icon: refreshIcon, text: 'Retry when online', action: 'retry' },
        ],
      },
    };

    return errorConfigs[error.type] || {
      title: 'Connection Error',
      icon: alertCircleIcon,
      color: theme.palette.error.main,
      description: error.userMessage || 'An unexpected error occurred while connecting.',
      solutions: [
        { icon: refreshIcon, text: 'Try again', action: 'retry' },
      ],
    };
  };

  const errorInfo = getErrorInfo();

  const handleAction = async (action: string) => {
    switch (action) {
      case 'retry':
        setRetrying(true);
        if (onRetry) {
          await onRetry();
        }
        setRetrying(false);
        onClose();
        break;

      case 'reconnect':
        if (onReconnect) {
          onReconnect();
        }
        onClose();
        break;

      case 'login':
        navigate('/login');
        break;

      case 'support':
        window.open('/support', '_blank');
        break;

      case 'wait':
        setTimeout(() => {
          if (onRetry) {
            onRetry();
          }
        }, 3000);
        onClose();
        break;

      case 'external':
        // Open provider settings
        if (provider === 'gmail') {
          window.open('https://myaccount.google.com/permissions', '_blank');
        } else if (provider === 'slack') {
          window.open('https://slack.com/apps/manage', '_blank');
        }
        break;

      default:
        break;
    }
  };

  if (!errorInfo) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'visible',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                p: 1,
                borderRadius: '50%',
                backgroundColor: alpha(errorInfo.color, 0.1),
              }}
            >
              <Iconify
                icon={errorInfo.icon}
                width={28}
                height={28}
                sx={{ color: errorInfo.color }}
              />
            </Box>
            <Typography variant="h6">{errorInfo.title}</Typography>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <Iconify icon={closeIcon} />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Error Description */}
          <Alert severity="warning" sx={{ borderRadius: 1 }}>
            {errorInfo.description}
          </Alert>

          {/* Provider Info */}
          {provider && (
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                backgroundColor: alpha(theme.palette.grey[500], 0.08),
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Provider: <strong>{provider === 'gmail' ? 'Gmail' : 'Slack'}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Attempting to connect to {provider === 'gmail' ? 'Google' : 'Slack'} account
              </Typography>
            </Box>
          )}

          {/* Solutions */}
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight="600">
              What you can do:
            </Typography>
            <List dense>
              {errorInfo.solutions.map((solution: any, idx: number) => (
                <ListItem
                  key={idx}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.action.hover, 0.08),
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Iconify
                      icon={solution.icon}
                      width={20}
                      height={20}
                      sx={{ color: theme.palette.primary.main }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={solution.text}
                    primaryTypographyProps={{
                      variant: 'body2',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Technical Details (Collapsible) */}
          {error && (
            <>
              <Divider />
              <Box>
                <Button
                  size="small"
                  onClick={() => setShowDetails(!showDetails)}
                  endIcon={
                    <Iconify icon={showDetails ? chevronUpIcon : chevronDownIcon} />
                  }
                  sx={{ mb: 1 }}
                >
                  Technical Details
                </Button>
                <Collapse in={showDetails}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      backgroundColor: alpha(theme.palette.grey[500], 0.08),
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                    }}
                  >
                    <Typography variant="caption" component="div">
                      Error Type: {error.type}
                    </Typography>
                    <Typography variant="caption" component="div">
                      Message: {error.message}
                    </Typography>
                    {error.statusCode && (
                      <Typography variant="caption" component="div">
                        Status Code: {error.statusCode}
                      </Typography>
                    )}
                    {error.details && (
                      <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                        Details: {JSON.stringify(error.details, null, 2)}
                      </Typography>
                    )}
                  </Box>
                </Collapse>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        {errorInfo.solutions.map((solution: any, idx: number) => {
          if (idx === 0) {
            // Primary action
            return (
              <Button
                key={idx}
                variant="contained"
                onClick={() => handleAction(solution.action)}
                disabled={retrying}
                startIcon={
                  retrying ? (
                    <Box sx={{
                      '@keyframes spin': {
                        from: { transform: 'rotate(0deg)' },
                        to: { transform: 'rotate(360deg)' }
                      },
                      animation: 'spin 1s linear infinite'
                    }}>
                      <Iconify icon={refreshIcon} />
                    </Box>
                  ) : (
                    <Iconify icon={solution.icon} />
                  )
                }
              >
                {retrying ? 'Retrying...' : solution.text}
              </Button>
            );
          }
          return null;
        })}
      </DialogActions>
    </Dialog>
  );
};

/**
 * OAuth Error Alert Component (Inline version)
 */
export const OAuthErrorAlert: React.FC<{
  error: McpError;
  provider?: ProviderType;
  onRetry?: () => void;
  onDismiss?: () => void;
}> = ({ error, provider, onRetry, onDismiss }) => {
  const theme = useTheme();

  const getSeverity = () => {
    switch (error.type) {
      case McpErrorType.OAUTH_CANCELLED:
        return 'info';
      case McpErrorType.OAUTH_TOKEN_EXPIRED:
      case McpErrorType.NETWORK_TIMEOUT:
        return 'warning';
      default:
        return 'error';
    }
  };

  return (
    <Alert
      severity={getSeverity()}
      onClose={onDismiss}
      action={
        error.retryable && onRetry ? (
          <Button
            size="small"
            color="inherit"
            onClick={onRetry}
            startIcon={<Iconify icon={refreshIcon} />}
          >
            Retry
          </Button>
        ) : undefined
      }
      sx={{
        borderRadius: 1,
        mb: 2,
      }}
    >
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{error.userMessage}</Typography>
        {provider && (
          <Typography variant="caption" color="text.secondary">
            Provider: {provider === 'gmail' ? 'Gmail' : 'Slack'}
          </Typography>
        )}
      </Stack>
    </Alert>
  );
};

export default OAuthErrorDialog;