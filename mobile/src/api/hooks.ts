import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api, unwrap, type ApiData, type ApiError } from "./client";

type JsonResponse = { status: number; json(): Promise<unknown> };

/**
 * The one way to read from the API. Pass `signal` on so a cancelled query stops downloading:
 *   const health = useApiQuery(["health"], ({ signal }) => api.v1.health.$get(undefined, { init: { signal } }));
 */
export function useApiQuery<R extends JsonResponse>(
  key: QueryKey,
  call: (ctx: { signal: AbortSignal }) => Promise<R>,
  options?: Omit<UseQueryOptions<ApiData<R>, ApiError>, "queryKey" | "queryFn">,
) {
  return useQuery<ApiData<R>, ApiError>({
    queryKey: key,
    queryFn: ({ signal }) => unwrap(call({ signal })),
    ...options,
  });
}

/**
 * The one way to write to the API.
 *   const save = useApiMutation((input: X) => api.v1.things.$post({ json: input }));
 */
export function useApiMutation<R extends JsonResponse, TInput = void>(
  call: (input: TInput) => Promise<R>,
  options?: Omit<UseMutationOptions<ApiData<R>, ApiError, TInput>, "mutationFn">,
) {
  return useMutation<ApiData<R>, ApiError, TInput>({ mutationFn: (input) => unwrap(call(input)), ...options });
}

/**
 * Query keys: one key factory per API area, so mutations can invalidate a whole area
 * (pattern from Bluesky's RQKEY). Example: queryClient.invalidateQueries({ queryKey: keys.health.all }).
 */
export const keys = {
  health: { all: ["health"] as const },
};

/** Example wired to /v1/health (no UI uses it yet). */
export const useHealth = () =>
  useApiQuery(keys.health.all, ({ signal }) => api.v1.health.$get(undefined, { init: { signal } }), {
    meta: { persist: false },
  });
