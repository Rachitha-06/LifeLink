import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTriageAssist } from '@/hooks/useAI';

interface TriageAssistantProps {
  onSuggestion: (organ: string, urgency: string) => void;
}

/**
 * Advisory-only intake helper — never a diagnosis. Suggests a starting
 * point for the organ/urgency fields based on a free-text description;
 * the person still reviews and can change anything before submitting,
 * and the hospital makes the real determination regardless.
 */
export function TriageAssistant({ onSuggestion }: TriageAssistantProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const triage = useTriageAssist();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-teal-mid hover:underline"
      >
        Not sure what to select? Describe your situation for help.
      </button>
    );
  }

  return (
    <div className="rounded-brand-sm border border-brand-gray-border bg-brand-gray-light p-3">
      <p className="mb-2 text-xs text-brand-gray">
        This is a general starting-point suggestion, not a medical assessment. A hospital's
        medical team makes the actual determination — please also discuss your situation with
        your doctor.
      </p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Describe your situation in your own words…"
        className="w-full rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid"
      />
      <Button
        type="button"
        size="sm"
        className="mt-2"
        disabled={description.trim().length < 10 || triage.isPending}
        onClick={() => triage.mutate(description.trim())}
      >
        {triage.isPending ? 'Thinking…' : 'Get a suggestion'}
      </Button>

      {triage.data?.emergency && (
        <div className="mt-3 rounded-brand-sm bg-brand-red-light px-3 py-2 text-sm text-brand-red">
          <strong>{triage.data.message}</strong>
        </div>
      )}

      {triage.data && !triage.data.emergency && (
        <div className="mt-3 rounded-brand-sm bg-white px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="teal">{triage.data.suggested_organ}</Badge>
            <Badge color={triage.data.suggested_urgency === 'critical' ? 'red' : 'amber'}>
              {triage.data.suggested_urgency}
            </Badge>
          </div>
          <p className="mt-2 text-brand-navy">{triage.data.rationale}</p>
          <p className="mt-2 text-[11px] italic text-brand-gray">{triage.data.safety_note}</p>
          {triage.data.mock && (
            <p className="mt-1 text-[10px] italic text-brand-gray">
              (Demo response — connect an ANTHROPIC_API_KEY for real suggestions.)
            </p>
          )}
          <Button
            type="button"
            size="sm"
            variant="teal"
            className="mt-2"
            onClick={() => onSuggestion(triage.data!.suggested_organ!, triage.data!.suggested_urgency!)}
          >
            Use this suggestion
          </Button>
        </div>
      )}
    </div>
  );
}
