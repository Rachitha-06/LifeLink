import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { VerifyDonationsPanel } from '@/components/features/VerifyDonationsPanel';
import { ManageRequestsPanel } from '@/components/features/ManageRequestsPanel';
import { RunMatchingPanel } from '@/components/features/RunMatchingPanel';
import { MatchList } from '@/components/features/MatchList';
import { HospitalMap } from '@/components/features/HospitalMap';
import { TwoFactorSetup } from '@/components/features/TwoFactorSetup';
import { EventsList } from '@/components/features/EventsList';
import { CreateEventForm } from '@/components/features/CreateEventForm';
import { useAuthStore } from '@/store/authStore';
import { useAdminStats } from '@/hooks/useAdmin';

export function HospitalDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const { data: stats, isLoading } = useAdminStats();

  const navItems = [
    { key: 'overview', label: t('dashboard.overview') },
    { key: 'verify', label: t('dashboard.verifyDonations') },
    { key: 'requests', label: t('dashboard.manageRequests') },
    { key: 'matching', label: t('dashboard.runMatching') },
    { key: 'events', label: t('dashboard.events') },
    { key: 'map', label: t('dashboard.map') },
    { key: 'security', label: t('dashboard.security') },
  ];

  return (
    <AppShell roleLabel="Hospital Staff" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && (
        <>
          <h1 className="font-display text-2xl font-semibold text-brand-navy">
            {t('dashboard.welcome', { name: user?.name })}
          </h1>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard label="Pending verifications" value={stats?.pending_verifications ?? 0} color="amber" />
                <StatCard label="Pending requests" value={stats?.pending_requests ?? 0} color="red" />
                <StatCard label="Successful matches" value={stats?.successful_matches ?? 0} color="teal" />
              </>
            )}
          </div>
          <Card className="mt-6">
            <p className="text-sm text-brand-gray">
              Use the tabs above to verify pending donations, review requests, and run the
              matching algorithm.
            </p>
          </Card>
        </>
      )}

      {activeTab === 'verify' && <VerifyDonationsPanel />}
      {activeTab === 'requests' && <ManageRequestsPanel />}
      {activeTab === 'matching' && (
        <div className="space-y-6">
          <RunMatchingPanel />
          <div>
            <h2 className="mb-4 font-display text-xl font-semibold text-brand-navy">Candidate Matches</h2>
            <MatchList />
          </div>
        </div>
      )}
      {activeTab === 'map' && <HospitalMap />}
      {activeTab === 'events' && (
        <div>
          {showCreateEvent ? (
            <CreateEventForm onDone={() => setShowCreateEvent(false)} />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-brand-navy">Blood Drive Events</h2>
                <Button size="sm" onClick={() => setShowCreateEvent(true)}>Create event</Button>
              </div>
              <EventsList />
            </>
          )}
        </div>
      )}
      {activeTab === 'security' && <TwoFactorSetup />}
    </AppShell>
  );
}
