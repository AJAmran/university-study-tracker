'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
