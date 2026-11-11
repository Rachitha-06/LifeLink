import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { cn } from '@/lib/utils';

export interface NavItem {
  key: string;
  label: string;
}

interface AppShellProps {
  roleLabel: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
  children: ReactNode;
}

/** Shared chrome for every role dashboard: top bar with sign-out, and a
 * controlled tab strip driving which panel the dashboard renders. */
export function AppShell({ roleLabel, navItems, activeTab, onTabChange, children }: AppShellProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, { onSettled: () => navigate('/login') });
  };

  return (
    <div className="min-h-screen bg-brand-offwhite">
      <nav className="flex h-[60px] items-center justify-between gap-2 bg-brand-navy px-4 text-white sm:px-8">
        <span className="font-display text-lg font-bold tracking-tight sm:text-xl">
          Life<span className="text-brand-red-mid">Link</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher dark />
          <Badge color="teal" className="hidden sm:inline-block">
            {roleLabel}
          </Badge>
          <span className="hidden text-sm text-white/80 sm:inline">{user?.name}</span>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 bg-transparent text-white/80 hover:text-white"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? t('common.signingOut') : t('common.signOut')}
          </Button>
        </div>
      </nav>

      <div className="border-b border-brand-gray-border bg-white px-4 sm:px-8">
        {/* overflow-x-auto turns the tab strip into a horizontal scroll
            on narrow screens instead of wrapping awkwardly or breaking
            the layout — 5-6 tabs plus padding doesn't fit a phone width. */}
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto" role="tablist">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={activeTab === item.key}
              onClick={() => onTabChange(item.key)}
              className={cn(
                'shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === item.key
                  ? 'border-brand-teal-mid text-brand-teal'
                  : 'border-transparent text-brand-gray hover:text-brand-navy'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
    </div>
  );
}
