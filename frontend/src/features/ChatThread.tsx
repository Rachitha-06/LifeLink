import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMatchChat } from '@/hooks/useMatchChat';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

interface ChatThreadProps {
  matchId: string;
  onClose: () => void;
}

export function ChatThread({ matchId, onClose }: ChatThreadProps) {
  const currentUserId = useAuthStore((s) => s.user?.user_id);
  const { messages, isLoading, connected, sendMessage } = useMatchChat(matchId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Focus moves into the dialog on open (the input, since that's the
  // most likely next action) and Escape closes it — both expected
  // behavior for any modal dialog, not just a nice-to-have.
  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    setError(null);
    try {
      await sendMessage(draft.trim());
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-thread-title"
        className="flex h-[85vh] max-h-[520px] w-full max-w-md flex-col rounded-brand bg-white shadow-brand-lg"
      >
        <div className="flex items-center justify-between border-b border-brand-gray-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span id="chat-thread-title" className="text-sm font-semibold text-brand-navy">
              Conversation
            </span>
            <span
              className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-brand-green' : 'bg-brand-gray')}
              aria-label={connected ? 'Connected' : 'Disconnected'}
              role="status"
            />
          </div>
          <button onClick={onClose} className="text-brand-gray hover:text-brand-navy" aria-label="Close conversation">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
          {isLoading && (
            <>
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="ml-auto h-10 w-2/3" />
            </>
          )}
          {!isLoading && messages.length === 0 && (
            <p className="mt-8 text-center text-xs text-brand-gray">
              No messages yet — say hello to get things started.
            </p>
          )}
          {messages.map((m) => {
            const isMine = m.sender_id === currentUserId;
            return (
              <div key={m.message_id} className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    'max-w-[75%] rounded-brand-sm px-3 py-2 text-sm',
                    isMine ? 'bg-brand-teal-mid text-white' : 'bg-brand-gray-light text-brand-navy'
                  )}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 text-[10px] text-brand-gray">
                  {isMine ? 'You' : m.sender_name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p role="alert" className="px-4 text-xs text-brand-red-mid">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-brand-gray-border p-3">
          <label htmlFor="chat-message-input" className="sr-only">
            Type a message
          </label>
          <input
            id="chat-message-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message…"
            className="flex-1 rounded-brand-sm border border-brand-gray-border px-3 py-2 text-sm focus-visible:border-brand-teal-mid"
          />
          <Button size="sm" onClick={handleSend} disabled={!draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
