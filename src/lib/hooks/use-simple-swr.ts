"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Simple SWR-like hook as alternative until SWR is installed
interface SWRConfig {
  revalidateOnFocus?: boolean;
  dedupingInterval?: number;
  errorRetryCount?: number;
  errorRetryInterval?: number;
  refreshInterval?: number;
}

interface SWRReturn<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: () => Promise<void>;
}

const cache = new Map<string, { data: any; timestamp: number; promise?: Promise<any> }>();

export function useSWR<T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  config: SWRConfig = {}
): SWRReturn<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const retryCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    revalidateOnFocus = false,
    dedupingInterval = 2000,
    errorRetryCount = 3,
    errorRetryInterval = 1000,
    refreshInterval,
  } = config;

  const fetchData = useCallback(async (): Promise<void> => {
    if (!key || !fetcher) {
      setData(undefined);
      setError(undefined);
      setIsLoading(false);
      return;
    }

    const now = Date.now();
    const cached = cache.get(key);

    // Return cached data if within deduping interval
    if (cached && now - cached.timestamp < dedupingInterval) {
      if (cached.promise) {
        // If there's an ongoing request, wait for it
        try {
          const result = await cached.promise;
          setData(result);
          setError(undefined);
        } catch (err) {
          setError(err as Error);
        }
      } else {
        setData(cached.data);
        setError(undefined);
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      // Create promise and cache it to prevent duplicate requests
      const promise = fetcher();
      cache.set(key, { data: cached?.data, timestamp: now, promise });

      const result = await promise;

      // Update cache with result
      cache.set(key, { data: result, timestamp: now });

      setData(result);
      setError(undefined);
      retryCountRef.current = 0;
    } catch (err) {
      const error = err as Error;
      setError(error);

      // Retry logic
      if (retryCountRef.current < errorRetryCount) {
        retryCountRef.current += 1;
        setTimeout(() => {
          fetchData();
        }, errorRetryInterval * retryCountRef.current);
      }

      // Remove failed promise from cache
      const cached = cache.get(key);
      if (cached) {
        cache.set(key, { data: cached.data, timestamp: cached.timestamp });
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, dedupingInterval, errorRetryCount, errorRetryInterval]);

  const mutate = useCallback(async (): Promise<void> => {
    // Clear cache for this key
    if (key) {
      cache.delete(key);
    }
    await fetchData();
  }, [key, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh interval
  useEffect(() => {
    if (refreshInterval && key && fetcher) {
      const interval = setInterval(() => {
        fetchData();
      }, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, key, fetcher, fetchData]);

  // Focus revalidation
  useEffect(() => {
    if (revalidateOnFocus && key && fetcher) {
      const handleFocus = () => {
        fetchData();
      };

      window.addEventListener("focus", handleFocus);
      return () => window.removeEventListener("focus", handleFocus);
    }
  }, [revalidateOnFocus, key, fetcher, fetchData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}
