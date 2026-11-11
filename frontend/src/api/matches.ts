import { api } from '@/api/client';
import type { Match, MatchHistoryEntry } from '@/types';

export const matchesApi = {
  runMatching: (requestId?: string) =>
    api.post<{ message: string; matches: Match[] }>('/matches/run', requestId ? { request_id: requestId } : {}),

  list: () => api.get<Match[]>('/matches'),

  timeline: (matchId: string) => api.get<MatchHistoryEntry[]>(`/matches/${matchId}/timeline`),

  startReview: (matchId: string, note?: string) =>
    api.patch<{ message: string; match: Match }>(`/matches/${matchId}/start-review`, { note }),

  confirm: (matchId: string, note?: string) =>
    api.patch<{ message: string; match: Match }>(`/matches/${matchId}/confirm`, { note }),
};
