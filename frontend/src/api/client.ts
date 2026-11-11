import { useAuthStore } from '@/store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** internal — prevents infinite retry loops on repeated 401s */
  _isRetry?: boolean;
}

interface AuthPayload {
  user: import('@/types').User;
  token: string;
}

// Dedupes concurrent refresh attempts: if five requests all 401 at once,
// they should trigger exactly one /auth/refresh call, not five.
let refreshInFlight: Promise<AuthPayload> | null = null;

/**
 * Calls /auth/refresh directly via raw fetch rather than going through
 * authApi.login/register in api/auth.ts — auth.ts imports `api` from
 * this file, so importing authApi back here would create a circular
 * import. A few duplicated lines here is a smaller cost than that.
 */
async function refreshAccessToken(): Promise<AuthPayload> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh failed');
        return res.json();
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Exported so AuthGate can call this directly on app load to silently
 * re-establish a session from the refresh cookie. */
export async function refreshSession(): Promise<AuthPayload> {
  const data = await refreshAccessToken();
  useAuthStore.getState().setAuth(data.user, data.token);
  return data;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // sends the httpOnly refresh cookie on auth endpoints
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Access token expired mid-session — try exactly once to refresh
    // and replay the original request before giving up. Don't attempt
    // this on the refresh/login/register endpoints themselves, and
    // never more than once per request (guards against a refresh loop
    // if the server is misbehaving).
    const isAuthEndpoint = path.startsWith('/auth/');
    if (res.status === 401 && !isAuthEndpoint && !options._isRetry) {
      try {
        await refreshAccessToken().then((d) => useAuthStore.getState().setAuth(d.user, d.token));
        return request<T>(path, { ...options, _isRetry: true });
      } catch {
        useAuthStore.getState().logout();
        throw new ApiError('Session expired. Please log in again.', 401);
      }
    }

    if (res.status === 401) {
      useAuthStore.getState().logout();
    }
    throw new ApiError(data.error || 'Something went wrong.', res.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
