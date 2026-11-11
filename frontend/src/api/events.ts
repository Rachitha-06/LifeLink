import { api } from '@/api/client';

export interface BloodDriveEvent {
  event_id: string;
  hospital_id: string;
  hospital_name: string;
  title: string;
  description?: string | null;
  event_date: string;
  city?: string | null;
  registration_count: number;
}

export interface CreateEventPayload {
  hospital_id: string;
  title: string;
  description?: string;
  event_date: string;
  city?: string;
}

export const eventsApi = {
  list: () => api.get<BloodDriveEvent[]>('/events'),
  create: (payload: CreateEventPayload) => api.post<BloodDriveEvent>('/events', payload),
  register: (eventId: string) => api.post<{ message: string }>(`/events/${eventId}/register`),
  unregister: (eventId: string) => api.delete<{ message: string }>(`/events/${eventId}/register`),
  mine: () => api.get<string[]>('/events/mine'),
};
