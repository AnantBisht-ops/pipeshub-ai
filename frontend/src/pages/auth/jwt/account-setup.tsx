import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import buildingIcon from '@iconify-icons/mdi/domain';
import personIcon from '@iconify-icons/mdi/account-outline';

import {
  Box,
  Card,
  Stack,
  alpha,
  Dialog,
  useTheme,
  Typography,
  DialogTitle,
  CardContent,
  DialogContent,
  useMediaQuery,
} from '@mui/material';

import { OrgExists } from 'src/auth/context/jwt';
import AccountSetUpForm from 'src/auth/view/auth/account-setup';

// Account type interface
export type AccountType = 'individual' | 'business';

// ----------------------------------------------------------------------

const metadata = { title: 'Account Setup' };

export default function Page() {
  const [open, setOpen] = useState(true);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDarkMode = theme.palette.mode === 'dark';
  
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning',
  });

  // Show dialog on first load
  useEffect(() => {
    setOpen(true);
  }, []);

  const handleClose = () => {
    // Don't allow closing without selection
  };

  const handleAccountTypeSelect = (type: AccountType) => {
    setAccountType(type);
    setOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>{metadata.title}</title>
      </Helmet>

      {/* Account Type Selection Dialog */}
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        BackdropProps={{
          sx: {
            bgcolor: '#1a1a1a', // Dark charcoal background
          }
        }}
        PaperProps={{
          sx: {
            borderRadius: 1,
            bgcolor: '#2a2a2a', // Dark charcoal grey for OpenAnalyst
            boxShadow: `0 0 30px ${alpha('#000000', 0.5)}, 0 12px 40px -4px ${alpha('#000000', 0.3)}`,
            border: `1px solid ${alpha('#ffffff', 0.1)}`,
          }
        }}
      >
        <DialogTitle
          sx={{
            textAlign: 'center',
            pt: 4,
            pb: 2,
            bgcolor: 'transparent',
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              mb: 1,
              color: '#ffffff', // Bright white for OpenAnalyst
              textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
            }}
          >
            Choose Account Type
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: alpha('#ffffff', 0.7),
            }}
          >
            Select the type of account you want to create
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pb: 4, bgcolor: 'transparent' }}>
          <Stack
            spacing={2}
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ mt: 1 }}
          >
            <Card
              sx={{
                flex: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderRadius: 1,
                bgcolor: alpha('#1a1a1a', 0.6), // Dark background for OpenAnalyst
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.15),
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: `0 4px 16px 0 ${alpha(theme.palette.primary.main, 0.25)}`,
                  bgcolor: alpha('#1a1a1a', 0.8),
                },
              }}
              onClick={() => handleAccountTypeSelect('individual')}
              elevation={0}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  p: 3,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04),
                    mb: 2,
                  }}
                >
                  <Icon 
                    icon={personIcon}
                    width={24}
                    height={24}
                    color={theme.palette.primary.main} 
                  />
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    color: '#ffffff', // Bright white for OpenAnalyst
                  }}
                >
                  Individual
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: alpha('#ffffff', 0.6),
                  }}
                >
                  For personal use or freelancers
                </Typography>
              </CardContent>
            </Card>

            <Card
              sx={{
                flex: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderRadius: 1,
                bgcolor: alpha('#1a1a1a', 0.6), // Dark background for OpenAnalyst
                border: '1px solid',
                borderColor: alpha('#ffffff', 0.15),
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: `0 4px 16px 0 ${alpha(theme.palette.primary.main, 0.25)}`,
                  bgcolor: alpha('#1a1a1a', 0.8),
                },
              }}
              onClick={() => handleAccountTypeSelect('business')}
              elevation={0}
            >
              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  p: 3,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04),
                    mb: 2,
                  }}
                >
                  <Icon 
                    icon={buildingIcon}
                    width={24}
                    height={24}
                    color={theme.palette.primary.main} 
                  />
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    color: '#ffffff', // Bright white for OpenAnalyst
                  }}
                >
                  Organization
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: alpha('#ffffff', 0.6),
                  }}
                >
                  For companies and teams
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Render the AccountSetUpForm only after account type is selected */}
      {accountType && <AccountSetUpForm accountType={accountType} />}
    </>
  );
}