import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { MatchTimeline } from '@/components/features/MatchTimeline';
import { MatchExplanation } from '@/components/features/MatchExplanation';
import { ChatThread } from '@/components/features/ChatThread';
import { useMatches, useStartReview, useConfirmMatch } from '@/hooks/useMatches';
import { matchStatusColor } from '@/lib/statusColors';

export function MatchList() {
  const { data: matches, isLoading } = useMatches();
  const startReview = useStartReview();
  const confirmMatch = useConfirmMatch();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chatMatchId, setChatMatchId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <ListItemSkeleton />
        <ListItemSkeleton />
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <Card>
        <p className="text-sm text-brand-gray">
          No candidate matches yet. Run matching from the "Run Matching" tab to generate some.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {chatMatchId && <ChatThread matchId={chatMatchId} onClose={() => setChatMatchId(null)} />}
      {matches.map((m) => (
        <Card key={m.match_id}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-brand-navy">
                {m.donor_name} → {m.recipient_name}
              </div>
              <div className="mt-0.5 text-xs text-brand-gray">
                {m.organ_needed} · {m.donor_blood} · {m.compatibility_score}% preliminary compatibility
              </div>
            </div>
            <Badge color={matchStatusColor[m.status]}>{m.status.replace('_', ' ')}</Badge>
          </div>

          {m.requires_crossmatch && (
            <div className="mt-3 rounded-brand-sm bg-brand-amber-light px-3 py-2 text-xs text-brand-amber">
              ⚠️ Candidate suggestion only — full medical evaluation (tissue typing, crossmatch test)
              required before this can be confirmed.
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {m.status === 'pending' && m.requires_crossmatch && (
              <Button size="sm" variant="outline" onClick={() => startReview.mutate({ matchId: m.match_id })}>
                Start medical review
              </Button>
            )}
            {((m.status === 'pending' && !m.requires_crossmatch) || m.status === 'medical_review') && (
              <Button size="sm" onClick={() => confirmMatch.mutate({ matchId: m.match_id })}>
                {m.requires_crossmatch ? 'Approve for medical workup' : 'Confirm match'}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExpandedId(expandedId === m.match_id ? null : m.match_id)}
            >
              {expandedId === m.match_id ? 'Hide timeline' : 'View timeline'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setChatMatchId(m.match_id)}>
              Message
            </Button>
          </div>

          {expandedId === m.match_id && (
            <div className="mt-3 border-t border-brand-gray-border pt-3">
              <MatchTimeline matchId={m.match_id} />
            </div>
          )}

          <div className="mt-3">
            <MatchExplanation matchId={m.match_id} />
          </div>
        </Card>
      ))}
    </div>
  );
}
