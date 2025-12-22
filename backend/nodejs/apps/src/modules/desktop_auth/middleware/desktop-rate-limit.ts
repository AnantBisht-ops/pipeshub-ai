import rateLimit from 'express-rate-limit';

/**
 * Rate limiting for desktop auth endpoints
 */

// Signup: 5 requests per hour per IP
export const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many signup attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Signin: 5 requests per 15 minutes per IP
export const signinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many signin attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Refresh: 10 requests per minute per IP
export const refreshRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many refresh requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
