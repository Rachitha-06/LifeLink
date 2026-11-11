import { cn } from '@/lib/utils';

type StatColor = 'red' | 'teal' | 'amber' | 'navy';

interface StatCardProps {
  label: string;
  value: number | string;
  color?: StatColor;
}

const borderClasses: Record<StatColor, string> = {
  red: 'border-brand-red-mid',
  teal: 'border-brand-teal-mid',
  amber: 'border-brand-amber-mid',
  navy: 'border-brand-navy',
};

const textClasses: Record<StatColor, string> = {
  red: 'text-brand-red-mid',
  teal: 'text-brand-teal-mid',
  amber: 'text-brand-amber-mid',
  navy: 'text-brand-navy',
};

export function StatCard({ label, value, color = 'navy' }: StatCardProps) {
  return (
    <div className={cn('rounded-brand border-l-4 bg-white p-5 shadow-brand', borderClasses[color])}>
      <div className={cn('font-display text-3xl font-bold leading-none', textClasses[color])}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-gray">{label}</div>
    </div>
  );
}
