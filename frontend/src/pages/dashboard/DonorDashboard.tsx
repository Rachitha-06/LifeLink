import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { MyDonationsList } from '@/components/features/MyDonationsList';
import { EligibilityPanel } from '@/components/features/EligibilityPanel';
import { NotificationsList } from '@/components/features/NotificationsList';
import { DonorImpactChart } from '@/components/features/DonorImpactChart';
import { EventsList } from '@/components/features/EventsList';
import { useAuthStore } from '@/store/authStore';
import { useMyDonations, useEligibility } from '@/hooks/useDonors';

export function DonorDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('overview');
  const { data: donations, isLoading: donationsLoading } = useMyDonations(1, 100);
  const { data: eligibility, isLoading: eligibilityLoading } = useEligibility();

  const navItems = [
    { key: 'overview', label: t('dashboard.overview') },
    { key: 'donations', label: t('dashboard.myDonations') },
    { key: 'eligibility', label: t('dashboard.eligibility') },
    { key: 'events', label: t('dashboard.bloodDrives') },
    { key: 'notifications', label: t('dashboard.notifications') },
  ];

  return (
    <AppShell roleLabel="Donor" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && (
        <>
          <h1 className="font-display text-2xl font-semibold text-brand-navy">
            {t('dashboard.welcome', { name: user?.name })}
          </h1>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {donationsLoading || eligibilityLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard label="Donations made" value={donations?.total ?? 0} color="red" />
                <StatCard
                  label="Days to next eligible"
                  value={eligibility?.bloodEligible ? 'Now' : eligibility?.daysSinceLastBlood != null ? Math.max(0, 90 - eligibility.daysSinceLastBlood) : '—'}
                  color="teal"
                />
                <StatCard
                  label="Verified donations"
                  value={donations?.donations.filter((d) => d.status === 'completed').length ?? 0}
                  color="amber"
                />
              </>
            )}
          </div>
          <div className="mt-6">
            <DonorImpactChart />
          </div>
        </>
      )}

      {activeTab === 'donations' && <MyDonationsList />}
      {activeTab === 'eligibility' && <EligibilityPanel />}
      {activeTab === 'events' && <EventsList />}
      {activeTab === 'notifications' && <NotificationsList />}
    </AppShell>
  );
}
