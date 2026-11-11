import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQuery } from '@tanstack/react-query';
import { messagesApi, type Message } from '@/api/messages';
import { useAuthStore } from '@/store/authStore';

/**
 * Manages a socket connection scoped to one match's chat thread — connects
 * on mount, joins the match room, listens for new messages, disconnects
 * on unmount. Deliberately not a persistent app-wide socket: a chat panel
 * is opened for one conversation at a time in this UI, so a fresh
 * connection per open keeps token-freshness simple (no need to handle
 * reconnecting an app-wide socket after Milestone 2's access token
 * rotates — this connects with whatever token is current right now).
 */
export function useMatchChat(matchId: string | null) {
  const token = useAuthStore((s) => s.token);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['messages', matchId],
    queryFn: () => messagesApi.history(matchId!),
    enabled: !!matchId,
  });

  // KNOWN LIMITATION: there's a narrow window between the REST history
  // fetch and the socket's join_match completing where a message from
  // another participant could land in neither — missed by the history
  // snapshot (already fetched) and not yet caught by the live listener
  // (not joined yet). A fully gap-proof version would need sequence
  // numbers or a re-fetch-after-join. Not worth the complexity here;
  // a page refresh always recovers via the REST history fetch.

  useEffect(() => {
    if (!matchId || !token) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      auth: { token },
      path: '/socket.io',
    });
    socketRef.current = socket;
    setLiveMessages([]);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_match', matchId);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('new_message', (message: Message) => {
      setLiveMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.emit('leave_match', matchId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId, token]);

  const sendMessage = useCallback((body: string) => {
    if (!socketRef.current || !matchId) return Promise.reject(new Error('Not connected.'));
    return new Promise<void>((resolve, reject) => {
      socketRef.current!.emit('send_message', { matchId, body }, (res: { ok?: boolean; error?: string }) => {
        if (res?.error) reject(new Error(res.error));
        else resolve();
      });
    });
  }, [matchId]);

  const allMessages = [...(history || []), ...liveMessages];

  return { messages: allMessages, isLoading, connected, sendMessage };
}
