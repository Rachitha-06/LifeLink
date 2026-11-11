const pool = require('../config/db');
const { sendMatchNotification } = require('../services/notificationService');
const { findCandidates, createMatch, fetchExistingPairs, fetchAvailableDonors } = require('../services/matchingService');

/**
 * Runs the same matching cycle as the manual "Run Matching" button, on
 * a schedule — so matching isn't gated on a human remembering to click
 * a button. Critical requests already get matched immediately at
 * creation via the SOS trigger in recipients.js; this catches
 * everything else (and re-checks critical requests too, in case the
 * SOS trigger didn't find a candidate the first time — supply may have
 * changed since).
 */
async function runAutoMatchCycle() {
  const requests = await pool.query(
    `SELECT r.*, u.city, u.state
     FROM requests r JOIN users u ON r.recipient_id = u.user_id
     WHERE r.status = 'pending'
     ORDER BY CASE r.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                             WHEN 'medium' THEN 3 ELSE 4 END`
  );

  const donors = await fetchAvailableDonors(pool);
  const existingPairs = await fetchExistingPairs(pool);
  const usedDonors = new Set();
  let matchCount = 0;

  for (const request of requests.rows) {
    const [best] = findCandidates(request, donors, existingPairs, usedDonors, 1);
    if (!best) continue;

    const match = await createMatch(pool, best.donor.donation_id, request.request_id, best.score, request.organ_needed);
    await pool.query(`UPDATE requests SET status = 'matched' WHERE request_id = $1`, [request.request_id]);

    usedDonors.add(best.donor.donation_id);
    existingPairs.add(`${best.donor.donation_id}:${request.request_id}`);
    matchCount++;

    await sendMatchNotification(pool, best.donor.donor_id, request.recipient_id, request.organ_needed, best.score);
  }

  if (matchCount > 0) {
    console.log(`[auto-match] Created ${matchCount} new candidate match(es).`);
  }
  return matchCount;
}

module.exports = { runAutoMatchCycle };
