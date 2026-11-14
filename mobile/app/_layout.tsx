import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { QUERY_CACHE_BUSTER, queryClient, queryPersister } from "../src/state/query-client";

// Root providers only. Screens and navigation design belong to the Frontend track.
export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, buster: QUERY_CACHE_BUSTER, maxAge: 7 * 24 * 60 * 60 * 1000 }}
    >
      <Stack screenOptions={{ headerShown: false }} />
    </PersistQueryClientProvider>
  );
}
