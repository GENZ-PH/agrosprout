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
 * The one way to read from the API.
 *   const health = useApiQuery(["health"], () => api.v1.health.$get());
 */
export function useApiQuery<R extends JsonResponse>(
  key: QueryKey,
  call: () => Promise<R>,
  options?: Omit<UseQueryOptions<ApiData<R>, ApiError>, "queryKey" | "queryFn">,
) {
  return useQuery<ApiData<R>, ApiError>({ queryKey: key, queryFn: () => unwrap(call()), ...options });
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

/** Example wired to /v1/health (no UI uses it yet). */
export const useHealth = () => useApiQuery(["health"], () => api.v1.health.$get());
