import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-brand-sm bg-brand-gray-light', className)} {...props} />;
}

/** Matches the shape of a StatCard while its data is loading. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-brand border-l-4 border-brand-gray-border bg-white p-5 shadow-brand">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

/** Matches the shape of an InteractiveCard list item while loading. */
export function ListItemSkeleton() {
  return (
    <div className="rounded-brand bg-white p-5 shadow-brand">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-2 h-3 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/4" />
    </div>
  );
}
