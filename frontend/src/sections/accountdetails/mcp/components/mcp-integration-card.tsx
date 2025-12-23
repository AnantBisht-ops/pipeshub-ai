/**
 * MCP Integration Card Component
 *
 * Displays a card for each integration provider (Gmail/Slack)
 * Shows connection status, connect/disconnect buttons, and provider info
 */

import React from 'react';
import {
  Card,
  CardContent,
  Avatar,
  Typography,
  Button,
  Chip,
  Box,
  Stack,
  useTheme,
  alpha,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { Iconify } from 'src/components/iconify';
import checkCircleIcon from '@iconify-icons/mdi/check-circle';
import linkOffIcon from '@iconify-icons/mdi/link-off';
import linkIcon from '@iconify-icons/mdi/link';
import alertCircleIcon from '@iconify-icons/mdi/alert-circle';
import clockOutlineIcon from '@iconify-icons/mdi/clock-outline';
import gmailIcon from '@iconify-icons/logos/google-gmail';
import slackIcon from '@iconify-icons/logos/slack-icon';
import { McpIntegration, ProviderType } from '../services/types';

interface McpIntegrationCardProps {
  provider: ProviderType;
  integration?: McpIntegration;
  onConnect: (provider: ProviderType) => void;
  onDisconnect: (provider: ProviderType) => void;
  loading?: boolean;
}

export const McpIntegrationCard: React.FC<McpIntegrationCardProps> = ({
  provider,
  integration,
  onConnect,
  onDisconnect,
  loading = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Provider configuration
  const providerConfig = {
    gmail: {
      name: 'Gmail',
      icon: gmailIcon,
      color: '#EA4335',
      description: 'Send and manage emails',
      capabilities: [
        'Send emails on your behalf',
        'Search and read emails',
        'Create and manage drafts',
        'Organize with labels',
        'Delete emails',
      ],
    },
    slack: {
      name: 'Slack',
      icon: slackIcon,
      color: '#4A154B',
      description: 'Send messages to channels',
      capabilities: [
        'Post messages to channels',
        'Search conversations',
        'List team channels',
        'Read channel history',
      ],
    },
  };

  const config = providerConfig[provider];
  const isConnected = integration?.status === 'active';
  const isPending = integration?.status === 'pending';
  const isError = integration?.status === 'error' || integration?.status === 'expired' || integration?.status === 'revoked';

  // Get status chip configuration
  const getStatusChip = () => {
    if (isConnected) {
      return {
        icon: checkCircleIcon,
        label: 'Connected',
        color: 'success' as const,
      };
    }
    if (isPending) {
      return {
        icon: clockOutlineIcon,
        label: 'Pending',
        color: 'warning' as const,
      };
    }
    if (isError) {
      return {
        icon: alertCircleIcon,
        label: integration?.status === 'expired' ? 'Expired' : 'Error',
        color: 'error' as const,
      };
    }
    return {
      icon: linkOffIcon,
      label: 'Not Connected',
      color: 'default' as const,
    };
  };

  const statusChip = getStatusChip();

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        transition: theme.transitions.create(['transform', 'box-shadow', 'border-color']),
        position: 'relative',
        overflow: 'visible',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: alpha(config.color, 0.5),
          boxShadow: isDark
            ? `0 8px 32px ${alpha('#000', 0.3)}`
            : `0 8px 32px ${alpha(config.color, 0.12)}`,
        },
      }}
    >
      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            borderRadius: 2,
          }}
        >
          <CircularProgress size={40} />
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, p: 3 }}>
        <Stack spacing={3}>
          {/* Provider Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: alpha(config.color, 0.1),
                  border: `2px solid ${alpha(config.color, 0.2)}`,
                }}
              >
                <Iconify
                  icon={config.icon}
                  width={36}
                  height={36}
                  sx={{ color: config.color }}
                />
              </Avatar>
              <Box>
                <Typography variant="h5" fontWeight="600">
                  {config.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {config.description}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Status Section */}
          <Box>
            <Stack spacing={1.5}>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  icon={<Iconify icon={statusChip.icon} />}
                  label={statusChip.label}
                  color={statusChip.color}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    '& .MuiChip-icon': {
                      marginLeft: '8px',
                    },
                  }}
                />
                {isError && integration?.status === 'expired' && (
                  <Tooltip title="OAuth token expired. Please reconnect.">
                    <Iconify
                      icon={alertCircleIcon}
                      width={20}
                      height={20}
                      sx={{ color: theme.palette.error.main }}
                    />
                  </Tooltip>
                )}
              </Box>

              {isConnected && integration?.connected_email && (
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    backgroundColor: alpha(theme.palette.success.main, 0.08),
                    border: `1px solid ${alpha(theme.palette.success.main, 0.24)}`,
                  }}
                >
                  <Typography variant="caption" color="success.dark" fontWeight="medium">
                    CONNECTED ACCOUNT
                  </Typography>
                  <Typography variant="body2" fontWeight="500" mt={0.5}>
                    {integration.connected_email}
                  </Typography>
                  {integration.connected_at && (
                    <Typography variant="caption" color="text.secondary">
                      Connected: {new Date(integration.connected_at).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          </Box>

          {/* OAuth Admin Consent Section */}
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.info.main, 0.08),
              border: `1px solid ${alpha(theme.palette.info.main, 0.24)}`,
            }}
          >
            <Typography variant="caption" color="info.dark" fontWeight="medium">
              OAUTH ADMIN CONSENT
            </Typography>
            <Typography variant="caption" display="block" mt={0.5} color="text.secondary">
              {isConnected
                ? '✓ Active - OAuth tokens stored securely by Composio'
                : '• Not configured - Connect to grant access'}
            </Typography>
          </Box>

          {/* Capabilities Section */}
          {!isConnected && (
            <Box>
              <Typography variant="subtitle2" fontWeight="600" gutterBottom>
                What AI agents can do:
              </Typography>
              <Stack spacing={0.5}>
                {config.capabilities.map((capability, index) => (
                  <Box key={index} display="flex" alignItems="center" gap={1}>
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: config.color,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {capability}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Action Buttons */}
          <Box>
            {isConnected ? (
              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Iconify icon={linkOffIcon} />}
                  onClick={() => onDisconnect(provider)}
                  fullWidth
                  disabled={loading}
                  sx={{
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2,
                      backgroundColor: alpha(theme.palette.error.main, 0.08),
                    },
                  }}
                >
                  Disconnect
                </Button>
                {isError && (
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<Iconify icon={linkIcon} />}
                    onClick={() => onConnect(provider)}
                    fullWidth
                    disabled={loading}
                  >
                    Reconnect
                  </Button>
                )}
              </Stack>
            ) : (
              <Button
                variant="contained"
                color="primary"
                startIcon={<Iconify icon={linkIcon} />}
                onClick={() => onConnect(provider)}
                fullWidth
                disabled={loading}
                sx={{
                  background: `linear-gradient(135deg, ${config.color} 0%, ${alpha(
                    config.color,
                    0.8
                  )} 100%)`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(
                      config.color,
                      0.9
                    )} 0%, ${config.color} 100%)`,
                  },
                }}
              >
                Connect {config.name}
              </Button>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default McpIntegrationCard;