import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeColor = 'red' | 'teal' | 'amber' | 'green' | 'gray';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
}

const colorClasses: Record<BadgeColor, string> = {
  red: 'bg-brand-red-light text-brand-red',
  teal: 'bg-brand-teal-light text-brand-teal',
  amber: 'bg-brand-amber-light text-brand-amber',
  green: 'bg-brand-green-light text-brand-green',
  gray: 'bg-brand-gray-light text-brand-gray',
};

export function Badge({ color = 'gray', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        colorClasses[color],
        className
      )}
      {...props}
    />
  );
}
