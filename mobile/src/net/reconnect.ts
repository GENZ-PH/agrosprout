import { onlineManager } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

/**
 * Runs `callback` each time the device goes from offline to online.
 * For work that waits for a connection, such as fetching NASA POWER data for lots saved
 * as `data_status: "pending"` (06-architecture: "fetch automatically when back online").
 *
 * The online state comes from TanStack Query's onlineManager: NetInfo on Android (src/net/sync.ts),
 * the browser's online/offline events on web. It starts as online until the first NetInfo event,
 * so work started with `runNow` may still fail offline; leave the item pending and it runs again
 * on the next reconnect.
 */
export function onReconnect(callback: () => void, { runNow = false }: { runNow?: boolean } = {}) {
  let wasOnline = onlineManager.isOnline();
  const unsubscribe = onlineManager.subscribe((online) => {
    if (online && !wasOnline) callback();
    wasOnline = online;
  });
  if (runNow && wasOnline) callback();
  return unsubscribe;
}

/** Hook form of `onReconnect`. The latest `callback` is always used. */
export function useOnReconnect(callback: () => void, options?: { runNow?: boolean }) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  const runNow = options?.runNow ?? false;
  useEffect(() => onReconnect(() => latest.current(), { runNow }), [runNow]);
}
