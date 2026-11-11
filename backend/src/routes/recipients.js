const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { uploadDocument } = require('../services/uploadService');
const { runSOSMatching } = require('../services/matchingService');
const { sendMatchNotification } = require('../services/notificationService');

const router = express.Router();

// Days before an unmatched request auto-expires, by urgency. More urgent
// requests expire sooner — if a critical request hasn't found a
// candidate in 3 days, it needs human attention, not to sit open for a
// month like a low-urgency one reasonably can.
const EXPIRY_DAYS_BY_URGENCY = { critical: 3, high: 7, medium: 14, low: 30 };

// GET /api/recipients — list requests (admin/hospital view)
router.get('/', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  const { status, urgency, organ_needed, blood_type } = req.query;
  const conditions = ["r.status != 'cancelled'"];
  const values = [];
  let i = 1;

  if (status) { conditions.push(`r.status = $${i++}`); values.push(status); }
  if (urgency) { conditions.push(`r.urgency = $${i++}`); values.push(urgency); }
  if (organ_needed) { conditions.push(`r.organ_needed = $${i++}`); values.push(organ_needed); }
  if (blood_type) { conditions.push(`r.blood_type = $${i++}`); values.push(blood_type); }

  try {
    const result = await pool.query(
      `SELECT r.*, u.name AS patient_name, u.phone, u.city,
              h.name AS hospital_name
       FROM requests r
       JOIN users u ON r.recipient_id = u.user_id
       LEFT JOIN hospitals h ON r.hospital_id = h.hospital_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY CASE r.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                               WHEN 'medium' THEN 3 ELSE 4 END,
                r.request_date ASC`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/recipients/request — submit a new organ/blood request
router.post('/request', authenticate, authorize('recipient', 'admin', 'hospital_admin'), async (req, res, next) => {
  const { organ_needed, blood_type, urgency, hospital_id, doctor_name, diagnosis, notes } = req.body;

  if (!organ_needed || !blood_type || !urgency) {
    return res.status(400).json({ error: 'organ_needed, blood_type, and urgency are required.' });
  }

  try {
    const expiryDays = EXPIRY_DAYS_BY_URGENCY[urgency] ?? 14;
    const expiresAt = new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0];

    const result = await pool.query(
      `INSERT INTO requests
         (recipient_id, organ_needed, blood_type, urgency, hospital_id, doctor_name, diagnosis, notes, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [req.user.user_id, organ_needed, blood_type, urgency,
        hospital_id || null, doctor_name || null, diagnosis || null, notes || null, expiresAt]
    );
    const request = result.rows[0];

    // SOS: critical requests get matched immediately, broadcasting to
    // multiple candidates instead of waiting for the next scheduled run.
    if (urgency === 'critical') {
      const userRow = await pool.query('SELECT city, state FROM users WHERE user_id = $1', [req.user.user_id]);
      const requestWithLocation = { ...request, ...userRow.rows[0] };

      const matches = await runSOSMatching(pool, requestWithLocation, 3);
      for (const { match, donor } of matches) {
        await sendMatchNotification(pool, donor.donor_id, request.recipient_id, request.organ_needed, match.compatibility_score);
      }
      if (matches.length > 0) {
        request.status = 'matched';
      }
    }

    res.status(201).json({ message: 'Request submitted successfully.', request });
  } catch (err) {
    next(err);
  }
});

// GET /api/recipients/my-requests
router.get('/my-requests', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT r.*, h.name AS hospital_name,
              m.match_id, m.status AS match_status, m.compatibility_score, m.requires_crossmatch
       FROM requests r
       LEFT JOIN hospitals h ON r.hospital_id = h.hospital_id
       LEFT JOIN LATERAL (
         SELECT * FROM matches
         WHERE request_id = r.request_id AND status NOT IN ('failed','cancelled')
         ORDER BY
           CASE status WHEN 'confirmed' THEN 1 WHEN 'medical_review' THEN 2 ELSE 3 END,
           compatibility_score DESC
         LIMIT 1
       ) m ON TRUE
       WHERE r.recipient_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.user_id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/recipients/request/:id — update or cancel a request
router.patch('/request/:id', authenticate, async (req, res, next) => {
  const { status, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE requests SET status = $1, notes = $2, updated_at = NOW()
       WHERE request_id = $3 AND (recipient_id = $4 OR $5 = 'admin')
       RETURNING *`,
      [status, notes, req.params.id, req.user.user_id, req.user.role]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Request not found, or you are not authorized to update it.' });
    }
    res.json({ message: 'Request updated.', request: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/recipients/request/:id/documents — upload supporting medical
// documents (diagnosis letter, referral, etc) for a request.
router.post(
  '/request/:id/documents',
  authenticate,
  authorize('recipient', 'admin'),
  upload.single('document'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Field name must be "document".' });
    }
    try {
      const request = await pool.query('SELECT recipient_id FROM requests WHERE request_id = $1', [
        req.params.id,
      ]);
      if (!request.rows.length) return res.status(404).json({ error: 'Request not found.' });
      if (req.user.role === 'recipient' && request.rows[0].recipient_id !== req.user.user_id) {
        return res.status(403).json({ error: 'You can only upload documents for your own requests.' });
      }

      const url = await uploadDocument(req.file.buffer, {
        folder: 'request-documents',
        filename: `${req.params.id}-${req.file.originalname}`,
      });

      const result = await pool.query(
        'UPDATE requests SET documents_url = $1 WHERE request_id = $2 RETURNING *',
        [url, req.params.id]
      );
      res.json({ message: 'Document uploaded.', request: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
