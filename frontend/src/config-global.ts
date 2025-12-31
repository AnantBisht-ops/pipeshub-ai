import { paths } from 'src/routes/paths';

import packageJson from '../package.json';

// ----------------------------------------------------------------------

export type ConfigValue = {
  appName: string;
  appVersion: string;
  assetsDir: string;
  backendUrl: string;
  notificationBackendUrl: string;
  authUrl: string;
  iamUrl: string;
  auth: {
    method: 'jwt';
    skip: boolean;
    redirectPath: string;
  };
  aiBackend: string;
};

// ----------------------------------------------------------------------

// Helper to get the current origin for same-origin deployments
// In production, frontend is served by the backend, so we use the current origin
const getDefaultOrigin = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

export const CONFIG: ConfigValue = {
  appName: 'PipesHub',
  appVersion: packageJson.version,
  backendUrl: import.meta.env.VITE_BACKEND_URL || getDefaultOrigin(),
  notificationBackendUrl: import.meta.env.VITE_NOTIFICATION_BACKEND_URL || getDefaultOrigin(),
  authUrl: import.meta.env.VITE_AUTH_URL || getDefaultOrigin(),
  assetsDir: import.meta.env.VITE_ASSETS_DIR ?? '',
  iamUrl: import.meta.env.VITE_IAM_URL || getDefaultOrigin(),
  aiBackend: import.meta.env.VITE_AI_BACKEND || getDefaultOrigin(),
  /**
   * Auth
   * @method jwt
   */
  auth: {
    method: 'jwt',
    skip: false,
    redirectPath: paths.dashboard.root,
  },
};
