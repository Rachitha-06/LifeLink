import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-brand bg-white p-5 shadow-brand', className)}
      {...props}
    />
  );
}

/** Card with hover-lift, for clickable list items (donor cards, request cards, etc). */
export function InteractiveCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'cursor-pointer rounded-brand bg-white p-5 shadow-brand transition-all duration-150 hover:-translate-y-0.5 hover:shadow-brand-lg',
        className
      )}
      {...props}
    />
  );
}
