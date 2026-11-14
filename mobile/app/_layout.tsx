import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { startQuerySync } from "../src/net/sync";
import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_MAX_AGE,
  queryClient,
  queryPersister,
  shouldPersistQuery,
} from "../src/state/query-client";

// Root providers only. Screens and navigation design belong to the Frontend track.
export default function RootLayout() {
  useEffect(() => startQuerySync(), []);
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
      <Stack screenOptions={{ headerShown: false }} />
    </PersistQueryClientProvider>
  );
}
