import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { UsersPanel } from '@/components/features/UsersPanel';
import { HospitalsPanel } from '@/components/features/HospitalsPanel';
import { AuditLogPanel } from '@/components/features/AuditLogPanel';
import { AnalyticsCharts } from '@/components/features/AnalyticsCharts';
import { HospitalMap } from '@/components/features/HospitalMap';
import { TwoFactorSetup } from '@/components/features/TwoFactorSetup';
import { useAuthStore } from '@/store/authStore';
import { useAdminStats } from '@/hooks/useAdmin';

export function AdminDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('overview');
  const { data: stats, isLoading } = useAdminStats();

  const navItems = [
    { key: 'overview', label: t('dashboard.overview') },
    { key: 'users', label: t('dashboard.users') },
    { key: 'hospitals', label: t('dashboard.hospitals') },
    { key: 'audit', label: t('dashboard.auditLog') },
    { key: 'analytics', label: t('dashboard.analytics') },
    { key: 'map', label: t('dashboard.map') },
    { key: 'security', label: t('dashboard.security') },
  ];

  return (
    <AppShell roleLabel="System Admin" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && (
        <>
          <h1 className="font-display text-2xl font-semibold text-brand-navy">
            {t('dashboard.welcome', { name: user?.name })}
          </h1>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard label="Total donors" value={stats?.total_donors ?? 0} color="red" />
                <StatCard label="Pending requests" value={stats?.pending_requests ?? 0} color="amber" />
                <StatCard label="Successful matches" value={stats?.successful_matches ?? 0} color="teal" />
                <StatCard label="Verified hospitals" value={stats?.verified_hospitals ?? 0} color="navy" />
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'users' && <UsersPanel />}
      {activeTab === 'hospitals' && <HospitalsPanel />}
      {activeTab === 'audit' && <AuditLogPanel />}
      {activeTab === 'analytics' && <AnalyticsCharts />}
      {activeTab === 'map' && <HospitalMap />}
      {activeTab === 'security' && <TwoFactorSetup />}
    </AppShell>
  );
}
