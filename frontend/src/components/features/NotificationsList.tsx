import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { NotificationPreferencesPanel } from '@/components/features/NotificationPreferencesPanel';
import { useNotifications, useMarkNotificationRead } from '@/hooks/useNotifications';

export function NotificationsList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotifications(page, 20);
  const markRead = useMarkNotificationRead();

  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-semibold text-brand-navy">Notifications</h2>
      <NotificationPreferencesPanel />

      {isLoading && (
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      )}

      {!isLoading && data?.notifications.length === 0 && (
        <Card>
          <p className="text-sm text-brand-gray">You're all caught up — no notifications yet.</p>
        </Card>
      )}

      {!isLoading && data && data.notifications.length > 0 && (
        <div className="space-y-2">
          {data.notifications.map((n) => (
            <Card
              key={n.notification_id}
              className={n.is_read ? 'cursor-default opacity-60' : 'cursor-pointer'}
              onClick={() => !n.is_read && markRead.mutate(n.notification_id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-red-mid" />}
                    <span className="text-sm font-medium text-brand-navy">{n.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-brand-gray">{n.message}</p>
                </div>
                <Badge color="gray">{new Date(n.created_at).toLocaleDateString()}</Badge>
              </div>
            </Card>
          ))}
          <Pagination page={page} limit={20} total={data.total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
