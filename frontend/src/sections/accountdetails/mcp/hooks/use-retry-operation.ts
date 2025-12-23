/**
 * Retry Operation Hook
 *
 * Custom React hook for handling retry logic with exponential backoff
 * Used for OAuth connections and API operations
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { mcpErrorHandler, McpError } from '../utils/error-handler';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: McpError, attempt: number) => boolean;
  onRetryAttempt?: (attempt: number, nextDelay: number) => void;
}

export interface RetryState {
  isRetrying: boolean;
  attempt: number;
  lastError: McpError | null;
  nextRetryTime: Date | null;
}

/**
 * Custom hook for managing retry operations
 */
export function useRetryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry,
    onRetryAttempt,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    lastError: null,
    nextRetryTime: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Calculate delay with exponential backoff
  const calculateDelay = useCallback((attempt: number): number => {
    const delay = Math.min(
      initialDelay * backoffMultiplier ** (attempt - 1),
      maxDelay
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }, [initialDelay, backoffMultiplier, maxDelay]);

  // Execute operation with retry logic
  const executeWithRetry = useCallback(async (): Promise<T> => {
    // Reset abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    let currentAttempt = 1;
    let lastError: McpError | null = null;

    while (currentAttempt <= maxAttempts) {
      try {
        const attemptNumber = currentAttempt;
        setState(prev => ({
          ...prev,
          isRetrying: attemptNumber > 1,
          attempt: attemptNumber,
          lastError: null,
          nextRetryTime: null,
        }));

        // Execute the operation
        // eslint-disable-next-line no-await-in-loop
        const result = await operation();

        // Success - reset state
        setState({
          isRetrying: false,
          attempt: 0,
          lastError: null,
          nextRetryTime: null,
        });

        return result;
      } catch (error: any) {
        // Process error
        const mcpError = mcpErrorHandler.handleError(error, 'Retry operation');
        lastError = mcpError;

        setState(prev => ({
          ...prev,
          lastError: mcpError,
        }));

        // Check if we should retry
        const shouldRetryError = shouldRetry
          ? shouldRetry(mcpError, currentAttempt)
          : mcpError.retryable;

        if (!shouldRetryError || currentAttempt >= maxAttempts) {
          // No more retries
          setState(prev => ({
            ...prev,
            isRetrying: false,
            nextRetryTime: null,
          }));
          throw new Error(mcpError.message);
        }

        // Calculate next delay
        const delay = calculateDelay(currentAttempt);
        const nextRetryTime = new Date(Date.now() + delay);

        setState(prev => ({
          ...prev,
          nextRetryTime,
        }));

        // Notify about retry attempt
        if (onRetryAttempt) {
          onRetryAttempt(currentAttempt, delay);
        }

        console.log(`[Retry Hook] Attempt ${currentAttempt} failed, retrying in ${delay}ms`);

        // Wait before next attempt
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve, reject) => {
          timeoutRef.current = setTimeout(resolve, delay);

          // Allow cancellation during wait
          abortControllerRef.current?.signal.addEventListener('abort', () => {
            clearTimeout(timeoutRef.current);
            reject(new Error('Retry cancelled'));
          });
        });

        currentAttempt += 1;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(lastError?.toString() || 'Max retry attempts reached');
  }, [operation, maxAttempts, calculateDelay, shouldRetry, onRetryAttempt]);

  // Cancel ongoing retry
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      isRetrying: false,
      attempt: 0,
      lastError: null,
      nextRetryTime: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => () => cancel(), [cancel]);

  return {
    execute: executeWithRetry,
    cancel,
    state,
  };
}

/**
 * Hook for auto-retry on mount
 */
export function useAutoRetry<T>(
  operation: () => Promise<T>,
  dependencies: any[] = [],
  options: RetryOptions = {}
) {
  const [result, setResult] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<McpError | null>(null);

  const { execute, cancel, state } = useRetryOperation(operation, options);

  useEffect(() => {
    let mounted = true;

    const runOperation = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await execute();
        if (mounted) {
          setResult(data);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    runOperation();

    return () => {
      mounted = false;
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute, cancel, ...dependencies]);

  return {
    data: result,
    loading,
    error,
    retry: execute,
    retryState: state,
  };
}

/**
 * Hook for OAuth-specific retry logic
 */
export function useOAuthRetry(provider: string) {
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxOAuthAttempts = 2; // Fewer attempts for OAuth

  const shouldRetryOAuth = useCallback((error: McpError): boolean => {
    // Don't retry user cancellations
    if (error.type === 'OAUTH_CANCELLED') {
      return false;
    }

    // Don't retry permission denials
    if (error.type === 'OAUTH_PERMISSION_DENIED') {
      return false;
    }

    // Retry network issues and timeouts
    if (error.type === 'NETWORK_TIMEOUT' || error.type === 'NETWORK_OFFLINE') {
      return true;
    }

    // Retry invalid state errors (might be temporary)
    if (error.type === 'OAUTH_INVALID_STATE') {
      return connectionAttempts < maxOAuthAttempts;
    }

    return false;
  }, [connectionAttempts]);

  const handleOAuthRetry = useCallback(() => {
    setConnectionAttempts(prev => prev + 1);
  }, []);

  const resetAttempts = useCallback(() => {
    setConnectionAttempts(0);
  }, []);

  return {
    shouldRetryOAuth,
    handleOAuthRetry,
    resetAttempts,
    connectionAttempts,
    maxAttempts: maxOAuthAttempts,
  };
}