import { api } from '@/api/client';

export interface Message {
  message_id: string;
  match_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
}

export const messagesApi = {
  // REST is used for loading history when a chat panel first opens.
  // Real-time delivery and sending both go over the socket connection
  // (see lib/socket.ts) — matches the backend's REST fallback route,
  // which exists as a backup path if a client's socket is down.
  history: (matchId: string) => api.get<Message[]>(`/matches/${matchId}/messages`),
};
