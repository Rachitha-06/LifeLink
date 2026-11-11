import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useAdminUsers, useToggleUser } from '@/hooks/useAdmin';

const ROLE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'donor', label: 'Donors' },
  { value: 'recipient', label: 'Recipients' },
  { value: 'hospital_admin', label: 'Hospital Staff' },
  { value: 'admin', label: 'Admins' },
];

export function UsersPanel() {
  const [roleFilter, setRoleFilter] = useState('');
  const { data: users, isLoading } = useAdminUsers(roleFilter || undefined);
  const toggleUser = useToggleUser();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-brand-navy">Users</h2>
        <div className="flex gap-1.5">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setRoleFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                roleFilter === f.value
                  ? 'bg-brand-teal-light text-brand-teal'
                  : 'bg-brand-gray-light text-brand-gray hover:text-brand-navy'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      )}

      {!isLoading && users && (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.user_id} className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-brand-navy">{u.name}</div>
                <div className="truncate text-xs text-brand-gray">{u.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="gray">{u.role}</Badge>
                <Badge color={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Suspended'}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={toggleUser.isPending}
                  onClick={() => toggleUser.mutate(u.user_id)}
                >
                  {u.is_active ? 'Suspend' : 'Reactivate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
