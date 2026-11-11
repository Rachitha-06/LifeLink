import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/authStore';
import { useEvents, useMyEventRegistrations, useRegisterForEvent, useUnregisterFromEvent } from '@/hooks/useEvents';

interface Props {
  /** Home.tsx shows a compact preview to anonymous visitors; dashboards
   * show the full list with register/unregister controls. */
  limit?: number;
}

export function EventsList({ limit }: Props) {
  const token = useAuthStore((s) => s.token);
  const { data: events, isLoading } = useEvents();
  const { data: myRegistrations } = useMyEventRegistrations();
  const register = useRegisterForEvent();
  const unregister = useUnregisterFromEvent();

  const visible = limit ? (events || []).slice(0, limit) : events || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <Card>
        <p className="text-sm text-brand-gray">No upcoming blood drives right now — check back soon.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((e) => {
        const isRegistered = myRegistrations?.includes(e.event_id);
        return (
          <Card key={e.event_id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-brand-navy">{e.title}</div>
                <div className="mt-0.5 text-xs text-brand-gray">
                  {e.hospital_name} · {e.city || 'Location TBD'}
                </div>
                <div className="mt-0.5 text-xs text-brand-gray">
                  {new Date(e.event_date).toLocaleDateString(undefined, {
                    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </div>
                {e.description && <p className="mt-2 text-xs text-brand-gray">{e.description}</p>}
              </div>
              <Badge color="teal">{e.registration_count} registered</Badge>
            </div>

            {token && (
              <Button
                size="sm"
                variant={isRegistered ? 'outline' : 'teal'}
                className="mt-3"
                disabled={register.isPending || unregister.isPending}
                onClick={() =>
                  isRegistered ? unregister.mutate(e.event_id) : register.mutate(e.event_id)
                }
              >
                {isRegistered ? "You're registered — cancel" : 'Register interest'}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
