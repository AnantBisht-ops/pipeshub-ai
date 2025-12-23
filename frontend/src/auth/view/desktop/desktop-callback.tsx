/**
 * Desktop Authentication Callback Page
 *
 * Based on LibreChat Phase 3 ExtensionCallback component
 * Shown after successful desktop authentication
 * Handles token delivery to desktop app via protocol URL
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, Button, alpha } from '@mui/material';
import { DesktopIntegration } from 'src/utils/desktop-integration';

export default function DesktopCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(3);

  // Get token from location state or URL parameters
  const token = location.state?.token || searchParams.get('token');
  const userId = location.state?.userId || searchParams.get('userId');
  const isNewUser = location.state?.isNewUser || false;

  useEffect(() => {
    // Redirect to error if no token
    if (!token) {
      navigate('/auth/desktop/error', {
        state: { error: 'No authentication token received' },
      });
      return;
    }

    // Generate desktop callback URL
    const callbackUrl = DesktopIntegration.CallbackGenerator.generateDesktopCallback(
      token,
      userId
    );

    console.log('🖥️ Desktop callback URL generated:', callbackUrl);

    // Countdown timer before auto-redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Auto-redirect to desktop app
          console.log('🚀 Redirecting to desktop app:', callbackUrl);
          window.location.href = callbackUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [token, userId, navigate]);

  const handleManualOpen = () => {
    const callbackUrl = DesktopIntegration.CallbackGenerator.generateDesktopCallback(
      token,
      userId
    );
    console.log('👆 Manual desktop app open:', callbackUrl);
    window.location.href = callbackUrl;
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
          maxWidth: 480,
          width: '100%',
        }}
      >
        {/* PipesHub Logo */}
        <Box
          sx={{
            width: 80,
            height: 80,
            margin: '0 auto 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            fontWeight: 'bold',
            color: 'white',
          }}
        >
          PH
        </Box>

        {/* Success Icon */}
        <Box
          sx={{
            width: 64,
            height: 64,
            margin: '0 auto 24px',
            bgcolor: '#10b981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            color: 'white',
          }}
        >
          ✓
        </Box>

        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: '#1a202c' }}>
          Authentication Successful!
        </Typography>

        {isNewUser && (
          <Typography variant="body2" color="primary" sx={{ mb: 2 }}>
            Welcome! Your account has been created.
          </Typography>
        )}

        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
          Opening PipesHub Desktop Application in <strong>{countdown}</strong> seconds...
        </Typography>

        <Button
          variant="contained"
          size="large"
          onClick={handleManualOpen}
          fullWidth
          sx={{
            py: 2,
            fontSize: '18px',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #65408f 100%)',
              boxShadow: '0 8px 20px rgba(102, 126, 234, 0.4)',
              transform: 'translateY(-2px)',
            },
            transition: 'all 0.2s',
          }}
        >
          Open PipesHub Desktop Now
        </Button>

        <Box
          sx={{
            mt: 4,
            p: 3,
            bgcolor: (theme1) => alpha(theme1.palette.grey[100], 0.8),
            borderRadius: 2,
            borderLeft: '4px solid #667eea',
          }}
        >
          <Typography variant="body2" fontWeight={600} gutterBottom color="text.primary">
            📱 Desktop App Required
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
            Make sure you have the PipesHub desktop application installed on your computer.
            If the app doesn't open automatically, click the button above.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
