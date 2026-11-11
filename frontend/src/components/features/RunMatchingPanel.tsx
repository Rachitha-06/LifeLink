import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRunMatching } from '@/hooks/useMatches';

export function RunMatchingPanel() {
  const runMatching = useRunMatching();

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-display text-lg font-semibold text-brand-navy">Run the matching algorithm</h3>
        <p className="mt-2 text-sm text-brand-gray">
          Scans all pending requests against available donors and generates candidate suggestions
          ranked by blood compatibility, organ match, and location. Organ matches require medical
          review before they can be confirmed — blood matches can be confirmed directly.
        </p>
        <Button
          className="mt-4"
          onClick={() => runMatching.mutate(undefined)}
          disabled={runMatching.isPending}
        >
          {runMatching.isPending ? 'Running…' : 'Run matching now'}
        </Button>

        {runMatching.data && (
          <p className="mt-3 rounded-brand-sm bg-brand-teal-light px-3 py-2 text-sm text-brand-teal">
            {runMatching.data.message}
          </p>
        )}
        {runMatching.isError && (
          <p className="mt-3 rounded-brand-sm bg-brand-red-light px-3 py-2 text-sm text-brand-red">
            Something went wrong running the matching algorithm. Please try again.
          </p>
        )}
      </Card>
    </div>
  );
}
