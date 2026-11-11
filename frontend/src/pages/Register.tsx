import { useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Captcha } from '@/components/features/Captcha';
import { LanguageSwitcher } from '@/components/features/LanguageSwitcher';
import { cn } from '@/lib/utils';
import { ApiError } from '@/api/client';
import type { UserRole } from '@/types';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const ORGAN_TYPES = ['Blood', 'Kidney', 'Liver', 'Heart', 'Lungs', 'Pancreas', 'Cornea', 'Bone Marrow'] as const;

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'donor', label: 'Donor' },
  { value: 'recipient', label: 'Recipient' },
  { value: 'hospital_admin', label: 'Hospital Staff' },
];

const registerSchema = z
  .object({
    name: z.string().min(2, 'Enter your full name.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string(),
    role: z.enum(['donor', 'recipient', 'hospital_admin']),
    age: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.coerce.number().int().min(0).max(120).optional()
    ),
    blood_type: z.enum(BLOOD_TYPES).optional().or(z.literal('')),
    organ_type: z.string().optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const registerUser = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'donor' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    try {
      await registerUser.mutateAsync({
        ...values,
        blood_type: values.blood_type === '' ? undefined : values.blood_type,
        captchaToken,
      });
      navigate('/dashboard');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-offwhite px-4 py-10">
      <Card className="w-full max-w-md">
        <div className="mb-2 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="font-display text-2xl font-semibold text-brand-navy">{t('auth.createAccount')}</h1>
        <p className="mt-1 text-sm text-brand-gray">{t('auth.registerSubtitle')}</p>

        <div className="mt-5 grid grid-cols-3 gap-1.5" role="tablist" aria-label="Account type">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="tab"
              aria-selected={selectedRole === r.value}
              onClick={() => setValue('role', r.value)}
              className={cn(
                'rounded-brand-sm border px-2 py-2 text-xs font-medium transition-colors',
                selectedRole === r.value
                  ? 'border-brand-teal-mid bg-brand-teal-light text-brand-teal'
                  : 'border-brand-gray-border text-brand-gray hover:border-brand-teal-mid'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3" noValidate>
          <Field label="Full name" error={errors.name?.message}>
            <input className={inputClass} autoComplete="name" {...register('name')} />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input type="email" className={inputClass} autoComplete="email" {...register('email')} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Password" error={errors.password?.message}>
              <input type="password" className={inputClass} autoComplete="new-password" {...register('password')} />
            </Field>
            <Field label="Confirm password" error={errors.confirmPassword?.message}>
              <input
                type="password"
                className={inputClass}
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Age (optional)" error={errors.age?.message as string | undefined}>
              <input type="number" className={inputClass} {...register('age')} />
            </Field>
            <Field label="Blood type (optional)" error={errors.blood_type?.message as string | undefined}>
              <select className={inputClass} {...register('blood_type')}>
                <option value="">—</option>
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {selectedRole === 'donor' && (
            <Field label="Organ/tissue you're willing to donate (optional)">
              <select className={inputClass} {...register('organ_type')}>
                <option value="">—</option>
                {ORGAN_TYPES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="City (optional)">
              <input className={inputClass} {...register('city')} />
            </Field>
            <Field label="Phone (optional)">
              <input className={inputClass} {...register('phone')} />
            </Field>
          </div>

          {serverError && (
            <p role="alert" className="rounded-brand-sm bg-brand-red-light px-3 py-2 text-xs text-brand-red">
              {serverError}
            </p>
          )}

          <Captcha onVerify={setCaptchaToken} />

          <Button type="submit" fullWidth disabled={isSubmitting} className="mt-2">
            {isSubmitting ? 'Creating account…' : t('common.register')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-brand-gray">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/login" className="font-medium text-brand-teal-mid hover:underline">
            {t('common.signIn')}
          </Link>
        </p>
      </Card>
    </div>
  );
}

const inputClass =
  'w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-brand-navy">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-brand-red-mid">{error}</p>}
    </div>
  );
}
