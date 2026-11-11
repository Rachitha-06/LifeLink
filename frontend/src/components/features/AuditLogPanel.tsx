import { Card } from '@/components/ui/Card';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useAuditLogs } from '@/hooks/useAdmin';

export function AuditLogPanel() {
  const { data: logs, isLoading } = useAuditLogs();

  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-semibold text-brand-navy">Audit Log</h2>

      {isLoading && (
        <div className="space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      )}

      {!isLoading && (!logs || logs.length === 0) && (
        <Card>
          <p className="text-sm text-brand-gray">No audit log entries yet.</p>
        </Card>
      )}

      {!isLoading && logs && logs.length > 0 && (
        <div className="divide-y divide-brand-gray-border rounded-brand bg-white shadow-brand">
          {logs.map((log) => (
            <div key={log.log_id} className="flex items-center justify-between px-5 py-3">
              <div>
                <span className="text-sm font-medium text-brand-navy">{log.action}</span>
                {log.table_name && <span className="ml-2 text-xs text-brand-gray">on {log.table_name}</span>}
                <div className="text-xs text-brand-gray">{log.user_name || 'System'}</div>
              </div>
              <span className="text-xs text-brand-gray">{new Date(log.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
