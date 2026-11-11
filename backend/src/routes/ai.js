const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { isMatchParticipant } = require('../services/messageService');
const { explainMatch, triageAssist } = require('../services/aiService');

const router = express.Router();

// AI calls cost real money per request — a tighter cap than the general
// 100/15min API limiter, separate from auth's login-attempt limiter.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests. Please try again in a few minutes.' },
});
router.use(aiLimiter);

// POST /api/ai/explain-match/:matchId
router.post('/explain-match/:matchId', authenticate, async (req, res, next) => {
  try {
    const allowed = await isMatchParticipant(req.params.matchId, req.user.user_id, req.user.role);
    if (!allowed) return res.status(403).json({ error: 'You do not have access to this match.' });

    const result = await pool.query(
      `SELECT m.compatibility_score, m.requires_crossmatch,
              don.organ_type, don.blood_type AS donor_blood, don.city AS donor_city, don.state AS donor_state,
              r.blood_type AS recipient_blood, u.city AS recipient_city, u.state AS recipient_state
       FROM matches m
       JOIN donations don ON m.donation_id = don.donation_id
       JOIN requests r ON m.request_id = r.request_id
       JOIN users u ON r.recipient_id = u.user_id
       WHERE m.match_id = $1`,
      [req.params.matchId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Match not found.' });
    const row = result.rows[0];

    const explanation = await explainMatch({
      organType: row.organ_type,
      donorBloodType: row.donor_blood,
      recipientBloodType: row.recipient_blood,
      score: row.compatibility_score,
      sameCityOrState: row.donor_city === row.recipient_city || row.donor_state === row.recipient_state,
      requiresCrossmatch: row.requires_crossmatch,
    });

    res.json(explanation);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/triage-assist
router.post('/triage-assist', authenticate, async (req, res, next) => {
  const { description } = req.body;
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: 'Please describe your situation in at least a few words.' });
  }
  if (description.length > 2000) {
    return res.status(400).json({ error: 'Description is too long (max 2000 characters).' });
  }

  try {
    const result = await triageAssist(description.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
