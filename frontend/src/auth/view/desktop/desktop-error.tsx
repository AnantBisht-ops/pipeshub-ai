/**
 * Desktop Authentication Error Page
 *
 * Based on LibreChat Phase 3 ExtensionError component
 * Displays error messages and provides recovery options
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Alert, List, ListItem, ListItemText, alpha } from '@mui/material';
import { DesktopIntegration } from 'src/utils/desktop-integration';

export default function DesktopError() {
  const location = useLocation();
  const navigate = useNavigate();

  const error = location.state?.error || 'Authentication failed. Please try again.';
  const errorType = location.state?.errorType || 'general';

  const handleRetry = () => {
    // Preserve source parameter when retrying
    navigate(`/?source=${DesktopIntegration.AUTH_SOURCES.EXTENSION}`);
  };

  const handleContactSupport = () => {
    window.open('mailto:support@pipeshub.com?subject=Desktop Authentication Error', '_blank');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 3,
      }}
    >
      <Box
        sx={{
          bgcolor: 'white',
          borderRadius: 4,
          p: 6,
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: 500,
          width: '100%',
        }}
      >
        {/* Error Icon */}
        <Box
          sx={{
            width: 64,
            height: 64,
            margin: '0 auto 24px',
            bgcolor: '#ef4444',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            color: 'white',
          }}
        >
          ✕
        </Box>

        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: '#dc2626' }}>
          Authentication Failed
        </Typography>

        {/* Error Message */}
        <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="body2">{error}</Typography>
        </Alert>

        {/* Troubleshooting Steps */}
        <Box
          sx={{
            mb: 4,
            p: 3,
            bgcolor: (theme1) => alpha(theme1.palette.grey[100], 0.5),
            borderRadius: 2,
            textAlign: 'left',
          }}
        >
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Troubleshooting Steps:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="1. Check your internet connection"
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Verify your credentials are correct"
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Ensure PipesHub desktop app is installed"
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="4. Try closing and reopening the desktop app"
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItem>
          </List>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleRetry}
            fullWidth
            sx={{
              py: 1.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Try Again
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={handleContactSupport}
            fullWidth
            sx={{
              py: 1.5,
              borderColor: '#667eea',
              color: '#667eea',
              '&:hover': {
                borderColor: '#5568d3',
                bgcolor: (theme1) => alpha('#667eea', 0.08),
              },
            }}
          >
            Contact Support
          </Button>
        </Box>

        {/* Help Text */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
          If this problem persists, please contact our support team at support@pipeshub.com
        </Typography>
      </Box>
    </Box>
  );
}
