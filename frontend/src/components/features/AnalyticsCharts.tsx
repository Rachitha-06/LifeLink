import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDashboardTrends } from '@/hooks/useAnalytics';

export function AnalyticsCharts() {
  const { data, isLoading } = useDashboardTrends();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card><Skeleton className="h-64 w-full" /></Card>
        <Card><Skeleton className="h-64 w-full" /></Card>
      </div>
    );
  }

  if (!data) return null;

  // Merge the two monthly series into one dataset keyed by month, since
  // Recharts wants a single array with both values per point.
  const monthMap = new Map<string, { month: string; requests: number; matches: number }>();
  data.requestsByMonth.forEach((r) => monthMap.set(r.month, { month: r.month, requests: r.count, matches: 0 }));
  data.matchesByMonth.forEach((m) => {
    const existing = monthMap.get(m.month) || { month: m.month, requests: 0, matches: 0 };
    existing.matches = m.count;
    monthMap.set(m.month, existing);
  });
  const trendData = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-4 font-display text-lg font-semibold text-brand-navy">
          Requests vs. Matches (last 6 months)
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="requests" stroke="#c0392b" strokeWidth={2} name="Requests" />
            <Line type="monotone" dataKey="matches" stroke="#0d7377" strokeWidth={2} name="Matches" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-display text-lg font-semibold text-brand-navy">Requests by Urgency</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.requestsByUrgency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="urgency" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#d35400" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="mb-4 font-display text-lg font-semibold text-brand-navy">Requests by Organ</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.requestsByOrgan}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="organ" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#14a085" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
