import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useAdminHospitals, useVerifyHospital } from '@/hooks/useAdmin';

export function HospitalsPanel() {
  const { data: hospitals, isLoading } = useAdminHospitals();
  const verifyHospital = useVerifyHospital();

  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-semibold text-brand-navy">Hospitals</h2>

      {isLoading && (
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      )}

      {!isLoading && hospitals && (
        <div className="space-y-2">
          {hospitals.map((h) => (
            <Card key={h.hospital_id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-brand-navy">{h.name}</div>
                  <div className="truncate text-xs text-brand-gray">
                    {h.address}, {h.city} {h.hospital_type ? `· ${h.hospital_type}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={h.verified_status ? 'green' : 'amber'}>
                    {h.verified_status ? 'Verified' : 'Unverified'}
                  </Badge>
                  {!h.verified_status && (
                    <Button
                      size="sm"
                      disabled={verifyHospital.isPending}
                      onClick={() => verifyHospital.mutate(h.hospital_id)}
                    >
                      Verify
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
