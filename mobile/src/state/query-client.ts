import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";

/** Server state (API data). Cached results are saved to the device so they are still there offline. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 7 * 24 * 60 * 60 * 1000, // keep cached data a week, for offline use
      retry: 2,
      networkMode: "offlineFirst",
    },
    mutations: { networkMode: "offlineFirst" },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "agrosprout-query-cache",
});

/** Bump to drop all cached API data after a breaking API change. */
export const QUERY_CACHE_BUSTER = "v1";
