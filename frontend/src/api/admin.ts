import { api } from '@/api/client';
import type { User, Hospital } from '@/types';

export interface AdminStats {
  total_donors: number;
  pending_requests: number;
  successful_matches: number;
  verified_hospitals: number;
  pending_verifications: number;
}

export interface AuditLogEntry {
  log_id: string;
  user_id: string | null;
  user_name?: string | null;
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  created_at: string;
}

export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats'),
  users: (role?: string) => api.get<User[]>(`/admin/users${role ? `?role=${role}` : ''}`),
  toggleUser: (id: string) => api.patch<{ user_id: string; name: string; is_active: boolean }>(`/admin/users/${id}/toggle`),
  auditLogs: () => api.get<AuditLogEntry[]>('/admin/audit-logs'),
  hospitals: () => api.get<Hospital[]>('/hospitals'),
  verifyHospital: (id: string) => api.patch<{ message: string; hospital: Hospital }>(`/hospitals/${id}/verify`),
};
