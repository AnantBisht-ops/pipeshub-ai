import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  Stack,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Person as PersonIcon,
  Groups as GroupsIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';

interface Organization {
  _id: string;
  slug: string;
  registeredName?: string;
  shortName?: string;
  domain: string;
  contactEmail: string;
  accountType: 'individual' | 'business';
  subscription?: {
    plan: string;
  };
}

interface UserOrganization {
  organization: Organization;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}

interface OrganizationSelectorProps {
  open: boolean;
  organizations: UserOrganization[];
  onSelect: (orgId: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({
  open,
  organizations,
  onSelect,
  isLoading = false,
  error = null,
}) => {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);

  const handleSelectOrganization = async (orgId: string) => {
    setSelectedOrgId(orgId);
    setSelecting(true);
    try {
      await onSelect(orgId);
      // Navigation will be handled by the parent component
    } catch (err) {
      console.error('Failed to select organization:', err);
      setSelecting(false);
      setSelectedOrgId(null);
    }
  };

  const getPlanColor = (plan?: string) => {
    switch (plan) {
      case 'enterprise':
        return 'error';
      case 'pro':
        return 'primary';
      case 'starter':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'error';
      case 'admin':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Select Your Organization
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Your account has access to multiple organizations. Please select one to continue.
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <List sx={{ pt: 0 }}>
              {organizations.map((orgData) => {
                // Handle both nested { organization: {...}, role: ... } and flat structures
                const org = orgData?.organization || orgData;
                const orgId = org?._id || (orgData as any)?._id;
                const role = orgData?.role || (orgData as any)?.role;

                // Skip invalid entries
                if (!orgId || !org) return null;

                const isSelected = selectedOrgId === orgId;

                return (
                  <ListItem
                    key={orgId}
                    disablePadding
                    sx={{ mb: 1.5 }}
                  >
                    <ListItemButton
                      onClick={() => handleSelectOrganization(orgId)}
                      disabled={selecting}
                      selected={isSelected}
                      sx={{
                        border: 2,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        borderRadius: 2,
                        py: 2,
                        px: 2,
                        bgcolor: isSelected ? 'action.selected' : 'background.paper',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'action.hover',
                        },
                        '&.Mui-selected': {
                          bgcolor: 'action.selected',
                          '&:hover': {
                            bgcolor: 'action.selected',
                          }
                        },
                        position: 'relative',
                      }}
                    >
                      {isSelected && (
                        <CheckCircleIcon
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            color: 'primary.main',
                            fontSize: 20,
                          }}
                        />
                      )}

                      <ListItemIcon>
                        <Avatar
                          sx={{
                            width: 48,
                            height: 48,
                            bgcolor: org.accountType === 'business'
                              ? 'primary.lighter'
                              : 'secondary.lighter',
                            color: org.accountType === 'business'
                              ? 'primary.main'
                              : 'secondary.main',
                          }}
                        >
                          {org.accountType === 'business' ? (
                            <BusinessIcon />
                          ) : (
                            <PersonIcon />
                          )}
                        </Avatar>
                      </ListItemIcon>

                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                            {org.shortName || org.registeredName}
                          </Typography>
                        }
                        secondary={
                          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {org.domain}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip
                                label={role}
                                size="small"
                                color={getRoleColor(role) as any}
                                sx={{
                                  height: 20,
                                  fontSize: 11,
                                  textTransform: 'capitalize',
                                }}
                              />
                              {org.subscription && (
                                <Chip
                                  label={org.subscription.plan}
                                  size="small"
                                  variant="outlined"
                                  color={getPlanColor(org.subscription.plan) as any}
                                  sx={{
                                    height: 20,
                                    fontSize: 11,
                                    textTransform: 'capitalize',
                                  }}
                                />
                              )}
                              {org.contactEmail && (
                                <Typography variant="caption" color="text.secondary">
                                  <GroupsIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                  {org.contactEmail.split('@')[1]}
                                </Typography>
                              )}
                            </Stack>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>

            {organizations.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No organizations found. Please contact your administrator.
                </Typography>
              </Box>
            )}

            {selecting && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <LoadingButton
                  loading
                  loadingPosition="start"
                  variant="text"
                  disabled
                >
                  Logging in to organization...
                </LoadingButton>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};