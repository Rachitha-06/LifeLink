import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi, type LoginPayload, type RegisterPayload } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

/** onSuccess only sets auth state for a full session response — a
 * `requires2FA` response has no user/token yet, so the caller (Login.tsx)
 * checks the response shape itself and shows the code-entry step instead. */
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (data) => {
      if (!('requires2FA' in data)) setAuth(data.user, data.token);
    },
  });
}

export function useVerify2FALogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: ({ tempToken, code }: { tempToken: string; code: string }) =>
      authApi.verify2FALogin(tempToken, code),
    onSuccess: (data) => setAuth(data.user, data.token),
  });
}

export function useSetup2FA() {
  return useMutation({ mutationFn: authApi.setup2FA });
}

export function useConfirm2FA() {
  return useMutation({
    mutationFn: ({ secret, code }: { secret: string; code: string }) => authApi.confirm2FA(secret, code),
  });
}

export function useDisable2FA() {
  return useMutation({ mutationFn: (password: string) => authApi.disable2FA(password) });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
    onSuccess: (data) => setAuth(data.user, data.token),
  });
}

/** Revokes the refresh token server-side, then clears local state
 * regardless of whether the network call succeeds — a failed logout
 * request shouldn't trap the user in a "still looks logged in" UI. */
export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => logout(),
  });
}

/** Fetches the current user from the server. AuthGate uses refreshSession()
 * for the initial silent re-auth on app load; this hook is for anywhere
 * else that wants to (re)validate/refetch the current user on demand. */
export function useMe() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: !!token,
    retry: false,
  });
}
