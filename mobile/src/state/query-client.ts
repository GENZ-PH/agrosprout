import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, type Query } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { APP_VERSION } from "../env";

const DAY = 24 * 60 * 60 * 1000;

/** Named freshness values, so each query says how fresh its data must be (pattern from Bluesky). */
export const STALE = { MINUTE: 60 * 1000, HOUR: 60 * 60 * 1000, DAY, FOREVER: Infinity } as const;

/** Retry network problems and 5xx once; never retry a 4xx (pattern from delvo.ph). */
const retryUnlessClientError = (failureCount: number, error: unknown) => {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
};

/** Server state (API data). Successful results are saved to the device so they are still there offline. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * STALE.MINUTE,
      gcTime: 7 * DAY, // keep cached data a week, for offline use
      retry: retryUnlessClientError,
      refetchOnWindowFocus: false,
      networkMode: "offlineFirst",
    },
    mutations: { retry: 0, networkMode: "offlineFirst" },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "agrosprout-query-cache",
});

/** Bump CACHE_SCHEMA after a breaking API change; a new app version also drops the saved cache. */
const CACHE_SCHEMA = 1;
export const QUERY_CACHE_BUSTER = `${APP_VERSION}:${CACHE_SCHEMA}`;
export const QUERY_CACHE_MAX_AGE = 7 * DAY;

/** Save only successful queries, and skip any query that sets `meta: { persist: false }`. */
export const shouldPersistQuery = (query: Query) =>
  query.state.status === "success" && query.meta?.persist !== false;
