import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { FileUpload } from '@/components/ui/FileUpload';
import { RequestSubmissionForm } from '@/components/features/RequestSubmissionForm';
import { ChatThread } from '@/components/features/ChatThread';
import { MatchExplanation } from '@/components/features/MatchExplanation';
import { useMyRequests, useCancelRequest, useUploadRequestDocument } from '@/hooks/useRecipients';
import { requestStatusColor, matchStatusColor } from '@/lib/statusColors';

interface Props {
  /** When true, only show requests that have progressed to a match —
   * used by the dedicated "Match Status" tab. */
  matchedOnly?: boolean;
}

export function MyRequestsList({ matchedOnly = false }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [chatMatchId, setChatMatchId] = useState<string | null>(null);
  const { data: requests, isLoading } = useMyRequests();
  const cancelRequest = useCancelRequest();
  const uploadDocument = useUploadRequestDocument();

  if (showForm) {
    return <RequestSubmissionForm onDone={() => setShowForm(false)} />;
  }

  const visible = matchedOnly ? (requests || []).filter((r) => r.match_id) : requests || [];

  return (
    <div>
      {chatMatchId && <ChatThread matchId={chatMatchId} onClose={() => setChatMatchId(null)} />}

      {!matchedOnly && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-brand-navy">My Requests</h2>
          <Button size="sm" onClick={() => setShowForm(true)}>Submit a request</Button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <Card>
          <p className="text-sm text-brand-gray">
            {matchedOnly
              ? "None of your requests have been matched yet — check back soon."
              : "You haven't submitted any requests yet."}
          </p>
        </Card>
      )}

      {!isLoading && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.request_id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-brand-navy">
                    {r.organ_needed} · {r.blood_type}
                  </div>
                  <div className="mt-0.5 text-xs text-brand-gray">
                    {r.hospital_name || 'No hospital specified'} ·{' '}
                    {new Date(r.request_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge color={r.urgency === 'critical' ? 'red' : 'amber'}>{r.urgency}</Badge>
                  <Badge color={requestStatusColor[r.status]}>{r.status}</Badge>
                </div>
              </div>

              {r.match_id && (
                <div className="mt-3 rounded-brand-sm bg-brand-teal-light px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-brand-teal">
                      {r.requires_crossmatch
                        ? `Candidate suggestion — ${r.compatibility_score}% preliminary compatibility`
                        : `Match found — ${r.compatibility_score}% compatibility`}
                    </span>
                    {r.match_status && (
                      <Badge color={matchStatusColor[r.match_status]}>{r.match_status}</Badge>
                    )}
                  </div>
                  {r.requires_crossmatch && (
                    <p className="mt-1 text-[11px] text-brand-teal/80">
                      Full medical evaluation required before this can be confirmed.
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setChatMatchId(r.match_id!)}
                  >
                    Message
                  </Button>
                  <div className="mt-2">
                    <MatchExplanation matchId={r.match_id} />
                  </div>
                </div>
              )}

              {r.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={cancelRequest.isPending}
                  onClick={() => cancelRequest.mutate(r.request_id)}
                >
                  Cancel request
                </Button>
              )}

              {!r.documents_url && (
                <div className="mt-3">
                  <FileUpload
                    label="Attach a document"
                    onUpload={(file) => uploadDocument.mutateAsync({ requestId: r.request_id, file })}
                  />
                </div>
              )}
              {r.documents_url && <p className="mt-3 text-xs text-brand-teal">✓ Document attached</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
