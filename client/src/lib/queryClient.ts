import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Base URL das suas APIs do Xano
const BASE_AUTH_URL = "https://x8ki-letl-twmt.n7.xano.io/api:0_3C2_nU";
const BASE_EXPENSE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:agAjCmuq";

// Função para requisições genéricas à API
export async function apiRequest(
  method: string,
  endpoint: string,
  data?: unknown
): Promise<Response> {
  const baseUrl = endpoint.startsWith("/auth")
    ? BASE_AUTH_URL
    : BASE_EXPENSE_URL;

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

// Função padrão para buscas (queries)
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const [base, endpoint] = queryKey as [string, string];
    const baseUrl = base === "auth" ? BASE_AUTH_URL : BASE_EXPENSE_URL;

    const res = await fetch(`${baseUrl}${endpoint}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Configuração padrão do React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
