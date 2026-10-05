"use client";

import { useCallback, useEffect, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  refetch: () => void;
}

interface Settled<T> {
  key: readonly unknown[];
  data?: T;
  error?: Error;
}

const sameKey = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

/** Minimal data-fetching hook. Swap for TanStack Query if needs grow. */
export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  enabled = true,
): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>();
  const key = [nonce, ...deps];

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    fn(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setSettled({ key, data });
      },
      (err: unknown) => {
        if (!controller.signal.aborted) {
          setSettled({ key, error: err instanceof Error ? err : new Error(String(err)) });
        }
      },
    );

    return () => controller.abort();
    // `deps` stands in for `fn`'s inputs, like useEffect's own dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...key]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  // Loading = enabled and no result yet for the current key (derived, not stored).
  const current = settled && sameKey(settled.key, key) ? settled : undefined;

  return {
    data: current?.data,
    error: current?.error,
    isLoading: enabled && !current,
    refetch,
  };
}
