import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';

export function useExplainMatch() {
  return useMutation({ mutationFn: (matchId: string) => aiApi.explainMatch(matchId) });
}

export function useTriageAssist() {
  return useMutation({ mutationFn: (description: string) => aiApi.triageAssist(description) });
}
