import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { FileUpload } from '@/components/ui/FileUpload';
import { DonationRegistrationForm } from '@/components/features/DonationRegistrationForm';
import { ChatThread } from '@/components/features/ChatThread';
import { MatchExplanation } from '@/components/features/MatchExplanation';
import { ImpactBadge } from '@/components/features/ImpactBadge';
import { useAuthStore } from '@/store/authStore';
import { useMyDonations, useUploadDonationDocument } from '@/hooks/useDonors';
import { donationStatusColor, matchStatusColor } from '@/lib/statusColors';

export function MyDonationsList() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [chatMatchId, setChatMatchId] = useState<string | null>(null);
  const [badgeDonation, setBadgeDonation] = useState<{ organType: string; date: string } | null>(null);
  const userName = useAuthStore((s) => s.user?.name) || 'A LifeLink donor';
  const { data, isLoading } = useMyDonations(page, 10);
  const uploadDocument = useUploadDonationDocument();

  if (showForm) {
    return <DonationRegistrationForm onDone={() => setShowForm(false)} />;
  }

  return (
    <div>
      {chatMatchId && <ChatThread matchId={chatMatchId} onClose={() => setChatMatchId(null)} />}
      {badgeDonation && (
        <ImpactBadge
          donorName={userName}
          organType={badgeDonation.organType}
          date={badgeDonation.date}
          onClose={() => setBadgeDonation(null)}
        />
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-brand-navy">My Donations</h2>
        <Button size="sm" onClick={() => setShowForm(true)}>Register a donation</Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      )}

      {!isLoading && data?.donations.length === 0 && (
        <Card>
          <p className="text-sm text-brand-gray">
            You haven't registered any donations yet. Register one to get started.
          </p>
        </Card>
      )}

      {!isLoading && data && data.donations.length > 0 && (
        <div className="space-y-3">
          {data.donations.map((d) => (
            <Card key={d.donation_id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-brand-navy">
                    {d.organ_type} · {d.blood_type}
                  </div>
                  <div className="mt-0.5 text-xs text-brand-gray">
                    {d.hospital_name || 'No hospital specified'} ·{' '}
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  {d.notes && <p className="mt-2 text-xs text-brand-gray">{d.notes}</p>}
                </div>
                <Badge color={donationStatusColor[d.status]}>{d.status}</Badge>
              </div>

              {d.match_id && (
                <div className="mt-3 rounded-brand-sm bg-brand-teal-light px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-brand-teal">
                      {d.requires_crossmatch
                        ? `Candidate suggestion — ${d.compatibility_score}% preliminary compatibility`
                        : `Match found — ${d.compatibility_score}% compatibility`}
                    </span>
                    {d.match_status && <Badge color={matchStatusColor[d.match_status]}>{d.match_status}</Badge>}
                  </div>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setChatMatchId(d.match_id!)}>
                    Message
                  </Button>
                  <div className="mt-2">
                    <MatchExplanation matchId={d.match_id} />
                  </div>
                </div>
              )}

              {!d.medical_report_url && (
                <div className="mt-3">
                  <FileUpload
                    label="Attach a medical report"
                    onUpload={(file) => uploadDocument.mutateAsync({ donationId: d.donation_id, file })}
                  />
                </div>
              )}
              {d.medical_report_url && (
                <p className="mt-3 text-xs text-brand-teal">✓ Document attached</p>
              )}

              {d.status === 'completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setBadgeDonation({ organType: d.organ_type, date: d.created_at })}
                >
                  Share your impact
                </Button>
              )}
            </Card>
          ))}
          <Pagination page={page} limit={10} total={data.total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
