import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useExplainMatch } from '@/hooks/useAI';

export function MatchExplanation({ matchId }: { matchId: string }) {
  const [shown, setShown] = useState(false);
  const explainMatch = useExplainMatch();

  if (!shown) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setShown(true);
          explainMatch.mutate(matchId);
        }}
      >
        Why was this suggested?
      </Button>
    );
  }

  return (
    <div className="rounded-brand-sm bg-brand-gray-light px-3 py-2 text-xs text-brand-navy">
      {explainMatch.isPending && <span className="text-brand-gray">Thinking…</span>}
      {explainMatch.data && (
        <>
          <p>{explainMatch.data.explanation}</p>
          {explainMatch.data.mock && (
            <p className="mt-1 text-[10px] italic text-brand-gray">
              (Demo response — connect an ANTHROPIC_API_KEY for real explanations.)
            </p>
          )}
        </>
      )}
      {explainMatch.isError && (
        <span className="text-brand-red-mid">Couldn't load an explanation right now.</span>
      )}
    </div>
  );
}
