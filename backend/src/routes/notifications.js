const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — current user's notifications, paginated
//
// NOTE: this is deliberately minimal for now (list + mark-as-read). The
// full notification preference center (per-category email/SMS toggles)
// is Milestone 6 — needs a notification_preferences table that doesn't
// exist yet. This unblocks the server.js crash and gives the frontend
// something real to render for Milestone 1.
router.get('/', authenticate, async (req, res, next) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (page - 1) * limit;

  try {
    const conditions = ['user_id = $1'];
    const values = [req.user.user_id];
    if (unread_only === 'true') conditions.push('is_read = FALSE');

    values.push(limit, offset);
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    // values currently ends in [..., limit, offset] — count query needs
    // everything except those last two.
    const countValues = values.slice(0, -2);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE ${conditions.join(' AND ')}`,
      countValues
    );

    res.json({
      notifications: result.rows,
      page: +page,
      limit: +limit,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE notification_id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.user_id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/notifications/preferences
router.get('/preferences', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM notification_preferences WHERE user_id = $1', [req.user.user_id]);
    if (!result.rows.length) {
      // No row yet — return defaults rather than 404; everyone has
      // preferences even before they've customized them.
      return res.json({ user_id: req.user.user_id, email_enabled: true, sms_enabled: true, categories: {} });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/preferences — upsert
router.put('/preferences', authenticate, async (req, res, next) => {
  const { email_enabled, sms_enabled, categories } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled, categories, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         email_enabled = EXCLUDED.email_enabled,
         sms_enabled = EXCLUDED.sms_enabled,
         categories = EXCLUDED.categories,
         updated_at = NOW()
       RETURNING *`,
      [req.user.user_id, email_enabled ?? true, sms_enabled ?? true, JSON.stringify(categories || {})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
