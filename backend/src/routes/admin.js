const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/stats — dashboard stats
router.get('/stats', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  try {
    const [donors, requests, matches, hospitals, pending] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'donor'"),
      pool.query("SELECT COUNT(*) FROM requests WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) FROM matches WHERE status = 'confirmed'"),
      pool.query('SELECT COUNT(*) FROM hospitals WHERE verified_status = TRUE'),
      pool.query('SELECT COUNT(*) FROM hospitals WHERE verified_status = FALSE'),
    ]);
    res.json({
      total_donors: parseInt(donors.rows[0].count, 10),
      pending_requests: parseInt(requests.rows[0].count, 10),
      successful_matches: parseInt(matches.rows[0].count, 10),
      verified_hospitals: parseInt(hospitals.rows[0].count, 10),
      pending_verifications: parseInt(pending.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
router.get('/users', authenticate, authorize('admin'), async (req, res, next) => {
  const { role, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const result = await pool.query(
      `SELECT user_id, name, email, role, age, blood_type, city, is_active, created_at
       FROM users
       WHERE ($1::text IS NULL OR role = $1)
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [role || null, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id/toggle
router.patch('/users/:id/toggle', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE user_id = $1 RETURNING user_id, name, is_active',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT al.*, u.name AS user_name, u.email
       FROM audit_logs al LEFT JOIN users u ON al.user_id = u.user_id
       ORDER BY al.created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
