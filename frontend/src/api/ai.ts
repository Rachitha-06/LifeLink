import { api } from '@/api/client';

export interface MatchExplanation {
  explanation: string;
  mock: boolean;
}

export interface TriageResult {
  emergency: boolean;
  message?: string; // present when emergency: true
  suggested_organ?: string;
  suggested_urgency?: 'low' | 'medium' | 'high' | 'critical';
  rationale?: string;
  safety_note?: string;
  mock?: boolean;
}

export const aiApi = {
  explainMatch: (matchId: string) => api.post<MatchExplanation>(`/ai/explain-match/${matchId}`),
  triageAssist: (description: string) => api.post<TriageResult>('/ai/triage-assist', { description }),
};
