import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';

export function usePublicImpact() {
  return useQuery({
    queryKey: ['analytics', 'public-impact'],
    queryFn: analyticsApi.publicImpact,
    staleTime: 60_000,
  });
}

export function useDashboardTrends() {
  return useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: analyticsApi.dashboardTrends,
  });
}

export function useHospitalMap() {
  return useQuery({
    queryKey: ['analytics', 'hospital-map'],
    queryFn: analyticsApi.hospitalMap,
  });
}
