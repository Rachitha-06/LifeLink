import { api } from '@/api/client';
import type { User, UserRole, BloodType } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  age?: number;
  blood_type?: BloodType;
  organ_type?: string;
  phone?: string;
  city?: string;
  state?: string;
  captchaToken?: string;
}

interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

interface TwoFactorRequiredResponse {
  requires2FA: true;
  tempToken: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export const authApi = {
  login: (payload: LoginPayload) => api.post<AuthResponse | TwoFactorRequiredResponse>('/auth/login', payload),
  register: (payload: RegisterPayload) => api.post<AuthResponse>('/auth/register', payload),
  me: () => api.get<User>('/auth/me'),
  logout: () => api.post<{ message: string }>('/auth/logout'),

  verify2FALogin: (tempToken: string, code: string) =>
    api.post<AuthResponse>('/auth/2fa/login-verify', { tempToken, code }),
  setup2FA: () => api.post<TwoFactorSetupResponse>('/auth/2fa/setup'),
  confirm2FA: (secret: string, code: string) =>
    api.post<{ message: string }>('/auth/2fa/confirm', { secret, code }),
  disable2FA: (password: string) => api.post<{ message: string }>('/auth/2fa/disable', { password }),
};
