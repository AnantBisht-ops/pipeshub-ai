/**
 * Rate Limiter Middleware
 * Simple rate limiting middleware for API endpoints
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  max: number;
  windowMs: number;
}

const requests = new Map<string, number[]>();

export function rateLimitMiddleware(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Get existing requests for this IP
    const userRequests = requests.get(key) || [];

    // Filter out old requests outside the window
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (recentRequests.length >= options.max) {
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.'
      });
      return;
    }

    // Add current request
    recentRequests.push(now);
    requests.set(key, recentRequests);

    // Clean up old entries periodically
    if (Math.random() < 0.01) {
      for (const [ip, timestamps] of requests.entries()) {
        const filtered = timestamps.filter(t => t > windowStart);
        if (filtered.length === 0) {
          requests.delete(ip);
        } else {
          requests.set(ip, filtered);
        }
      }
    }

    next();
  };
}