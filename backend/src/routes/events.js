const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/events — public, upcoming events only. Discovery should be
// open (same reasoning as the public hospital list) — you shouldn't
// need an account just to see when the next blood drive is.
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.*, h.name AS hospital_name,
              COUNT(r.user_id) AS registration_count
       FROM blood_drive_events e
       JOIN hospitals h ON e.hospital_id = h.hospital_id
       LEFT JOIN event_registrations r ON e.event_id = r.event_id
       WHERE e.event_date >= NOW()
       GROUP BY e.event_id, h.name
       ORDER BY e.event_date ASC`
    );
    res.json(result.rows.map((e) => ({ ...e, registration_count: parseInt(e.registration_count, 10) })));
  } catch (err) {
    next(err);
  }
});

// POST /api/events — hospital staff/admin only
router.post('/', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  const { hospital_id, title, description, event_date, city, latitude, longitude } = req.body;
  if (!hospital_id || !title || !event_date) {
    return res.status(400).json({ error: 'hospital_id, title, and event_date are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO blood_drive_events (hospital_id, title, description, event_date, city, latitude, longitude, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [hospital_id, title, description || null, event_date, city || null,
        latitude || null, longitude || null, req.user.user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/register — express interest. Idempotent: already
// registered just confirms rather than erroring, so a double-tap on a
// slow connection isn't a visible failure.
router.post('/:id/register', authenticate, async (req, res, next) => {
  try {
    await pool.query(
      `INSERT INTO event_registrations (event_id, user_id) VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [req.params.id, req.user.user_id]
    );
    res.json({ message: "You're registered for this event." });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id/register — unregister
router.delete('/:id/register', authenticate, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2', [req.params.id, req.user.user_id]);
    res.json({ message: 'Registration cancelled.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/events/mine — events the current user has registered for,
// used to show "You're registered" state without a separate lookup per card.
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT event_id FROM event_registrations WHERE user_id = $1',
      [req.user.user_id]
    );
    res.json(result.rows.map((r) => r.event_id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
