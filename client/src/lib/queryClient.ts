import { QueryClient, QueryFunction } from "@tanstack/react-query";

const USER_KEY = "omi_lingualearn_user_id";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Get the current user ID from localStorage
 */
function getUserId(): string | null {
  return localStorage.getItem(USER_KEY);
}

/**
 * Append userId parameter to URL if not already present
 */
function appendUserId(url: string): string {
  const userId = getUserId();
  if (!userId) return url;

  const urlObj = new URL(url, window.location.origin);

  // Don't add userId if it's already in the URL
  if (urlObj.searchParams.has('userId')) {
    return url;
  }

  urlObj.searchParams.append('userId', userId);
  return urlObj.pathname + urlObj.search;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Automatically append userId to all requests
  const urlWithUserId = appendUserId(url);

  // Also add userId to request body for POST/PATCH requests if data is an object
  let bodyData = data;
  if (data && typeof data === 'object' && (method === 'POST' || method === 'PATCH')) {
    const userId = getUserId();
    if (userId) {
      bodyData = { ...data, userId };
    }
  }

  const res = await fetch(urlWithUserId, {
    method,
    headers: bodyData ? { "Content-Type": "application/json" } : {},
    body: bodyData ? JSON.stringify(bodyData) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Automatically append userId to query requests
    const url = appendUserId(queryKey.join("/") as string);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

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
