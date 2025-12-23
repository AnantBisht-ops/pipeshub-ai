/**
 * MCP Capabilities Panel Component
 *
 * Displays available AI agent capabilities based on user's MCP integrations
 * Shows what actions the ChatBot can perform for the user
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
  Tooltip,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import { Iconify } from 'src/components/iconify';
import { useNavigate } from 'react-router-dom';
import { mcpApiService } from 'src/sections/accountdetails/mcp/services/api';
import expandIcon from '@iconify-icons/mdi/chevron-down';
import collapseIcon from '@iconify-icons/mdi/chevron-up';
import gmailIcon from '@iconify-icons/logos/google-gmail';
import slackIcon from '@iconify-icons/logos/slack-icon';
import sparklesIcon from '@iconify-icons/mdi/sparkles';
import linkIcon from '@iconify-icons/mdi/link';
import sendIcon from '@iconify-icons/mdi/send';
import emailIcon from '@iconify-icons/mdi/email';
import messageIcon from '@iconify-icons/mdi/message-text';
import searchIcon from '@iconify-icons/mdi/magnify';

interface McpCapability {
  provider: 'gmail' | 'slack';
  connected: boolean;
  actions: string[];
}

interface McpCapabilitiesPanelProps {
  userId?: string;
  compact?: boolean;
  onActionClick?: (action: string) => void;
}

export const McpCapabilitiesPanel: React.FC<McpCapabilitiesPanelProps> = ({
  userId,
  compact = false,
  onActionClick,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState<McpCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [error, setError] = useState<string | null>(null);

  const loadCapabilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's available tools
      const response = await mcpApiService.getUserTools(userId);
      const tools = response.tools || [];

      // Group by provider
      const gmailActions = tools
        .filter(t => t.provider === 'gmail')
        .map(t => t.name);
      const slackActions = tools
        .filter(t => t.provider === 'slack')
        .map(t => t.name);

      setCapabilities([
        {
          provider: 'gmail',
          connected: gmailActions.length > 0,
          actions: gmailActions,
        },
        {
          provider: 'slack',
          connected: slackActions.length > 0,
          actions: slackActions,
        },
      ]);
    } catch (err: any) {
      console.error('Failed to load MCP capabilities:', err);
      setError('Unable to load AI capabilities');
      // Set default disconnected state
      setCapabilities([
        { provider: 'gmail', connected: false, actions: [] },
        { provider: 'slack', connected: false, actions: [] },
      ]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadCapabilities();
    }
  }, [userId, loadCapabilities]);

  const getProviderInfo = (provider: string) => {
    const info = {
      gmail: {
        name: 'Gmail',
        icon: gmailIcon,
        color: '#EA4335',
        examples: [
          { icon: sendIcon, text: 'Send emails', action: 'GMAIL_SEND_EMAIL' },
          { icon: emailIcon, text: 'Check unread emails', action: 'GMAIL_FETCH_EMAILS' },
          { icon: searchIcon, text: 'Search emails', action: 'GMAIL_FETCH_EMAILS' },
        ],
      },
      slack: {
        name: 'Slack',
        icon: slackIcon,
        color: '#4A154B',
        examples: [
          { icon: messageIcon, text: 'Post to channels', action: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL' },
          { icon: searchIcon, text: 'Search messages', action: 'SLACK_SEARCH_MESSAGES_IN_SLACK' },
        ],
      },
    };
    return info[provider as keyof typeof info];
  };

  const handleConnectClick = () => {
    // Navigate to MCP settings
    const accountType = localStorage.getItem('user_account_type');
    const path = accountType === 'business'
      ? '/account/company-settings/settings/mcp'
      : '/account/individual/settings/mcp';
    navigate(path);
  };

  const handleExampleClick = (action: string) => {
    if (onActionClick) {
      onActionClick(action);
    }
  };

  // Count total connected services
  const connectedCount = capabilities.filter(c => c.connected).length;
  const hasConnections = connectedCount > 0;

  if (loading) {
    return (
      <Card elevation={0} sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Loading AI capabilities...
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
      }}
    >
      <CardContent sx={{ p: compact ? 2 : 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify
              icon={sparklesIcon}
              width={24}
              height={24}
              sx={{ color: theme.palette.primary.main }}
            />
            <Typography variant="h6" fontWeight="600">
              AI Capabilities
            </Typography>
            {hasConnections && (
              <Chip
                label={`${connectedCount} Connected`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Stack>
          {compact && (
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              <Iconify icon={expanded ? collapseIcon : expandIcon} />
            </IconButton>
          )}
        </Stack>

        {/* Error Alert */}
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Collapse in={expanded}>
          {/* No Connections Alert */}
          {!hasConnections && (
            <Alert
              severity="info"
              action={
                <Button
                  size="small"
                  startIcon={<Iconify icon={linkIcon} />}
                  onClick={handleConnectClick}
                >
                  Connect Services
                </Button>
              }
              sx={{ mb: 2 }}
            >
              Connect Gmail or Slack to unlock AI-powered actions
            </Alert>
          )}

          {/* Capabilities List */}
          <Stack spacing={2}>
            {capabilities.map((capability, idx) => {
              const providerInfo = getProviderInfo(capability.provider);
              if (!providerInfo) return null;

              return (
                <Box key={capability.provider}>
                  <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
                    <Box
                      sx={{
                        p: 0.5,
                        borderRadius: 1,
                        backgroundColor: alpha(providerInfo.color, 0.1),
                      }}
                    >
                      <Iconify
                        icon={providerInfo.icon}
                        width={20}
                        height={20}
                        sx={{ color: providerInfo.color }}
                      />
                    </Box>
                    <Typography variant="subtitle2" fontWeight="600">
                      {providerInfo.name}
                    </Typography>
                    <Chip
                      label={capability.connected ? 'Connected' : 'Not Connected'}
                      size="small"
                      color={capability.connected ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ height: 20 }}
                    />
                  </Stack>

                  {capability.connected ? (
                    <List dense sx={{ ml: 4 }}>
                      {providerInfo.examples.map((example, exampleIdx) => (
                        <ListItem
                          key={exampleIdx}
                          sx={{
                            py: 0.5,
                            px: 1,
                            borderRadius: 1,
                            cursor: onActionClick ? 'pointer' : 'default',
                            '&:hover': onActionClick
                              ? {
                                  backgroundColor: alpha(theme.palette.action.hover, 0.08),
                                }
                              : {},
                          }}
                          onClick={() => handleExampleClick(example.action)}
                        >
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <Iconify
                              icon={example.icon}
                              width={18}
                              height={18}
                              sx={{ color: theme.palette.text.secondary }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={example.text}
                            primaryTypographyProps={{
                              variant: 'body2',
                              color: 'text.primary',
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ ml: 4, fontStyle: 'italic' }}
                    >
                      Connect {providerInfo.name} to enable these actions
                    </Typography>
                  )}

                  {idx < capabilities.length - 1 && (
                    <Divider sx={{ my: 1.5, ml: 4 }} />
                  )}
                </Box>
              );
            })}
          </Stack>

          {/* Helper Text */}
          {hasConnections && (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                backgroundColor: alpha(theme.palette.info.main, 0.08),
              }}
            >
              <Typography variant="caption" color="info.dark">
                💡 Try asking me to {connectedCount === 2 ? 'send emails or post to Slack' : capabilities[0].provider === 'gmail' ? 'send or check emails' : 'post messages to Slack'}
              </Typography>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

/**
 * Compact version for embedding in ChatBot
 */
export const McpCapabilitiesChip: React.FC<{ userId?: string }> = ({ userId }) => {
  const [hasCapabilities, setHasCapabilities] = useState(false);
  const navigate = useNavigate();

  const checkCapabilities = useCallback(async () => {
    try {
      const response = await mcpApiService.getUserTools(userId);
      setHasCapabilities(response.tools && response.tools.length > 0);
    } catch (error) {
      console.error('Failed to check capabilities:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      checkCapabilities();
    }
  }, [userId, checkCapabilities]);

  if (!hasCapabilities) {
    return (
      <Tooltip title="Connect Gmail or Slack to unlock AI actions">
        <Chip
          label="No AI Actions"
          size="small"
          variant="outlined"
          icon={<Iconify icon={linkIcon} />}
          onClick={() => {
            const accountType = localStorage.getItem('user_account_type');
            const path = accountType === 'business'
              ? '/account/company-settings/settings/mcp'
              : '/account/individual/settings/mcp';
            navigate(path);
          }}
          sx={{ cursor: 'pointer' }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title="AI can send emails and post to Slack for you">
      <Chip
        label="AI Actions Enabled"
        size="small"
        color="success"
        variant="outlined"
        icon={<Iconify icon={sparklesIcon} />}
      />
    </Tooltip>
  );
};

export default McpCapabilitiesPanel;