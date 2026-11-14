// On web, TanStack Query already listens to the browser's online/offline and
// visibility events, so there is nothing to wire up.
export function startQuerySync() {
  return () => {};
}
