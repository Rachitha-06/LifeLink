import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useDonorReviewQueue, useVerifyDonation } from '@/hooks/useDonors';

export function VerifyDonationsPanel() {
  const { data, isLoading } = useDonorReviewQueue('pending');
  const verifyDonation = useVerifyDonation();

  const donations = data?.donors.filter((d) => d.donation_id) || [];

  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-semibold text-brand-navy">Pending Verification</h2>

      {isLoading && (
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      )}

      {!isLoading && donations.length === 0 && (
        <Card>
          <p className="text-sm text-brand-gray">No donations awaiting verification right now.</p>
        </Card>
      )}

      {!isLoading && donations.length > 0 && (
        <div className="space-y-3">
          {donations.map((d) => (
            <Card key={d.donation_id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-brand-navy">{d.name}</div>
                  <div className="mt-0.5 text-xs text-brand-gray">
                    {d.organ_type} · {d.blood_type} · {d.city || 'No city listed'}
                  </div>
                </div>
                <Badge color="gray">{d.status}</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="teal"
                  disabled={verifyDonation.isPending}
                  onClick={() => verifyDonation.mutate({ donationId: d.donation_id, status: 'verified' })}
                >
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={verifyDonation.isPending}
                  onClick={() => verifyDonation.mutate({ donationId: d.donation_id, status: 'rejected' })}
                >
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
