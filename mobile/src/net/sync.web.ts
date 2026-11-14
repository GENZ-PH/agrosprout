import { onlineManager } from "@tanstack/react-query";

// On web, TanStack Query listens to the browser's online/offline events, but it starts as
// "online" and never reads navigator.onLine (query-core onlineManager: `#online = true`).
// A page opened offline (PWA from the service worker) would therefore never see a
// reconnect. Start from the browser's real state; the events take over from there.
export function startQuerySync() {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    onlineManager.setOnline(navigator.onLine);
  }
  return () => {};
}
