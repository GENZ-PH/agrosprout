import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { startQuerySync } from "../src/net/sync";
import { useStoresReady } from "../src/state/hydration";
import { startLotSync } from "../src/state/lot-sync";
import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE,
  queryClient,
  queryPersister,
  shouldPersistQuery,
} from "../src/state/query-client";
import "../src/state/stores"; // starts loading every persisted store at launch

// Root providers only. Screens and navigation design belong to the Frontend track.
export default function RootLayout() {
  useEffect(() => startQuerySync(), []);
  // Saved farm data loads asynchronously. Showing screens earlier would let them read defaults
  // or write over saved data, so nothing renders until every store has loaded (usually a few ms).
  const storesReady = useStoresReady();
  // Fetch NASA data for lots saved while offline, once the farm has loaded (06-architecture).
  useEffect(() => (storesReady ? startLotSync() : undefined), [storesReady]);
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        buster: QUERY_CACHE_BUSTER,
        maxAge: QUERY_CACHE_MAX_AGE,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {storesReady ? <Stack screenOptions={{ headerShown: false }} /> : null}
    </PersistQueryClientProvider>
  );
}
