import { useEffect, useRef } from 'react';

/**
 * Debounced auto-save hook.
 *
 * Waits `delayMs` after the last change before calling `saveFn`.
 * If the component unmounts or new data arrives before the timer
 * fires, the pending save is cancelled (no stale writes).
 *
 * Also flushes immediately on unmount so data is never lost.
 *
 * @param loaded  - Only save after initial hydration is complete
 * @param data    - The data to watch for changes (state array/object)
 * @param saveFn  - Async function that persists the data
 * @param delayMs - Debounce delay in milliseconds (default 800ms)
 */
export function useDebouncedSave<T>(
  loaded: boolean,
  data: T,
  saveFn: (d: T) => Promise<void>,
  delayMs: number = 800,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<T>(data);
  const loadedRef = useRef(loaded);
  const hasPendingRef = useRef(false);

  // Keep refs in sync
  latestDataRef.current = data;
  loadedRef.current = loaded;

  useEffect(() => {
    if (!loaded) return;

    hasPendingRef.current = true;

    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Schedule new save
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      hasPendingRef.current = false;
      saveFn(latestDataRef.current).catch((e) =>
        console.error('[DebouncedSave] failed:', e),
      );
    }, delayMs);

    // Cleanup: cancel timer if data changes again before it fires
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loaded, data, delayMs]); // saveFn intentionally excluded — it's stable

  // Flush on unmount so we never lose data
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (hasPendingRef.current && loadedRef.current) {
        saveFn(latestDataRef.current).catch((e) =>
          console.error('[DebouncedSave] flush on unmount failed:', e),
        );
      }
    };
  }, []); // runs only on unmount
}
