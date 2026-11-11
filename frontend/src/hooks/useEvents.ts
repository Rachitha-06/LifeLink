import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, type CreateEventPayload } from '@/api/events';
import { useAuthStore } from '@/store/authStore';

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: eventsApi.list });
}

export function useMyEventRegistrations() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['events', 'mine'],
    queryFn: eventsApi.mine,
    enabled: !!token, // only meaningful for logged-in users; Home.tsx shows events to anonymous visitors too
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEventPayload) => eventsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useRegisterForEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventsApi.register(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', 'mine'] });
    },
  });
}

export function useUnregisterFromEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventsApi.unregister(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', 'mine'] });
    },
  });
}
