import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { refreshSession } from '@/api/client';

/**
 * On every app load, the access token is gone (it lives in memory only —
 * see authStore.ts). This silently attempts /auth/refresh using the
 * httpOnly cookie to re-establish the session before rendering anything
 * that depends on auth state. A failure here is the normal case for a
 * first-time or logged-out visitor, not an error to surface.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    refreshSession()
      .catch(() => {
        /* no valid session — fine, user just isn't logged in */
      })
      .finally(() => setIsChecking(false));
  }, []);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-brand-gray">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
