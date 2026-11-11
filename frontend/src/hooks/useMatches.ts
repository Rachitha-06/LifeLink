import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matchesApi } from '@/api/matches';

export function useMatches() {
  return useQuery({ queryKey: ['matches'], queryFn: matchesApi.list });
}

export function useMatchTimeline(matchId: string | null) {
  return useQuery({
    queryKey: ['matches', matchId, 'timeline'],
    queryFn: () => matchesApi.timeline(matchId!),
    enabled: !!matchId,
  });
}

export function useRunMatching() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId?: string) => matchesApi.runMatching(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useStartReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, note }: { matchId: string; note?: string }) => matchesApi.startReview(matchId, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });
}

export function useConfirmMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, note }: { matchId: string; note?: string }) => matchesApi.confirm(matchId, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });
}
