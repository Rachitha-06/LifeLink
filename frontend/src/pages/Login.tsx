import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin, useVerify2FALogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { ApiError } from '@/api/client';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
type LoginForm = z.infer<typeof loginSchema>;

// Convenience for local testing against `npm run db:seed` — remove before
// a real deployment goes out to actual users.
const DEMO_LOGINS: { label: string; email: string; password: string }[] = [
  { label: 'Donor', email: 'donor@lifelink.org', password: 'donor123' },
  { label: 'Recipient', email: 'patient@lifelink.org', password: 'recip123' },
  { label: 'Hospital admin', email: 'hospital@lifelink.org', password: 'hosp123' },
  { label: 'System admin', email: 'admin@lifelink.org', password: 'admin123' },
];

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useLogin();
  const verify2FA = useVerify2FALogin();
  const [serverError, setServerError] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const result = await login.mutateAsync(values);
      if ('requires2FA' in result) {
        setTempToken(result.tempToken);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    }
  };

  const onVerify2FA = async () => {
    if (!tempToken || code.length !== 6) return;
    setServerError(null);
    try {
      await verify2FA.mutateAsync({ tempToken, code });
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Invalid code. Please try again.');
    }
  };

  const fillDemo = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
  };

  if (tempToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-offwhite px-4">
        <Card className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold text-brand-navy">Two-factor verification</h1>
          <p className="mt-1 text-sm text-brand-gray">Enter the 6-digit code from your authenticator app.</p>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && onVerify2FA()}
            inputMode="numeric"
            autoFocus
            placeholder="000000"
            className="mt-4 w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-center text-lg tracking-[0.5em] focus-visible:border-brand-teal-mid"
          />

          {serverError && (
            <p role="alert" className="mt-3 rounded-brand-sm bg-brand-red-light px-3 py-2 text-xs text-brand-red">
              {serverError}
            </p>
          )}

          <Button
            fullWidth
            className="mt-4"
            disabled={code.length !== 6 || verify2FA.isPending}
            onClick={onVerify2FA}
          >
            {verify2FA.isPending ? 'Verifying…' : 'Verify'}
          </Button>
          <button
            type="button"
            onClick={() => setTempToken(null)}
            className="mt-3 w-full text-center text-xs text-brand-gray hover:underline"
          >
            Back to sign in
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-offwhite px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-2 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="font-display text-2xl font-semibold text-brand-navy">{t('auth.welcomeBack')}</h1>
        <p className="mt-1 text-sm text-brand-gray">{t('auth.signInSubtitle')}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-brand-navy">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid"
              {...register('email')}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-xs text-brand-red-mid">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-brand-navy">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid"
              {...register('password')}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && (
              <p id="password-error" className="mt-1 text-xs text-brand-red-mid">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="rounded-brand-sm bg-brand-red-light px-3 py-2 text-xs text-brand-red">
              {serverError}
            </p>
          )}

          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : t('common.signIn')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-brand-gray">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-medium text-brand-teal-mid hover:underline">
            {t('common.register')}
          </Link>
        </p>

        <div className="mt-6 border-t border-brand-gray-border pt-4">
          <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-brand-gray">
            Demo logins (dev only)
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {DEMO_LOGINS.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => fillDemo(d.email, d.password)}
                className="rounded-full border border-brand-gray-border px-2.5 py-1 text-[11px] text-brand-gray hover:border-brand-teal-mid hover:text-brand-teal"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
