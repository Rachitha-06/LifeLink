import { api } from '@/api/client';

export interface Notification {
  notification_id: string;
  type: 'match_found' | 'request_approved' | 'donation_verified' | 'system' | 'reminder' | 'alert';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  page: number;
  limit: number;
  total: number;
}

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  categories: Record<string, boolean>;
}

export const notificationsApi = {
  list: (page = 1, limit = 20, unreadOnly = false) =>
    api.get<NotificationsResponse>(
      `/notifications?page=${page}&limit=${limit}${unreadOnly ? '&unread_only=true' : ''}`
    ),
  markRead: (id: string) => api.patch<Notification>(`/notifications/${id}/read`),
  getPreferences: () => api.get<NotificationPreferences>('/notifications/preferences'),
  updatePreferences: (payload: { email_enabled: boolean; sms_enabled: boolean }) =>
    api.put<NotificationPreferences>('/notifications/preferences', payload),
};
