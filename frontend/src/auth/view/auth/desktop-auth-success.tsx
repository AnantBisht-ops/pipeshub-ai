import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import checkCircleIcon from '@iconify-icons/eva/checkmark-circle-2-fill';
import externalLinkIcon from '@iconify-icons/eva/external-link-fill';
import alertTriangleIcon from '@iconify-icons/eva/alert-triangle-fill';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export default function DesktopAuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isOpening, setIsOpening] = useState(false);
  const [openAttempted, setOpenAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTriggeredProtocol = useRef(false);

  // Get the callback URL from query parameters
  const callbackUrl = searchParams.get('callbackUrl');

  const handleOpenDesktopApp = useCallback(() => {
    if (!callbackUrl) {
      setError('Missing callback URL. Please try signing in again.');
      return;
    }

    setIsOpening(true);
    setOpenAttempted(true);

    // Decode the callback URL and redirect to it
    try {
      const decodedUrl = decodeURIComponent(callbackUrl);
      console.log('[Desktop Auth] Opening desktop app with URL:', decodedUrl);

      // Try to open the custom protocol URL
      window.location.href = decodedUrl;

      // After a delay, show a message in case the app didn't open
      setTimeout(() => {
        setIsOpening(false);
      }, 2000);
    } catch (err) {
      console.error('[Desktop Auth] Error opening desktop app:', err);
      setError('Failed to open the desktop app. Please try again.');
      setIsOpening(false);
    }
  }, [callbackUrl]);

  // Immediately trigger the protocol handler on mount to show browser's native "Open app?" dialog
  useEffect(() => {
    if (callbackUrl && !hasTriggeredProtocol.current) {
      hasTriggeredProtocol.current = true;

      try {
        const decodedUrl = decodeURIComponent(callbackUrl);
        console.log('[Desktop Auth] Triggering browser protocol dialog with URL:', decodedUrl);

        // Immediately trigger the protocol to show browser's native dialog
        window.location.href = decodedUrl;

        setOpenAttempted(true);

        // After a delay, update UI state
        setTimeout(() => {
          setIsOpening(false);
        }, 2000);
      } catch (err) {
        console.error('[Desktop Auth] Error triggering protocol:', err);
      }
    }
  }, [callbackUrl]);

  const handleGoToWebApp = () => {
    navigate('/');
  };

  if (!callbackUrl) {
    return (
      <Card
        sx={{
          width: '100%',
          maxWidth: 480,
          mx: 'auto',
          mt: 4,
          backdropFilter: 'blur(6px)',
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
          boxShadow: (theme) => `0 0 2px ${alpha(theme.palette.grey[500], 0.2)},
                              0 12px 24px -4px ${alpha(theme.palette.grey[500], 0.12)}`,
        }}
      >
        <CardContent sx={{ pt: 5, pb: 5, textAlign: 'center' }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              mx: 'auto',
              mb: 3,
              borderRadius: '50%',
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Iconify icon={alertTriangleIcon} width={40} sx={{ color: 'error.main' }} />
          </Box>

          <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
            Invalid Request
          </Typography>

          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            The authentication callback URL is missing. Please try signing in again from the desktop app.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            onClick={handleGoToWebApp}
            sx={{ minWidth: 200 }}
          >
            Go to Web App
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        width: '100%',
        maxWidth: 480,
        mx: 'auto',
        mt: 4,
        backdropFilter: 'blur(6px)',
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9),
        boxShadow: (theme) => `0 0 2px ${alpha(theme.palette.grey[500], 0.2)},
                            0 12px 24px -4px ${alpha(theme.palette.grey[500], 0.12)}`,
      }}
    >
      <CardContent sx={{ pt: 5, pb: 5, textAlign: 'center' }}>
        {/* Success Icon */}
        <Box
          sx={{
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 3,
            borderRadius: '50%',
            bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Iconify icon={checkCircleIcon} width={40} sx={{ color: 'success.main' }} />
        </Box>

        {/* Title */}
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
          Authentication Successful!
        </Typography>

        {/* Description */}
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          You have been successfully authenticated. Click the button below to open OpenAnalyst and complete the sign-in process.
        </Typography>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Open Desktop App Button */}
        <Button
          variant="contained"
          color="primary"
          size="large"
          fullWidth
          onClick={handleOpenDesktopApp}
          disabled={isOpening}
          startIcon={
            isOpening ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <Iconify icon={externalLinkIcon} width={20} />
            )
          }
          sx={{
            mb: 2,
            height: 48,
            borderRadius: 1.5,
            fontWeight: 600,
          }}
        >
          {isOpening ? 'Opening OpenAnalyst...' : 'Open OpenAnalyst'}
        </Button>

        {/* Help Text */}
        {openAttempted && !isOpening && (
          <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              App didn&apos;t open?
            </Typography>
            <Typography variant="body2">
              Make sure OpenAnalyst is installed on your computer. If the app is installed but didn&apos;t open, try clicking the button above again.
            </Typography>
          </Alert>
        )}

        {/* Secondary Action */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Want to use the web app instead?{' '}
            <Button
              variant="text"
              color="primary"
              onClick={handleGoToWebApp}
              sx={{ textTransform: 'none', fontWeight: 600, p: 0, minWidth: 'auto' }}
            >
              Continue to Web App
            </Button>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export { DesktopAuthSuccess };
