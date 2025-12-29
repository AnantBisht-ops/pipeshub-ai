import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  CircularProgress,
  Chip,
  Avatar,
  Stack,
  alpha,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useOrganizationContext } from 'src/context/OrganizationContext';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';

export const OrganizationSwitcher: React.FC = () => {
  const { organizations, currentOrg, isLoading, switchOrganization } = useOrganizationContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrg?._id) {
      handleClose();
      return;
    }

    setSwitching(true);
    try {
      await switchOrganization(orgId);
      // Reload the page to ensure all data is refreshed with new org context
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch organization:', error);
    } finally {
      setSwitching(false);
      handleClose();
    }
  };

  const handleCreateOrg = () => {
    handleClose();
    setCreateDialogOpen(true);
  };

  const getOrgInitial = (org: any) => {
    return org?.shortName?.[0] || org?.registeredName?.[0] || 'O';
  };

  if (isLoading && !currentOrg) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  // Debug: Log the organizations structure
  console.log('[DEBUG OrganizationSwitcher] organizations:', organizations);
  console.log('[DEBUG OrganizationSwitcher] currentOrg:', currentOrg);

  // Safe find with null checks - handle both nested and flat structure
  const currentOrgData = organizations.find((org) => {
    // Handle nested structure: { organization: {...}, role: ... }
    if (org?.organization?._id) {
      return org.organization._id === currentOrg?._id;
    }
    // Handle flat structure: { _id: ..., role: ... } (backwards compatibility)
    if ((org as any)?._id) {
      return (org as any)._id === currentOrg?._id;
    }
    return false;
  });

  return (
    <>
      <Button
        onClick={handleClick}
        startIcon={
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: currentOrg?.accountType === 'business' ? 'primary.main' : 'secondary.main',
              fontSize: 12,
            }}
          >
            {currentOrg?.accountType === 'business' ? (
              <BusinessIcon sx={{ fontSize: 16 }} />
            ) : (
              <PersonIcon sx={{ fontSize: 16 }} />
            )}
          </Avatar>
        }
        endIcon={<ExpandMoreIcon />}
        sx={{
          color: 'text.primary',
          textTransform: 'none',
          fontWeight: 500,
          px: 1.5,
          py: 0.75,
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          '&:hover': {
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
            borderColor: 'primary.main',
          }
        }}
      >
        <Box sx={{ textAlign: 'left' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {currentOrg?.shortName || currentOrg?.registeredName || 'Select Organization'}
          </Typography>
          {currentOrgData && (
            <Typography variant="caption" color="text.secondary">
              {(() => {
                const currentRole = currentOrgData.role || (currentOrgData as any)?.role;
                return currentRole === 'owner' ? 'Owner' :
                       currentRole === 'admin' ? 'Admin' : 'Member';
              })()}
            </Typography>
          )}
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 320,
            mt: 1,
            borderRadius: 2,
            boxShadow: (theme) => theme.shadows[8],
          }
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            ORGANIZATIONS
          </Typography>
        </Box>

        {organizations.map((orgData) => {
          // Handle both nested structure { organization: {...}, role: ... }
          // and flat structure { _id: ..., registeredName: ..., role: ... }
          const org = orgData.organization || orgData;
          const orgId = org._id || (orgData as any)?._id;
          const role = orgData.role || (orgData as any)?.role;
          const isSelected = orgId === currentOrg?._id;

          // Skip invalid entries
          if (!orgId) return null;

          return (
            <MenuItem
              key={orgId}
              onClick={() => handleSwitch(orgId)}
              selected={isSelected}
              disabled={switching}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                },
                '&.Mui-selected': {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
                  '&:hover': {
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.16),
                  }
                }
              }}
            >
              <ListItemIcon>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: org.accountType === 'business'
                      ? 'primary.lighter'
                      : 'secondary.lighter',
                    color: org.accountType === 'business'
                      ? 'primary.main'
                      : 'secondary.main',
                    fontSize: 14,
                  }}
                >
                  {org.accountType === 'business' ? (
                    <BusinessIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <PersonIcon sx={{ fontSize: 18 }} />
                  )}
                </Avatar>
              </ListItemIcon>

              <ListItemText
                primary={
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {org.shortName || org.registeredName}
                    </Typography>
                    {isSelected && (
                      <CheckIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    )}
                  </Stack>
                }
                secondary={
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                    <Chip
                      label={role}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 10,
                        textTransform: 'capitalize',
                        bgcolor: role === 'owner'
                          ? 'error.lighter'
                          : role === 'admin'
                            ? 'warning.lighter'
                            : 'default',
                        color: role === 'owner'
                          ? 'error.main'
                          : role === 'admin'
                            ? 'warning.main'
                            : 'text.secondary',
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {org.domain}
                    </Typography>
                  </Stack>
                }
              />
            </MenuItem>
          );
        })}

        <Divider sx={{ my: 1 }} />

        {/* Organization Actions */}
        <MenuItem
          onClick={() => {
            handleClose();
            // Navigate to organization settings
            window.location.href = `/dashboard/organization/settings`;
          }}
          sx={{
            mx: 1,
            borderRadius: 1,
          }}
        >
          <ListItemIcon>
            <SettingsIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Organization Settings" />
        </MenuItem>

        {/* Create New Organization - only show if user hasn't reached limit */}
        {organizations.length < 10 && (
          <MenuItem
            onClick={handleCreateOrg}
            sx={{
              mx: 1,
              borderRadius: 1,
              color: 'primary.main',
            }}
          >
            <ListItemIcon>
              <AddIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            </ListItemIcon>
            <ListItemText
              primary="Create Organization"
              primaryTypographyProps={{
                sx: { fontWeight: 500 }
              }}
            />
          </MenuItem>
        )}

        {organizations.length >= 10 && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Maximum organizations limit reached (10)
            </Typography>
          </Box>
        )}
      </Menu>

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </>
  );
};