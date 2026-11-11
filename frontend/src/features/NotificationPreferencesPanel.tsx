import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useNotifications';

export function NotificationPreferencesPanel() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  if (isLoading || !prefs) return null;

  return (
    <div className="mb-4 flex items-center gap-4 rounded-brand-sm border border-brand-gray-border bg-white px-4 py-3 text-sm">
      <span className="font-medium text-brand-navy">Notify me via:</span>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={prefs.email_enabled}
          onChange={(e) =>
            updatePrefs.mutate({ email_enabled: e.target.checked, sms_enabled: prefs.sms_enabled })
          }
        />
        Email
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={prefs.sms_enabled}
          onChange={(e) =>
            updatePrefs.mutate({ email_enabled: prefs.email_enabled, sms_enabled: e.target.checked })
          }
        />
        SMS
      </label>
      <span className="text-xs text-brand-gray">In-app notifications are always on.</span>
    </div>
  );
}
