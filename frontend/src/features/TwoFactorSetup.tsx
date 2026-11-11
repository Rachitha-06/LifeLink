import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useSetup2FA, useConfirm2FA, useDisable2FA, useMe } from '@/hooks/useAuth';

export function TwoFactorSetup() {
  const { data: user, refetch } = useMe();
  const enabled = user?.two_factor_enabled ?? false;

  const setup = useSetup2FA();
  const confirm = useConfirm2FA();
  const disable = useDisable2FA();

  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!setup.data || code.length !== 6) return;
    setError(null);
    try {
      await confirm.mutateAsync({ secret: setup.data.secret, code });
      setSuccess('Two-factor authentication enabled.');
      setCode('');
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code.');
    }
  };

  const handleDisable = async () => {
    setError(null);
    try {
      await disable.mutateAsync(disablePassword);
      setSuccess('Two-factor authentication disabled.');
      setDisablePassword('');
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect password.');
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-brand-navy">Two-Factor Authentication</h3>
        <Badge color={enabled ? 'green' : 'gray'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
      </div>
      <p className="mt-2 text-sm text-brand-gray">
        Adds a second step at login using an authenticator app (Google Authenticator, Authy, etc.)
        — recommended for admin and hospital-staff accounts.
      </p>

      {success && (
        <p className="mt-3 rounded-brand-sm bg-brand-teal-light px-3 py-2 text-xs text-brand-teal">{success}</p>
      )}
      {error && (
        <p className="mt-3 rounded-brand-sm bg-brand-red-light px-3 py-2 text-xs text-brand-red">{error}</p>
      )}

      {!enabled && !setup.data && (
        <Button size="sm" className="mt-4" onClick={() => setup.mutate()} disabled={setup.isPending}>
          {setup.isPending ? 'Generating…' : 'Set up two-factor authentication'}
        </Button>
      )}

      {!enabled && setup.data && (
        <div className="mt-4 space-y-3">
          <img src={setup.data.qrCodeDataUrl} alt="2FA QR code" className="h-40 w-40" />
          <p className="text-xs text-brand-gray">
            Scan this with your authenticator app, or enter this key manually:{' '}
            <code className="rounded bg-brand-gray-light px-1.5 py-0.5">{setup.data.secret}</code>
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            placeholder="Enter 6-digit code to confirm"
            className="w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid"
          />
          <Button size="sm" disabled={code.length !== 6 || confirm.isPending} onClick={handleConfirm}>
            {confirm.isPending ? 'Confirming…' : 'Confirm and enable'}
          </Button>
        </div>
      )}

      {enabled && (
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-brand-navy">
            Enter your password to disable two-factor authentication
          </label>
          <input
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            className="w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!disablePassword || disable.isPending}
            onClick={handleDisable}
          >
            {disable.isPending ? 'Disabling…' : 'Disable two-factor authentication'}
          </Button>
        </div>
      )}
    </Card>
  );
}
