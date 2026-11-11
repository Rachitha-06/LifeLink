import { Skeleton } from '@/components/ui/Skeleton';
import { useMatchTimeline } from '@/hooks/useMatches';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Suggested',
  medical_review: 'Medical Review',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function MatchTimeline({ matchId }: { matchId: string }) {
  const { data: entries, isLoading } = useMatchTimeline(matchId);

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }

  if (!entries || entries.length === 0) return null;

  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {entries.map((e, i) => (
        <li key={e.history_id} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-brand-gray-border">→</span>}
          <div className="rounded-full bg-brand-teal-light px-2.5 py-1 text-[11px] font-medium text-brand-teal">
            {STATUS_LABELS[e.status] || e.status}
            <span className="ml-1.5 text-brand-teal/60">
              {new Date(e.created_at).toLocaleDateString()}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
