import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useHospitals } from '@/hooks/useHospitals';
import { useCreateEvent } from '@/hooks/useEvents';
import { ApiError } from '@/api/client';

const schema = z.object({
  hospital_id: z.string().min(1, 'Select a hospital.'),
  title: z.string().min(3, 'Enter a title.'),
  description: z.string().optional(),
  event_date: z.string().min(1, 'Select a date and time.'),
  city: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CreateEventForm({ onDone }: { onDone: () => void }) {
  const { data: hospitals } = useHospitals();
  const createEvent = useCreateEvent();
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await createEvent.mutateAsync({
        ...values,
        event_date: new Date(values.event_date).toISOString(),
      });
      onDone();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Failed to create event.');
    }
  };

  return (
    <Card>
      <h3 className="mb-4 font-display text-lg font-semibold text-brand-navy">New blood drive event</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">Hospital</label>
          <select className={inputClass} {...register('hospital_id')}>
            <option value="">Select…</option>
            {hospitals?.map((h) => <option key={h.hospital_id} value={h.hospital_id}>{h.name}</option>)}
          </select>
          {errors.hospital_id && <p className="mt-1 text-xs text-brand-red-mid">{errors.hospital_id.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">Title</label>
          <input className={inputClass} placeholder="Community Blood Drive" {...register('title')} />
          {errors.title && <p className="mt-1 text-xs text-brand-red-mid">{errors.title.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">Date & time</label>
          <input type="datetime-local" className={inputClass} {...register('event_date')} />
          {errors.event_date && <p className="mt-1 text-xs text-brand-red-mid">{errors.event_date.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">City (optional)</label>
          <input className={inputClass} {...register('city')} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">Description (optional)</label>
          <textarea className={inputClass} rows={3} {...register('description')} />
        </div>
        {serverError && (
          <p role="alert" className="rounded-brand-sm bg-brand-red-light px-3 py-2 text-xs text-brand-red">
            {serverError}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create event'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

const inputClass =
  'w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid';
