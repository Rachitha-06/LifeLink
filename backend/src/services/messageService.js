const pool = require('../config/db');

/**
 * Checks whether a user is allowed to see/send messages on a match's
 * thread: the donor, the recipient, or hospital staff/admin. Shared
 * between the REST routes and the Socket.io layer so the same rule is
 * enforced in both places instead of drifting.
 */
async function isMatchParticipant(matchId, userId, role) {
  if (role === 'admin' || role === 'hospital_admin') return true;

  const result = await pool.query(
    `SELECT don.donor_id, r.recipient_id
     FROM matches m
     JOIN donations don ON m.donation_id = don.donation_id
     JOIN requests r ON m.request_id = r.request_id
     WHERE m.match_id = $1`,
    [matchId]
  );
  if (!result.rows.length) return false;

  const { donor_id, recipient_id } = result.rows[0];
  if (role === 'donor') return donor_id === userId;
  if (role === 'recipient') return recipient_id === userId;
  return false;
}

async function getMessages(matchId) {
  const result = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.role AS sender_role
     FROM messages m JOIN users u ON m.sender_id = u.user_id
     WHERE m.match_id = $1
     ORDER BY m.created_at ASC`,
    [matchId]
  );
  return result.rows;
}

async function createMessage(matchId, senderId, body) {
  const result = await pool.query(
    `INSERT INTO messages (match_id, sender_id, body) VALUES ($1, $2, $3)
     RETURNING *`,
    [matchId, senderId, body]
  );
  const withSender = await pool.query(
    `SELECT m.*, u.name AS sender_name, u.role AS sender_role
     FROM messages m JOIN users u ON m.sender_id = u.user_id
     WHERE m.message_id = $1`,
    [result.rows[0].message_id]
  );
  return withSender.rows[0];
}

module.exports = { isMatchParticipant, getMessages, createMessage };
