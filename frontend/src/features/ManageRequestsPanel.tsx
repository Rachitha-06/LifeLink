import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useRequestReviewQueue } from '@/hooks/useRecipients';
import { requestStatusColor } from '@/lib/statusColors';

export function ManageRequestsPanel() {
  const { data: requests, isLoading } = useRequestReviewQueue();

  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-semibold text-brand-navy">All Requests</h2>

      {isLoading && (
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      )}

      {!isLoading && (!requests || requests.length === 0) && (
        <Card>
          <p className="text-sm text-brand-gray">No active requests right now.</p>
        </Card>
      )}

      {!isLoading && requests && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.request_id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-brand-navy">{r.patient_name}</div>
                  <div className="mt-0.5 text-xs text-brand-gray">
                    {r.organ_needed} · {r.blood_type} · {r.city || 'No city listed'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge color={r.urgency === 'critical' ? 'red' : 'amber'}>{r.urgency}</Badge>
                  <Badge color={requestStatusColor[r.status]}>{r.status}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
