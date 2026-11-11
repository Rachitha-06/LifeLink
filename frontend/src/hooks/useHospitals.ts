import { useQuery } from '@tanstack/react-query';
import { hospitalsApi } from '@/api/hospitals';

export function useHospitals() {
  return useQuery({
    queryKey: ['hospitals'],
    queryFn: hospitalsApi.list,
    staleTime: 5 * 60 * 1000, // hospital list changes rarely — no need to refetch often
  });
}
