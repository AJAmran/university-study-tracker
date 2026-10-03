'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Re-entrancy guard for async UI handlers. Double-clicks / double-taps while a
 * request is in flight are ignored instead of firing duplicate mutations
 * (duplicate tasks, double-counted attendance, ...).
 *
 * Usage:
 *   const { busy, run } = useBusy();
 *   const handleSave = () => run(async () => { ...await action... });
 *   <button disabled={busy} onClick={handleSave}>…</button>
 */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const ref = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (ref.current) return undefined;
    ref.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      ref.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}

/** Client-side YYYY-MM-DD calendar date (user timezone). Pass to server
 * mutations so logs match the student's day even when the server runs in UTC. */
export function todayLocalDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
