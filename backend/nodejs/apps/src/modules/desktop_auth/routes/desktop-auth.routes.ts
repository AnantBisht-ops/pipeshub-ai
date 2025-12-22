import express from 'express';
import { Logger } from '../../../libs/services/logger.service';
import { AuthTokenService } from '../../../libs/services/authtoken.service';
import { DesktopAuthController } from '../controller/desktop-auth.controller';
import { signupRateLimit, signinRateLimit, refreshRateLimit } from '../middleware/desktop-rate-limit';

const router = express.Router();

// Initialize dependencies
const logger = new Logger({ service: 'DesktopAuthService' });
const authTokenService = new AuthTokenService(
  process.env.JWT_SECRET || 'your_jwt_secret_key',
  process.env.JWT_REFRESH_SECRET || 'your_jwt_refresh_secret_key'
);

const controller = new DesktopAuthController(logger, authTokenService);

/**
 * @route POST /api/v1/desktop/auth/signup
 * @desc Create new user account for desktop app
 * @access Public
 */
router.post('/signup',
  signupRateLimit,
  controller.signup.bind(controller)
);

/**
 * @route POST /api/v1/desktop/auth/signin
 * @desc Authenticate existing user for desktop app
 * @access Public
 */
router.post('/signin',
  signinRateLimit,
  controller.signin.bind(controller)
);

/**
 * @route POST /api/v1/desktop/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public (requires valid refresh token)
 */
router.post('/refresh',
  refreshRateLimit,
  controller.refreshToken.bind(controller)
);

export default router;
