import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { EventsList } from '@/components/features/EventsList';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { usePublicImpact } from '@/hooks/useAnalytics';

export function Home() {
  const { t } = useTranslation();
  const { data: impact, isLoading } = usePublicImpact();

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 flex h-[60px] items-center justify-between bg-brand-navy px-8 text-white">
        <span className="font-display text-xl font-bold tracking-tight">
          Life<span className="text-brand-red-mid">Link</span>
        </span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher dark />
          <Link to="/login">
            <Button variant="outline" size="sm" className="border-white/20 bg-transparent text-white/80 hover:text-white">
              {t('common.signIn')}
            </Button>
          </Link>
          <Link to="/register">
            <Button variant="primary" size="sm">{t('common.register')}</Button>
          </Link>
        </div>
      </nav>

      <header className="mx-auto max-w-3xl px-8 py-20 text-center">
        <Badge color="teal" className="mb-4">{t('home.tagline')}</Badge>
        <h1 className="font-display text-5xl font-semibold leading-tight text-brand-navy">
          {t('home.headline')}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-brand-gray">{t('home.subtext')}</p>
      </header>

      <section className="mx-auto grid max-w-4xl grid-cols-2 gap-4 px-8 pb-20 sm:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label={t('home.statDonors')} value={impact?.registered_donors ?? 0} color="red" />
            <StatCard label={t('home.statLives')} value={impact?.lives_connected ?? 0} color="teal" />
            <StatCard label={t('home.statHospitals')} value={impact?.partner_hospitals ?? 0} color="amber" />
            <StatCard label={t('home.statCities')} value={impact?.cities_covered ?? 0} color="navy" />
          </>
        )}
      </section>

      <section className="mx-auto max-w-4xl px-8 pb-24">
        <h2 className="mb-4 font-display text-2xl font-semibold text-brand-navy">{t('home.upcomingEvents')}</h2>
        <EventsList limit={3} />
        <Card className="mt-6">
          <p className="text-sm text-brand-gray">{t('home.ctaText')}</p>
        </Card>
      </section>
    </div>
  );
}
