import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

/**
 * MILESTONE 2: this store no longer persists to localStorage. The access
 * token now lives in memory only — a page refresh clears it, and AuthGate
 * silently re-establishes the session via the httpOnly refresh cookie
 * (which JS can never read directly). This is what the Milestone 1
 * version of this file promised it would move to.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}));
