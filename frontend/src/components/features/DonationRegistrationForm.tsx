import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { useHospitals } from '@/hooks/useHospitals';
import { useRegisterDonation, useUploadDonationDocument } from '@/hooks/useDonors';
import { ApiError } from '@/api/client';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const ORGAN_TYPES = ['Blood', 'Kidney', 'Liver', 'Heart', 'Lungs', 'Pancreas', 'Cornea', 'Bone Marrow'] as const;

const schema = z.object({
  organ_type: z.enum(ORGAN_TYPES, { message: 'Select what you\'d like to donate.' }),
  blood_type: z.enum(BLOOD_TYPES, { message: 'Select your blood type.' }),
  hospital_id: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  onDone: () => void;
}

/**
 * 3-step wizard: Step 1 (what/blood type/hospital) -> Step 2 (notes) ->
 * Step 3 (review, submit, then an optional document upload against the
 * donation record that submission just created).
 */
export function DonationRegistrationForm({ onDone }: Props) {
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdDonationId, setCreatedDonationId] = useState<string | null>(null);

  const { data: hospitals } = useHospitals();
  const registerDonation = useRegisterDonation();
  const uploadDocument = useUploadDonationDocument();

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const values = watch();

  const goNext = async () => {
    const fieldsForStep: Record<number, (keyof FormValues)[]> = {
      1: ['organ_type', 'blood_type'],
      2: [],
    };
    const valid = await trigger(fieldsForStep[step] ?? []);
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (vals: FormValues) => {
    setServerError(null);
    try {
      const result = await registerDonation.mutateAsync(vals);
      setCreatedDonationId(result.donation.donation_id);
      setStep(4); // success + optional upload step
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Card>
      <div className="mb-5 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full ${step >= n ? 'bg-brand-teal-mid' : 'bg-brand-gray-light'}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-brand-navy">What would you like to donate?</h3>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Organ / tissue</label>
            <select className={inputClass} {...register('organ_type')}>
              <option value="">Select…</option>
              {ORGAN_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            {errors.organ_type && <p className="mt-1 text-xs text-brand-red-mid">{errors.organ_type.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Blood type</label>
            <select className={inputClass} {...register('blood_type')}>
              <option value="">Select…</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
            {errors.blood_type && <p className="mt-1 text-xs text-brand-red-mid">{errors.blood_type.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Preferred hospital (optional)</label>
            <select className={inputClass} {...register('hospital_id')}>
              <option value="">—</option>
              {hospitals?.map((h) => (
                <option key={h.hospital_id} value={h.hospital_id}>{h.name} — {h.city}</option>
              ))}
            </select>
          </div>
          <Button type="button" fullWidth onClick={goNext}>Continue</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-brand-navy">Anything else to add?</h3>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Notes (optional)</label>
            <textarea
              className={inputClass}
              rows={4}
              placeholder="Medical history, availability, anything the coordinating hospital should know."
              {...register('notes')}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" fullWidth onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-brand-navy">Review and submit</h3>
          <dl className="space-y-1.5 text-sm">
            <Row label="Donating" value={values.organ_type} />
            <Row label="Blood type" value={values.blood_type} />
            <Row label="Hospital" value={hospitals?.find((h) => h.hospital_id === values.hospital_id)?.name || 'Not specified'} />
            <Row label="Notes" value={values.notes || '—'} />
          </dl>
          {serverError && (
            <p role="alert" className="rounded-brand-sm bg-brand-red-light px-3 py-2 text-xs text-brand-red">
              {serverError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button type="submit" fullWidth disabled={registerDonation.isPending}>
              {registerDonation.isPending ? 'Submitting…' : 'Submit donation'}
            </Button>
          </div>
        </form>
      )}

      {step === 4 && createdDonationId && (
        <div className="space-y-4">
          <div className="rounded-brand-sm bg-brand-teal-light px-4 py-3 text-sm text-brand-teal">
            Donation registered. A hospital coordinator will review it next.
          </div>
          <FileUpload
            label="Attach a medical report or scan (optional)"
            onUpload={(file) => uploadDocument.mutateAsync({ donationId: createdDonationId, file })}
          />
          <Button type="button" fullWidth variant="teal" onClick={onDone}>Done</Button>
        </div>
      )}
    </Card>
  );
}

const inputClass =
  'w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid';

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-brand-gray-border py-1.5">
      <dt className="text-brand-gray">{label}</dt>
      <dd className="font-medium text-brand-navy">{value}</dd>
    </div>
  );
}
