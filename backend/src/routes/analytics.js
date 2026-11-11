const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/public-impact — unauthenticated, powers the public
// landing page counter. Aggregate counts only, nothing personally
// identifying.
router.get('/public-impact', async (req, res, next) => {
  try {
    const [donors, matches, hospitals, cities] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'donor' AND is_active = TRUE"),
      pool.query("SELECT COUNT(*) FROM matches WHERE status = 'completed'"),
      pool.query('SELECT COUNT(*) FROM hospitals WHERE verified_status = TRUE'),
      pool.query("SELECT COUNT(DISTINCT city) FROM hospitals WHERE city IS NOT NULL"),
    ]);
    res.json({
      registered_donors: parseInt(donors.rows[0].count, 10),
      lives_connected: parseInt(matches.rows[0].count, 10),
      partner_hospitals: parseInt(hospitals.rows[0].count, 10),
      cities_covered: parseInt(cities.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/dashboard — monthly trend data for the admin
// analytics tab: requests and completed matches, last 6 months.
router.get('/dashboard', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  try {
    const [requestsTrend, matchesTrend, byUrgency, byOrgan] = await Promise.all([
      pool.query(`
        SELECT to_char(date_trunc('month', request_date), 'YYYY-MM') AS month, COUNT(*) AS count
        FROM requests
        WHERE request_date > NOW() - INTERVAL '6 months'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT to_char(date_trunc('month', match_date), 'YYYY-MM') AS month, COUNT(*) AS count
        FROM matches
        WHERE match_date > NOW() - INTERVAL '6 months'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT urgency, COUNT(*) AS count FROM requests
        WHERE status != 'cancelled' GROUP BY urgency
      `),
      pool.query(`
        SELECT organ_needed, COUNT(*) AS count FROM requests
        WHERE status != 'cancelled' GROUP BY organ_needed ORDER BY count DESC LIMIT 8
      `),
    ]);

    res.json({
      requestsByMonth: requestsTrend.rows.map((r) => ({ month: r.month, count: parseInt(r.count, 10) })),
      matchesByMonth: matchesTrend.rows.map((r) => ({ month: r.month, count: parseInt(r.count, 10) })),
      requestsByUrgency: byUrgency.rows.map((r) => ({ urgency: r.urgency, count: parseInt(r.count, 10) })),
      requestsByOrgan: byOrgan.rows.map((r) => ({ organ: r.organ_needed, count: parseInt(r.count, 10) })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/hospital-map — hospital locations plus a count of
// their pending/critical requests, for the map view. Deliberately
// aggregated by hospital (an institution) rather than by individual
// donor/recipient — plotting precise personal home coordinates, even to
// an admin, would be a real re-identification/privacy risk on a health
// platform. Requests with no hospital_id assigned aren't mappable this
// way and are surfaced as a separate "unassigned" count instead.
router.get('/hospital-map', authenticate, async (req, res, next) => {
  try {
    const hospitals = await pool.query(`
      SELECT h.hospital_id, h.name, h.city, h.latitude, h.longitude, h.verified_status,
             COUNT(r.request_id) FILTER (WHERE r.status IN ('pending', 'reviewing')) AS pending_requests,
             COUNT(r.request_id) FILTER (WHERE r.status IN ('pending', 'reviewing') AND r.urgency = 'critical') AS critical_requests
      FROM hospitals h
      LEFT JOIN requests r ON r.hospital_id = h.hospital_id
      WHERE h.latitude IS NOT NULL AND h.longitude IS NOT NULL
      GROUP BY h.hospital_id
    `);

    const unassigned = await pool.query(
      `SELECT COUNT(*) FROM requests WHERE hospital_id IS NULL AND status IN ('pending', 'reviewing')`
    );

    res.json({
      hospitals: hospitals.rows.map((h) => ({
        ...h,
        pending_requests: parseInt(h.pending_requests, 10),
        critical_requests: parseInt(h.critical_requests, 10),
      })),
      unassigned_requests: parseInt(unassigned.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
