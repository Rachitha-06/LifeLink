const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/hospitals — list hospitals, with optional geo-radius search.
// Any authenticated user can list/search hospitals (needed for donor and
// recipient registration forms to pick one) — only write actions below
// are admin-restricted.
router.get('/', authenticate, async (req, res, next) => {
  const { lat, lng, radius = 50, verified } = req.query;
  try {
    let query = 'SELECT * FROM hospitals WHERE 1=1';
    const params = [];
    let i = 1;

    if (verified !== undefined) {
      query += ` AND verified_status = $${i++}`;
      params.push(verified === 'true');
    }
    if (lat && lng) {
      // Haversine approximation for distance in km
      query += ` AND (6371 * acos(cos(radians($${i++})) * cos(radians(latitude))
                * cos(radians(longitude) - radians($${i++}))
                + sin(radians($${i - 2})) * sin(radians(latitude)))) < $${i++}`;
      params.push(parseFloat(lat), parseFloat(lng), parseFloat(radius));
    }
    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/hospitals/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM hospitals WHERE hospital_id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Hospital not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/hospitals — register a hospital
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  const { name, address, city, state, country, phone, email, latitude, longitude, hospital_type, license_number } = req.body;
  if (!name || !address || !city) {
    return res.status(400).json({ error: 'name, address, and city are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO hospitals
        (name, address, city, state, country, phone, email, latitude, longitude, hospital_type, license_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, address, city, state || null, country || 'India', phone || null, email || null,
        latitude || null, longitude || null, hospital_type || null, license_number || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/hospitals/:id/verify
router.patch('/:id/verify', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE hospitals SET verified_status = TRUE, verified_at = NOW(), verified_by = $1
       WHERE hospital_id = $2 RETURNING *`,
      [req.user.user_id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Hospital not found.' });
    res.json({ message: 'Hospital verified.', hospital: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
