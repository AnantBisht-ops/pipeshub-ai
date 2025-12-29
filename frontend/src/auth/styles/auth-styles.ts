import type { Theme } from '@mui/material/styles';

import googleIcon from '@iconify-icons/mdi/google';
import microsoftIcon from '@iconify-icons/mdi/microsoft';
import shieldAccountIcon from '@iconify-icons/mdi/shield-account';
// Import specific Iconify icons
import passwordIcon from '@iconify-icons/mdi/form-textbox-password';
import phoneMessageIcon from '@iconify-icons/mdi/cellphone-message';
import microsoftAzureIcon from '@iconify-icons/mdi/microsoft-azure';

import { alpha } from '@mui/material/styles';

import type { StyleConfig } from '../types/auth';

export const CARD_STYLES = {
  width: '100%',
  maxWidth: 480,
  mx: 'auto',
  mt: 4,
  backdropFilter: 'blur(10px)',
  bgcolor: (theme: Theme) => alpha('#2a2a2a', 0.95), // Slightly lighter than background for contrast
  boxShadow: (theme: Theme) => `0 0 30px ${alpha('#000000', 0.5)},
                                 0 12px 40px -4px ${alpha('#000000', 0.3)}`,
  borderRadius: 3,
  border: '1px solid',
  borderColor: (theme: Theme) => alpha('#ffffff', 0.1), // Subtle white border
  // Enhanced text styling with glow effect for OpenAnalyst
  '& .MuiTypography-root': {
    color: '#ffffff',
    textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
  },
  '& .MuiInputBase-root': {
    color: '#ffffff',
    '& fieldset': {
      borderColor: (theme: Theme) => alpha('#ffffff', 0.2),
    },
    '&:hover fieldset': {
      borderColor: (theme: Theme) => alpha('#ffffff', 0.3),
    },
    '&.Mui-focused fieldset': {
      borderColor: 'primary.main',
    },
  },
  '& .MuiInputLabel-root': {
    color: (theme: Theme) => alpha('#ffffff', 0.7),
  },
};

export const TAB_STYLES = {
  mb: 4,
  '& .MuiTab-root': {
    minHeight: 48,
    textTransform: 'none',
    flexDirection: 'row',
    fontWeight: 600,
    color: (theme: Theme) => alpha('#ffffff', 0.6), // Bright white with transparency for unselected
    borderRadius: '8px 8px 0 0',
    transition: 'all 0.2s ease-in-out',
    textShadow: '0 0 10px rgba(255, 255, 255, 0.2)', // Subtle glow for tabs
    '&.Mui-selected': {
      color: '#ffffff', // Bright white for selected tab
      bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.15),
      textShadow: '0 0 20px rgba(255, 255, 255, 0.4)', // Enhanced glow for selected
    },
    '& .MuiTab-iconWrapper': {
      mr: 1,
      transition: 'transform 0.2s ease-in-out',
    },
    '&:hover': {
      bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.08),
      color: (theme: Theme) => alpha('#ffffff', 0.9),
      '& .MuiTab-iconWrapper': {
        transform: 'scale(1.1)',
      },
    },
  },
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
    bgcolor: 'primary.main',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: (theme: Theme) => `0 0 10px ${theme.palette.primary.main}`, // Glow effect for indicator
  },
} as StyleConfig;

export const METHOD_CONFIGS = {
  tabConfig: {
    password: {
      icon: passwordIcon,
      label: 'Password',
      component: 'PasswordSignIn',
    },
    otp: {
      icon: phoneMessageIcon,
      label: 'OTP',
      component: 'OtpSignIn',
    },
    samlSso: {
      icon: shieldAccountIcon,
      label: 'SSO',
      component: 'SamlSignIn',
    },
  },
  socialConfig: {
    google: {
      icon: googleIcon,
      label: 'Continue with Google',
      color: '#DB4437',
    },
    microsoft: {
      icon: microsoftIcon,
      label: 'Continue with Microsoft',
      color: '#00A4EF',
    },
    azureAd: {
      icon: microsoftAzureIcon,
      label: 'Continue with Azure AD',
      color: '#0078D4',
    },
  },
};
