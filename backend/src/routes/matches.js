const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendMatchNotification } = require('../services/notificationService');
const {
  findCandidates,
  createMatch,
  logStatusChange,
  fetchExistingPairs,
  fetchAvailableDonors,
  isCompatible,
} = require('../services/matchingService');
const { isMatchParticipant, getMessages, createMessage } = require('../services/messageService');

const router = express.Router();

// POST /api/matches/run — run matching for pending requests. Single
// best match per request (topN=1) — the SOS broadcast-to-multiple
// behavior for critical requests lives in recipients.js instead, fired
// automatically at request creation, not from this manual endpoint.
router.post('/run', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  const { request_id } = req.body;

  try {
    const reqFilter = request_id ? 'AND r.request_id = $1' : '';
    const reqParams = request_id ? [request_id] : [];

    const requests = await pool.query(
      `SELECT r.*, u.city, u.state
       FROM requests r JOIN users u ON r.recipient_id = u.user_id
       WHERE r.status = 'pending' ${reqFilter}
       ORDER BY CASE r.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                               WHEN 'medium' THEN 3 ELSE 4 END`,
      reqParams
    );

    const donors = await fetchAvailableDonors(pool);
    const existingPairs = await fetchExistingPairs(pool);
    const usedDonors = new Set();
    const newMatches = [];

    for (const request of requests.rows) {
      const [best] = findCandidates(request, donors, existingPairs, usedDonors, 1);
      if (!best) continue;

      const match = await createMatch(pool, best.donor.donation_id, request.request_id, best.score, request.organ_needed);
      await pool.query(`UPDATE requests SET status = 'matched' WHERE request_id = $1`, [request.request_id]);

      usedDonors.add(best.donor.donation_id);
      existingPairs.add(`${best.donor.donation_id}:${request.request_id}`);
      newMatches.push(match);

      await sendMatchNotification(pool, best.donor.donor_id, request.recipient_id, request.organ_needed, best.score);
    }

    res.json({
      message: `Matching complete. Found ${newMatches.length} new candidate suggestion(s).`,
      matches: newMatches,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/matches
router.get('/', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.*,
              ud.name AS donor_name, ud.blood_type AS donor_blood,
              ur.name AS recipient_name,
              r.organ_needed, r.urgency,
              h.name AS hospital_name
       FROM matches m
       JOIN donations don ON m.donation_id = don.donation_id
       JOIN users ud ON don.donor_id = ud.user_id
       JOIN requests r ON m.request_id = r.request_id
       JOIN users ur ON r.recipient_id = ur.user_id
       LEFT JOIN hospitals h ON m.hospital_id = h.hospital_id
       ORDER BY m.match_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/matches/:id/timeline — powers the visual status stepper
router.get('/:id/timeline', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT h.*, u.name AS changed_by_name
       FROM match_status_history h
       LEFT JOIN users u ON h.changed_by = u.user_id
       WHERE h.match_id = $1
       ORDER BY h.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/matches/:id/start-review — organ matches only.
router.patch('/:id/start-review', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM matches WHERE match_id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Match not found.' });
    const match = existing.rows[0];

    if (!match.requires_crossmatch) {
      return res.status(400).json({ error: 'This is a blood match — it can be confirmed directly without medical review.' });
    }
    if (match.status !== 'pending') {
      return res.status(400).json({ error: `Cannot start medical review from status "${match.status}".` });
    }

    const result = await pool.query(
      `UPDATE matches SET status = 'medical_review', updated_at = NOW() WHERE match_id = $1 RETURNING *`,
      [req.params.id]
    );
    await logStatusChange(pool, req.params.id, 'medical_review', req.user.user_id, req.body.note || null);

    res.json({ message: 'Moved to medical review.', match: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/matches/:id/confirm
router.patch('/:id/confirm', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT * FROM matches WHERE match_id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Match not found.' });
    const match = existing.rows[0];

    if (match.requires_crossmatch && match.status !== 'medical_review') {
      return res.status(400).json({
        error: 'Organ matches must complete medical review before they can be confirmed.',
      });
    }

    const result = await pool.query(
      `UPDATE matches SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
       WHERE match_id = $1 RETURNING *`,
      [req.params.id]
    );
    await logStatusChange(pool, req.params.id, 'confirmed', req.user.user_id, req.body.note || null);

    res.json({
      message: match.requires_crossmatch ? 'Approved for medical workup.' : 'Match confirmed.',
      match: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/matches/compatible/:requestId
router.get('/compatible/:requestId', authenticate, async (req, res, next) => {
  try {
    const request = await pool.query('SELECT * FROM requests WHERE request_id = $1', [req.params.requestId]);
    if (!request.rows.length) return res.status(404).json({ error: 'Request not found.' });
    const r = request.rows[0];

    const donors = await pool.query(
      `SELECT u.name, u.city, u.state, d.blood_type, d.organ_type, d.donation_id, d.status
       FROM donations d JOIN users u ON d.donor_id = u.user_id
       WHERE d.organ_type = $1 AND (d.status = 'available' OR d.status = 'verified')`,
      [r.organ_needed]
    );
    const compatible = donors.rows.filter((d) => isCompatible(d.blood_type, r.blood_type));
    res.json({ request: r, compatible_donors: compatible });
  } catch (err) {
    next(err);
  }
});

// GET /api/matches/:id/messages — history. Real-time delivery happens
// over Socket.io (see sockets/messageSocket.js); this REST endpoint is
// what loads the thread when a chat panel first opens.
router.get('/:id/messages', authenticate, async (req, res, next) => {
  try {
    const allowed = await isMatchParticipant(req.params.id, req.user.user_id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'You do not have access to this conversation.' });

    const messages = await getMessages(req.params.id);
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

// POST /api/matches/:id/messages — REST fallback for sending (the
// primary path is the socket 'send_message' event, which calls the same
// messageService.createMessage under the hood — this exists so the
// thread still works if a client's socket connection is down).
router.post('/:id/messages', authenticate, async (req, res, next) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Message body is required.' });
  }
  try {
    const allowed = await isMatchParticipant(req.params.id, req.user.user_id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'You do not have access to this conversation.' });

    const message = await createMessage(req.params.id, req.user.user_id, body.trim());
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
