import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * True while the device has a connection: NetInfo on Android (src/net/sync.ts), the browser's
 * online and offline events on web (src/net/sync.web.ts), through TanStack Query's onlineManager.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}
