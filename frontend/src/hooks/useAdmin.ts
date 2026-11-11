import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';

export function useAdminStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
}

export function useAdminUsers(role?: string) {
  return useQuery({ queryKey: ['admin', 'users', role], queryFn: () => adminApi.users(role) });
}

export function useToggleUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.toggleUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useAuditLogs() {
  return useQuery({ queryKey: ['admin', 'audit-logs'], queryFn: adminApi.auditLogs });
}

export function useAdminHospitals() {
  return useQuery({ queryKey: ['admin', 'hospitals'], queryFn: adminApi.hospitals });
}

export function useVerifyHospital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.verifyHospital(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'hospitals'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    },
  });
}
