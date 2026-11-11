const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadDocument } = require('../services/uploadService');

const router = express.Router();

// GET /api/donors — list donors (admin/hospital view)
router.get('/', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  const { blood_type, organ_type, city, status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const conditions = ["u.role = 'donor'"];
  const values = [];
  let i = 1;

  if (blood_type) { conditions.push(`u.blood_type = $${i++}`); values.push(blood_type); }
  if (organ_type) { conditions.push(`u.organ_type = $${i++}`); values.push(organ_type); }
  if (city) { conditions.push(`u.city ILIKE $${i++}`); values.push(`%${city}%`); }
  if (status) { conditions.push(`don.status = $${i++}`); values.push(status); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  values.push(limit, offset);

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.name, u.age, u.blood_type, u.organ_type, u.city, u.phone,
              don.donation_id, don.status, don.donation_date, don.next_eligible_date,
              h.name AS hospital_name
       FROM users u
       LEFT JOIN donations don ON u.user_id = don.donor_id
       LEFT JOIN hospitals h ON don.hospital_id = h.hospital_id
       ${where}
       ORDER BY (don.status = 'available') DESC, u.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      values
    );
    res.json({ donors: result.rows, page: +page, limit: +limit });
  } catch (err) {
    next(err);
  }
});

// GET /api/donors/my-donations — the current donor's own donation history.
// Registered BEFORE /:id below: Express matches routes in registration
// order, and /:id would otherwise swallow this path, treating
// "my-donations" as the :id value.
router.get('/my-donations', authenticate, authorize('donor'), async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const result = await pool.query(
      `SELECT d.*, h.name AS hospital_name,
              m.match_id, m.status AS match_status, m.compatibility_score, m.requires_crossmatch
       FROM donations d
       LEFT JOIN hospitals h ON d.hospital_id = h.hospital_id
       LEFT JOIN LATERAL (
         SELECT * FROM matches
         WHERE donation_id = d.donation_id AND status NOT IN ('failed','cancelled')
         ORDER BY match_date DESC
         LIMIT 1
       ) m ON TRUE
       WHERE d.donor_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.user_id, limit, offset]
    );
    const countResult = await pool.query('SELECT COUNT(*) FROM donations WHERE donor_id = $1', [req.user.user_id]);
    res.json({
      donations: result.rows,
      page: +page,
      limit: +limit,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/donors/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.*, don.*, h.name AS hospital_name
       FROM users u
       LEFT JOIN donations don ON u.user_id = don.donor_id
       LEFT JOIN hospitals h ON u.hospital_id = h.hospital_id
       WHERE u.user_id = $1 AND u.role = 'donor'`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Donor not found.' });

    const donor = result.rows[0];
    delete donor.password_hash;
    res.json(donor);
  } catch (err) {
    next(err);
  }
});

// POST /api/donors/register — donor submits a donation
router.post('/register', authenticate, authorize('donor', 'admin'), async (req, res, next) => {
  const { organ_type, blood_type, hospital_id, notes } = req.body;
  if (!organ_type || !blood_type) {
    return res.status(400).json({ error: 'organ_type and blood_type are required.' });
  }

  try {
    const isBlood = organ_type.toLowerCase() === 'blood';

    if (isBlood) {
      const last = await pool.query(
        `SELECT donation_date FROM donations
         WHERE donor_id = $1 AND organ_type = 'Blood' AND status = 'completed'
         ORDER BY donation_date DESC LIMIT 1`,
        [req.user.user_id]
      );
      if (last.rows.length) {
        const daysSince = Math.floor((Date.now() - new Date(last.rows[0].donation_date)) / 86400000);
        if (daysSince < 90) {
          return res.status(400).json({
            error: `Not eligible yet. ${90 - daysSince} days remaining before next blood donation.`,
          });
        }
      }
    }

    const nextEligible = isBlood
      ? new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
      : null;

    const result = await pool.query(
      `INSERT INTO donations (donor_id, organ_type, blood_type, hospital_id, notes, next_eligible_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [req.user.user_id, organ_type, blood_type, hospital_id || null, notes || null,
        nextEligible, isBlood ? 'available' : 'pending']
    );
    res.status(201).json({ message: 'Donation registered successfully.', donation: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/donors/:donationId/verify — hospital/admin verifies a donation
router.patch('/:donationId/verify', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  const { status, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE donations SET status = $1, notes = $2, verified_by = $3, verified_at = NOW()
       WHERE donation_id = $4 RETURNING *`,
      [status, notes || null, req.user.user_id, req.params.donationId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Donation not found.' });

    const donation = result.rows[0];

    if (status === 'verified') {
      // FIX: previously interpolated req.body.organ_type directly into the SQL
      // string (SQL injection risk) and trusted client input for the organ
      // type rather than the actual donation record. Now uses the organ_type
      // already returned from the UPDATE above, passed as a bound parameter.
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, 'donation_verified', 'Donation Verified!', $2)`,
        [
          donation.donor_id,
          `Your ${donation.organ_type || 'organ'} donation has been verified. You are now available for matching.`,
        ]
      );
    }

    res.json({ message: `Donation ${status}.`, donation });
  } catch (err) {
    next(err);
  }
});

// GET /api/donors/eligibility/:userId
router.get('/eligibility/:userId', authenticate, async (req, res, next) => {
  try {
    const last = await pool.query(
      `SELECT donation_date, organ_type FROM donations
       WHERE donor_id = $1 AND status = 'completed'
       ORDER BY donation_date DESC LIMIT 5`,
      [req.params.userId]
    );
    const bloodLast = last.rows.find((r) => r.organ_type.toLowerCase() === 'blood');
    const daysSince = bloodLast
      ? Math.floor((Date.now() - new Date(bloodLast.donation_date)) / 86400000)
      : Infinity;

    res.json({
      bloodEligible: daysSince >= 90,
      daysSinceLastBlood: daysSince === Infinity ? null : daysSince,
      nextBloodEligibleDate: bloodLast
        ? new Date(new Date(bloodLast.donation_date).getTime() + 90 * 86400000).toISOString().split('T')[0]
        : 'Eligible now',
      organEligible: true, // requires hospital verification separately
      history: last.rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/donors/:donationId/documents — upload a medical report/scan
// for a donation. Donor may only upload to their own donation; admin can
// upload on behalf of anyone (e.g. entering a paper record).
router.post(
  '/:donationId/documents',
  authenticate,
  authorize('donor', 'admin'),
  upload.single('document'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Field name must be "document".' });
    }
    try {
      const donation = await pool.query('SELECT donor_id FROM donations WHERE donation_id = $1', [
        req.params.donationId,
      ]);
      if (!donation.rows.length) return res.status(404).json({ error: 'Donation not found.' });
      if (req.user.role === 'donor' && donation.rows[0].donor_id !== req.user.user_id) {
        return res.status(403).json({ error: 'You can only upload documents for your own donations.' });
      }

      const url = await uploadDocument(req.file.buffer, {
        folder: 'donation-reports',
        filename: `${req.params.donationId}-${req.file.originalname}`,
      });

      const result = await pool.query(
        'UPDATE donations SET medical_report_url = $1 WHERE donation_id = $2 RETURNING *',
        [url, req.params.donationId]
      );
      res.json({ message: 'Document uploaded.', donation: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
