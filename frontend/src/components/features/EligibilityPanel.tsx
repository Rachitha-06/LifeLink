import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEligibility } from '@/hooks/useDonors';

export function EligibilityPanel() {
  const { data, isLoading } = useEligibility();

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-brand-navy">Blood donation</h3>
          <Badge color={data.bloodEligible ? 'green' : 'amber'}>
            {data.bloodEligible ? 'Eligible now' : 'Not yet eligible'}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-brand-gray">
          {data.bloodEligible
            ? "You're eligible to donate blood right now."
            : `Next eligible on ${new Date(data.nextBloodEligibleDate).toLocaleDateString()} (${data.daysSinceLastBlood ?? 0} days since your last donation).`}
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-brand-navy">Organ donation</h3>
          <Badge color="teal">Requires hospital review</Badge>
        </div>
        <p className="mt-2 text-sm text-brand-gray">
          Organ donation eligibility is confirmed by a hospital's medical team during the
          verification step, not automatically — this reflects that a preliminary registration
          can be submitted at any time.
        </p>
      </Card>

      {data.history.length > 0 && (
        <Card>
          <h3 className="mb-3 font-display text-lg font-semibold text-brand-navy">Donation history</h3>
          <ul className="space-y-2 text-sm">
            {data.history.map((h, i) => (
              <li key={i} className="flex justify-between border-b border-brand-gray-border pb-2 last:border-0">
                <span className="text-brand-navy">{h.organ_type}</span>
                <span className="text-brand-gray">{new Date(h.donation_date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
