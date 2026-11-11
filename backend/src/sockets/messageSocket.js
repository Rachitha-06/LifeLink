const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const env = require('../config/env');
const { isMatchParticipant, createMessage } = require('../services/messageService');

/**
 * Attaches Socket.io to the existing HTTP server. Auth mirrors the REST
 * access-token check (same JWT, same secret) — a socket connection is
 * just another way to hit the API, so it gets the same bar. Room
 * membership is verified server-side on join AND re-verified on every
 * send, not just trusted from the join step — a client that joined
 * while a legitimate participant shouldn't keep sending after losing
 * access (e.g. a match reassigned, or an admin session expiring).
 */
function attachMessageSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required.'));
      socket.user = jwt.verify(token, env.jwt.secret);
      next();
    } catch {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_match', async (matchId, callback) => {
      try {
        const allowed = await isMatchParticipant(matchId, socket.user.user_id, socket.user.role);
        if (!allowed) {
          return callback?.({ error: 'You do not have access to this conversation.' });
        }
        socket.join(`match:${matchId}`);
        callback?.({ ok: true });
      } catch (err) {
        callback?.({ error: 'Something went wrong joining the conversation.' });
      }
    });

    socket.on('send_message', async ({ matchId, body }, callback) => {
      try {
        if (!body || !body.trim()) {
          return callback?.({ error: 'Message cannot be empty.' });
        }
        const allowed = await isMatchParticipant(matchId, socket.user.user_id, socket.user.role);
        if (!allowed) {
          return callback?.({ error: 'You do not have access to this conversation.' });
        }

        const message = await createMessage(matchId, socket.user.user_id, body.trim());
        io.to(`match:${matchId}`).emit('new_message', message);
        callback?.({ ok: true, message });
      } catch (err) {
        callback?.({ error: 'Failed to send message.' });
      }
    });

    socket.on('leave_match', (matchId) => {
      socket.leave(`match:${matchId}`);
    });
  });

  return io;
}

module.exports = { attachMessageSocket };
