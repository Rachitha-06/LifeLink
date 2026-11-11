import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { MyRequestsList } from '@/components/features/MyRequestsList';
import { NotificationsList } from '@/components/features/NotificationsList';
import { EventsList } from '@/components/features/EventsList';
import { useAuthStore } from '@/store/authStore';
import { useMyRequests } from '@/hooks/useRecipients';

export function RecipientDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('overview');
  const { data: requests, isLoading } = useMyRequests();

  const navItems = [
    { key: 'overview', label: t('dashboard.overview') },
    { key: 'requests', label: t('dashboard.myRequests') },
    { key: 'matches', label: t('dashboard.matchStatus') },
    { key: 'events', label: t('dashboard.bloodDrives') },
    { key: 'notifications', label: t('dashboard.notifications') },
  ];

  const activeCount = requests?.filter((r) => r.status === 'pending' || r.status === 'reviewing').length ?? 0;
  const matchedCount = requests?.filter((r) => r.match_id).length ?? 0;

  return (
    <AppShell roleLabel="Recipient" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
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
                <StatCard label="Active requests" value={activeCount} color="red" />
                <StatCard label="Matches found" value={matchedCount} color="teal" />
                <StatCard label="Total requests" value={requests?.length ?? 0} color="navy" />
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'requests' && <MyRequestsList />}
      {activeTab === 'matches' && <MyRequestsList matchedOnly />}
      {activeTab === 'events' && <EventsList />}
      {activeTab === 'notifications' && <NotificationsList />}
    </AppShell>
  );
}
