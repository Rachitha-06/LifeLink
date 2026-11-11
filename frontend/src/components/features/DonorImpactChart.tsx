import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMyDonations } from '@/hooks/useDonors';

/** Donations broken down by organ/tissue type — deliberately just a
 * count of real, completed donations rather than an invented "lives
 * saved" multiplier, which would be easy to make up and hard to justify. */
export function DonorImpactChart() {
  const { data, isLoading } = useMyDonations(1, 100);

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="h-48 w-full" />
      </Card>
    );
  }

  if (!data || data.donations.length === 0) return null;

  const byType = new Map<string, number>();
  data.donations
    .filter((d) => d.status === 'completed' || d.status === 'verified')
    .forEach((d) => byType.set(d.organ_type, (byType.get(d.organ_type) || 0) + 1));

  const chartData = Array.from(byType.entries()).map(([organ_type, count]) => ({ organ_type, count }));
  if (chartData.length === 0) return null;

  return (
    <Card>
      <h3 className="mb-4 font-display text-lg font-semibold text-brand-navy">Your donation history</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="organ_type" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#0d7377" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
