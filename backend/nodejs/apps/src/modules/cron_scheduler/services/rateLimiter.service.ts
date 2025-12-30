/**
 * Rate Limiter Service
 * Manages API rate limiting with exponential backoff
 * Risk Mitigation: API Rate Limits - Prevents overwhelming target APIs
 */

import { injectable } from 'inversify';
import { CronSchedulerConfig } from '../config/cronScheduler.config';
import { IRateLimitConfig } from '../types/cronScheduler.types';
import { CRON_CONSTANTS } from '../constants/cronScheduler.constants';

/**
 * Rate limit state for each API
 */
interface RateLimitState {
  requests: number[];        // Timestamps of recent requests
  currentBackoff: number;    // Current backoff delay in ms
  backoffUntil: number | null; // Timestamp when backoff ends
  consecutiveHits: number;   // Number of consecutive rate limit hits
  lastResetTime: number;     // Last time the rate limit was reset
}

/**
 * Rate limit info extracted from response headers
 */
interface RateLimitInfo {
  remaining: number | null;
  reset: number | null;
  retryAfter: number | null;
  limit: number | null;
}

@injectable()
export class RateLimiterService {
  private rateLimitTrackers: Map<string, RateLimitState> = new Map();
  private apiDomainCache: Map<string, string> = new Map();

  constructor() {
    // Start cleanup interval to remove old request timestamps
    this.startCleanupInterval();
  }

  /**
   * Check if a request can be made to the target API
   * Returns true if request is allowed, false if rate limited
   */
  public async canMakeRequest(
    targetApi: string,
    config: IRateLimitConfig
  ): Promise<boolean> {
    const domain = this.extractDomain(targetApi);
    const tracker = this.getOrCreateTracker(domain);
    const now = Date.now();

    // Check if currently in backoff period
    if (tracker.backoffUntil && tracker.backoffUntil > now) {
      console.log(`[RateLimiter] API ${domain} is in backoff until ${new Date(tracker.backoffUntil).toISOString()}`);
      return false;
    }

    // Clean old requests (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    tracker.requests = tracker.requests.filter(timestamp => timestamp > oneMinuteAgo);

    // Get rate limit for this specific API
    const maxRequests = this.getApiRateLimit(domain, config);

    // Check if we've exceeded the rate limit
    if (tracker.requests.length >= maxRequests) {
      console.log(`[RateLimiter] API ${domain} has reached rate limit: ${tracker.requests.length}/${maxRequests} requests`);

      // Apply exponential backoff
      this.applyBackoff(tracker, config);
      return false;
    }

    // Request is allowed
    return true;
  }

  /**
   * Record a request and update rate limit state from response headers
   */
  public recordRequest(
    targetApi: string,
    responseHeaders: Record<string, string | string[] | undefined>
  ): void {
    const domain = this.extractDomain(targetApi);
    const tracker = this.getOrCreateTracker(domain);
    const now = Date.now();

    // Record the request timestamp
    tracker.requests.push(now);

    // Parse rate limit headers from the response
    const rateLimitInfo = this.parseRateLimitHeaders(responseHeaders);

    // Update tracker based on rate limit headers
    if (rateLimitInfo.remaining !== null) {
      console.log(`[RateLimiter] API ${domain} - Remaining requests: ${rateLimitInfo.remaining}`);

      if (rateLimitInfo.remaining === 0) {
        // We hit the rate limit
        tracker.consecutiveHits++;

        if (rateLimitInfo.retryAfter !== null) {
          // Use retry-after header if provided
          tracker.backoffUntil = now + (rateLimitInfo.retryAfter * 1000);
          console.log(`[RateLimiter] API ${domain} - Retry after ${rateLimitInfo.retryAfter} seconds`);
        } else if (rateLimitInfo.reset !== null) {
          // Use reset time if provided
          tracker.backoffUntil = rateLimitInfo.reset * 1000; // Convert to milliseconds
          console.log(`[RateLimiter] API ${domain} - Reset at ${new Date(tracker.backoffUntil).toISOString()}`);
        } else {
          // Apply exponential backoff
          tracker.backoffUntil = now + tracker.currentBackoff;
          tracker.currentBackoff = Math.min(
            tracker.currentBackoff * 2,
            CronSchedulerConfig.rateLimiting.maxBackoff
          );
          console.log(`[RateLimiter] API ${domain} - Applying backoff: ${tracker.currentBackoff}ms`);
        }
      } else {
        // Reset consecutive hits and backoff on successful request
        tracker.consecutiveHits = 0;
        tracker.currentBackoff = CronSchedulerConfig.rateLimiting.minBackoff || CRON_CONSTANTS.DEFAULTS.RETRY_DELAY;
      }
    }

    // Update reset time if provided
    if (rateLimitInfo.reset !== null) {
      tracker.lastResetTime = rateLimitInfo.reset * 1000;
    }
  }

  /**
   * Record a rate limit error (429 response)
   */
  public recordRateLimitError(
    targetApi: string,
    retryAfter?: number,
    resetTime?: number
  ): void {
    const domain = this.extractDomain(targetApi);
    const tracker = this.getOrCreateTracker(domain);
    const now = Date.now();

    tracker.consecutiveHits++;

    if (retryAfter) {
      tracker.backoffUntil = now + (retryAfter * 1000);
    } else if (resetTime) {
      tracker.backoffUntil = resetTime * 1000;
    } else {
      // Apply exponential backoff with increased multiplier for consecutive hits
      const multiplier = Math.pow(CronSchedulerConfig.rateLimiting.backoffMultiplier, tracker.consecutiveHits);
      tracker.currentBackoff = Math.min(
        tracker.currentBackoff * multiplier,
        CronSchedulerConfig.rateLimiting.maxBackoff
      );
      tracker.backoffUntil = now + tracker.currentBackoff;
    }

    console.log(`[RateLimiter] Rate limit error for ${domain}. Backoff until: ${new Date(tracker.backoffUntil).toISOString()}`);
  }

  /**
   * Get the current backoff time for an API
   */
  public getBackoffTime(targetApi: string): number | null {
    const domain = this.extractDomain(targetApi);
    const tracker = this.rateLimitTrackers.get(domain);

    if (!tracker || !tracker.backoffUntil) {
      return null;
    }

    const remaining = tracker.backoffUntil - Date.now();
    return remaining > 0 ? remaining : null;
  }

  /**
   * Reset rate limit tracking for an API
   */
  public resetRateLimit(targetApi: string): void {
    const domain = this.extractDomain(targetApi);
    const tracker = this.getOrCreateTracker(domain);

    tracker.requests = [];
    tracker.currentBackoff = CronSchedulerConfig.rateLimiting.minBackoff || CRON_CONSTANTS.DEFAULTS.RETRY_DELAY;
    tracker.backoffUntil = null;
    tracker.consecutiveHits = 0;

    console.log(`[RateLimiter] Reset rate limit tracking for ${domain}`);
  }

  /**
   * Get statistics for an API
   */
  public getApiStatistics(targetApi: string): {
    requestsInLastMinute: number;
    isInBackoff: boolean;
    backoffRemaining: number | null;
    consecutiveHits: number;
  } {
    const domain = this.extractDomain(targetApi);
    const tracker = this.rateLimitTrackers.get(domain);

    if (!tracker) {
      return {
        requestsInLastMinute: 0,
        isInBackoff: false,
        backoffRemaining: null,
        consecutiveHits: 0
      };
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = tracker.requests.filter(t => t > oneMinuteAgo);

    return {
      requestsInLastMinute: recentRequests.length,
      isInBackoff: tracker.backoffUntil !== null && tracker.backoffUntil > now,
      backoffRemaining: tracker.backoffUntil && tracker.backoffUntil > now ?
        tracker.backoffUntil - now : null,
      consecutiveHits: tracker.consecutiveHits
    };
  }

  /**
   * Parse rate limit headers from response
   */
  private parseRateLimitHeaders(headers: Record<string, string | string[] | undefined>): RateLimitInfo {
    const info: RateLimitInfo = {
      remaining: null,
      reset: null,
      retryAfter: null,
      limit: null
    };

    // Normalize headers to lowercase for consistent checking
    const normalizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value) {
        const headerValue = Array.isArray(value) ? value[0] : value;
        if (headerValue) {
          normalizedHeaders[key.toLowerCase()] = headerValue;
        }
      }
    }

    // Check for rate limit remaining
    const remainingHeaders = CronSchedulerConfig.rateLimiting.rateLimitHeaders.remaining;
    for (const header of remainingHeaders) {
      const value = normalizedHeaders[header.toLowerCase()];
      if (value) {
        info.remaining = parseInt(value, 10);
        break;
      }
    }

    // Check for reset time
    const resetHeaders = CronSchedulerConfig.rateLimiting.rateLimitHeaders.reset;
    for (const header of resetHeaders) {
      const value = normalizedHeaders[header.toLowerCase()];
      if (value) {
        info.reset = parseInt(value, 10);
        break;
      }
    }

    // Check for retry-after
    const retryAfterHeaders = CronSchedulerConfig.rateLimiting.rateLimitHeaders.retryAfter;
    for (const header of retryAfterHeaders) {
      const value = normalizedHeaders[header.toLowerCase()];
      if (value) {
        info.retryAfter = parseInt(value, 10);
        break;
      }
    }

    // Check for rate limit
    const limitValue = normalizedHeaders['x-ratelimit-limit'] || normalizedHeaders['x-rate-limit-limit'];
    if (limitValue) {
      info.limit = parseInt(limitValue, 10);
    }

    return info;
  }

  /**
   * Extract domain from URL for tracking
   */
  private extractDomain(url: string): string {
    // Check cache first
    if (this.apiDomainCache.has(url)) {
      return this.apiDomainCache.get(url)!;
    }

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Cache the result
      this.apiDomainCache.set(url, domain);

      // Limit cache size
      if (this.apiDomainCache.size > 1000) {
        const firstKey = this.apiDomainCache.keys().next().value;
        if (firstKey !== undefined) {
          this.apiDomainCache.delete(firstKey);
        }
      }

      return domain;
    } catch {
      // If URL parsing fails, use the full URL as domain
      return url;
    }
  }

  /**
   * Get or create a tracker for a domain
   */
  private getOrCreateTracker(domain: string): RateLimitState {
    if (!this.rateLimitTrackers.has(domain)) {
      this.rateLimitTrackers.set(domain, {
        requests: [],
        currentBackoff: CronSchedulerConfig.rateLimiting.minBackoff || CRON_CONSTANTS.DEFAULTS.RETRY_DELAY,
        backoffUntil: null,
        consecutiveHits: 0,
        lastResetTime: Date.now()
      });
    }

    return this.rateLimitTrackers.get(domain)!;
  }

  /**
   * Apply exponential backoff to a tracker
   */
  private applyBackoff(tracker: RateLimitState, config: IRateLimitConfig): void {
    const now = Date.now();

    // Increase consecutive hits
    tracker.consecutiveHits++;

    // Calculate backoff with exponential increase
    const backoffMultiplier = config.backoffMultiplier || CronSchedulerConfig.rateLimiting.backoffMultiplier;
    tracker.currentBackoff = Math.min(
      tracker.currentBackoff * backoffMultiplier,
      config.maxBackoff || CronSchedulerConfig.rateLimiting.maxBackoff
    );

    // Set backoff until time
    tracker.backoffUntil = now + tracker.currentBackoff;

    console.log(`[RateLimiter] Applying backoff: ${tracker.currentBackoff}ms (consecutive hits: ${tracker.consecutiveHits})`);
  }

  /**
   * Get API-specific rate limit
   */
  private getApiRateLimit(domain: string, config: IRateLimitConfig): number {
    // Check for API-specific overrides
    const apiOverrides = CronSchedulerConfig.rateLimiting.apiOverrides || {};

    // Type-safe access to the apiOverrides object using Object.prototype.hasOwnProperty
    if (Object.prototype.hasOwnProperty.call(apiOverrides, domain)) {
      const override = (apiOverrides as any)[domain];
      if (override && typeof override.maxRequestsPerMinute === 'number') {
        return override.maxRequestsPerMinute;
      }
    }

    // Use config value or default
    return config.maxRequestsPerMinute || CronSchedulerConfig.rateLimiting.defaultMaxRequestsPerMinute;
  }

  /**
   * Start cleanup interval to remove old request timestamps
   */
  private startCleanupInterval(): void {
    // Clean up old request timestamps every minute
    setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;

      for (const [domain, tracker] of this.rateLimitTrackers.entries()) {
        // Remove old request timestamps
        tracker.requests = tracker.requests.filter(t => t > oneMinuteAgo);

        // Remove tracker if it's been inactive for 10 minutes
        if (tracker.requests.length === 0 &&
            (!tracker.backoffUntil || tracker.backoffUntil < now) &&
            tracker.lastResetTime < now - 600000) {
          this.rateLimitTrackers.delete(domain);
          console.log(`[RateLimiter] Removed inactive tracker for ${domain}`);
        }
      }

      // Clean up domain cache if it's too large
      if (this.apiDomainCache.size > 1000) {
        this.apiDomainCache.clear();
        console.log('[RateLimiter] Cleared domain cache');
      }
    }, 60000); // Run every minute
  }

  /**
   * Get all tracked APIs and their states
   */
  public getAllTrackedApis(): Array<{
    domain: string;
    state: RateLimitState;
  }> {
    const apis: Array<{ domain: string; state: RateLimitState }> = [];

    for (const [domain, state] of this.rateLimitTrackers.entries()) {
      apis.push({ domain, state });
    }

    return apis;
  }

  /**
   * Clear all rate limit tracking
   */
  public clearAll(): void {
    this.rateLimitTrackers.clear();
    this.apiDomainCache.clear();
    console.log('[RateLimiter] Cleared all rate limit tracking');
  }
}