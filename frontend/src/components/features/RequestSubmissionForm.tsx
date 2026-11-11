import { useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FileUpload } from '@/components/ui/FileUpload';
import { TriageAssistant } from '@/components/features/TriageAssistant';
import { Badge } from '@/components/ui/Badge';
import { useHospitals } from '@/hooks/useHospitals';
import { useSubmitRequest, useUploadRequestDocument } from '@/hooks/useRecipients';
import { ApiError } from '@/api/client';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const ORGAN_TYPES = ['Blood', 'Kidney', 'Liver', 'Heart', 'Lungs', 'Pancreas', 'Cornea', 'Bone Marrow'] as const;
const URGENCY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

const schema = z.object({
  organ_needed: z.enum(ORGAN_TYPES, { message: 'Select what you need.' }),
  blood_type: z.enum(BLOOD_TYPES, { message: 'Select the required blood type.' }),
  urgency: z.enum(['low', 'medium', 'high', 'critical'], { message: 'Select an urgency level.' }),
  hospital_id: z.string().optional(),
  doctor_name: z.string().optional(),
  diagnosis: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  onDone: () => void;
}

export function RequestSubmissionForm({ onDone }: Props) {
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const { data: hospitals } = useHospitals();
  const submitRequest = useSubmitRequest();
  const uploadDocument = useUploadRequestDocument();

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const values = watch();

  const goNext = async () => {
    const valid = await trigger(step === 1 ? ['organ_needed', 'blood_type', 'urgency'] : []);
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (vals: FormValues) => {
    setServerError(null);
    try {
      const result = await submitRequest.mutateAsync(vals);
      setCreatedRequestId(result.request.request_id);
      setStep(4);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Card>
      <div className="mb-5 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${step >= n ? 'bg-brand-teal-mid' : 'bg-brand-gray-light'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-brand-navy">What do you need?</h3>
          <TriageAssistant
            onSuggestion={(organ, urgency) => {
              // Defensive: only apply the suggestion if it's actually one
              // of the values this form's <select>/radio options support
              // — the AI response is validated input, not trusted blindly,
              // same as any other external data reaching this form.
              if ((ORGAN_TYPES as readonly string[]).includes(organ)) {
                setValue('organ_needed', organ as (typeof ORGAN_TYPES)[number]);
              }
              if (['low', 'medium', 'high', 'critical'].includes(urgency)) {
                setValue('urgency', urgency as FormValues['urgency']);
              }
            }}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Organ / tissue needed</label>
            <select className={inputClass} {...register('organ_needed')}>
              <option value="">Select…</option>
              {ORGAN_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {errors.organ_needed && <p className="mt-1 text-xs text-brand-red-mid">{errors.organ_needed.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Required blood type</label>
            <select className={inputClass} {...register('blood_type')}>
              <option value="">Select…</option>
              {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
            </select>
            {errors.blood_type && <p className="mt-1 text-xs text-brand-red-mid">{errors.blood_type.message}</p>}
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-brand-navy">Urgency</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {URGENCY_LEVELS.map((u) => (
                <label key={u.value} className="cursor-pointer">
                  <input type="radio" value={u.value} className="peer sr-only" {...register('urgency')} />
                  <div className="rounded-brand-sm border border-brand-gray-border py-2 text-center text-xs font-medium text-brand-gray peer-checked:border-brand-teal-mid peer-checked:bg-brand-teal-light peer-checked:text-brand-teal">
                    {u.label}
                  </div>
                </label>
              ))}
            </div>
            {errors.urgency && <p className="mt-1 text-xs text-brand-red-mid">{errors.urgency.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Hospital (optional)</label>
            <select className={inputClass} {...register('hospital_id')}>
              <option value="">—</option>
              {hospitals?.map((h) => <option key={h.hospital_id} value={h.hospital_id}>{h.name} — {h.city}</option>)}
            </select>
          </div>
          <Button type="button" fullWidth onClick={goNext}>Continue</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-display text-lg font-semibold text-brand-navy">Medical context (optional)</h3>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Doctor's name</label>
            <input className={inputClass} {...register('doctor_name')} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Diagnosis</label>
            <textarea className={inputClass} rows={3} {...register('diagnosis')} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Additional notes</label>
            <textarea className={inputClass} rows={3} {...register('notes')} />
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
            <Row label="Needed" value={values.organ_needed} />
            <Row label="Blood type" value={values.blood_type} />
            <Row label="Urgency" value={<Badge color={values.urgency === 'critical' ? 'red' : 'amber'}>{values.urgency}</Badge>} />
            <Row label="Hospital" value={hospitals?.find((h) => h.hospital_id === values.hospital_id)?.name || 'Not specified'} />
          </dl>
          {serverError && (
            <p role="alert" className="rounded-brand-sm bg-brand-red-light px-3 py-2 text-xs text-brand-red">
              {serverError}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button type="submit" fullWidth disabled={submitRequest.isPending}>
              {submitRequest.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </div>
        </form>
      )}

      {step === 4 && createdRequestId && (
        <div className="space-y-4">
          <div className="rounded-brand-sm bg-brand-teal-light px-4 py-3 text-sm text-brand-teal">
            Request submitted. We'll notify you as soon as a compatible donor is found.
          </div>
          <FileUpload
            label="Attach a referral letter or diagnosis report (optional)"
            onUpload={(file) => uploadDocument.mutateAsync({ requestId: createdRequestId, file })}
          />
          <Button type="button" fullWidth variant="teal" onClick={onDone}>Done</Button>
        </div>
      )}
    </Card>
  );
}

const inputClass =
  'w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid';

function Row({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-brand-gray-border py-1.5">
      <dt className="text-brand-gray">{label}</dt>
      <dd className="font-medium text-brand-navy">{value}</dd>
    </div>
  );
}
