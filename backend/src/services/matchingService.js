// Core matching logic, extracted so the manual "Run Matching" button,
// the critical-request SOS auto-trigger, and the scheduled cron job all
// call the exact same code instead of three copies drifting apart.

const BLOOD_COMPAT = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

function isCompatible(donorBlood, recipientBlood) {
  return BLOOD_COMPAT[donorBlood]?.includes(recipientBlood) ?? false;
}

function calcCompatibilityScore(donor, request) {
  let score = 0;
  if (donor.blood_type === request.blood_type) score += 40;
  else if (isCompatible(donor.blood_type, request.blood_type)) score += 25;

  if (donor.organ_type?.toLowerCase() === request.organ_needed?.toLowerCase()) score += 40;

  if (donor.city && request.city) {
    if (donor.city.toLowerCase() === request.city.toLowerCase()) score += 20;
    else if (donor.state === request.state) score += 10;
    else score += 2;
  }

  return Math.min(score, 100);
}

// See the organ-matching refinement note in routes/matches.js history —
// a compatibility score is a candidate-shortlist signal for medical
// staff, never a matching decision. Blood is the one case close enough
// to deterministic (ABO/Rh) to skip medical_review.
function requiresCrossmatch(organType) {
  return organType?.toLowerCase() !== 'blood';
}

const MIN_SCORE = 25;

/**
 * Ranks compatible, not-yet-matched donors against one request.
 * topN=1 (default) is the normal single-best-match behavior; the SOS
 * auto-trigger for critical requests calls this with topN=3 to notify
 * multiple candidates at once instead of waiting on a single pick.
 */
function findCandidates(request, donors, existingPairs, usedDonors, topN = 1) {
  const scored = [];
  for (const donor of donors) {
    if (usedDonors.has(donor.donation_id)) continue;
    if (existingPairs.has(`${donor.donation_id}:${request.request_id}`)) continue;
    if (!isCompatible(donor.blood_type, request.blood_type)) continue;
    if (donor.organ_type?.toLowerCase() !== request.organ_needed?.toLowerCase()) continue;

    const score = calcCompatibilityScore(donor, request);
    if (score >= MIN_SCORE) scored.push({ donor, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

async function logStatusChange(pool, matchId, status, changedBy, note = null) {
  await pool.query(
    `INSERT INTO match_status_history (match_id, status, changed_by, note) VALUES ($1,$2,$3,$4)`,
    [matchId, status, changedBy, note]
  );
}

async function createMatch(pool, donationId, requestId, score, organType) {
  const needsCrossmatch = requiresCrossmatch(organType);
  const result = await pool.query(
    `INSERT INTO matches (donation_id, request_id, compatibility_score, matched_by, status, requires_crossmatch)
     VALUES ($1,$2,$3,'algorithm','pending',$4) RETURNING *`,
    [donationId, requestId, score, needsCrossmatch]
  );
  await logStatusChange(pool, result.rows[0].match_id, 'pending', null, 'Suggested by matching algorithm.');
  return result.rows[0];
}

/** Batch-fetches every non-terminal match once — the N+1 fix from
 * Milestone 4, kept here so every call site benefits from it. */
async function fetchExistingPairs(pool) {
  const existing = await pool.query(
    `SELECT donation_id, request_id FROM matches WHERE status NOT IN ('failed','cancelled')`
  );
  return new Set(existing.rows.map((m) => `${m.donation_id}:${m.request_id}`));
}

/**
 * Only donors with no active (non-terminal) match already in progress —
 * without this, a donor could be matched to a second, different
 * request while still pending/in-review on a first match, since
 * donation.status itself is never flipped at match time.
 */
async function fetchAvailableDonors(pool) {
  const result = await pool.query(
    `SELECT d.*, u.city, u.state, u.organ_type
     FROM donations d JOIN users u ON d.donor_id = u.user_id
     WHERE (d.status = 'available' OR d.status = 'verified')
       AND NOT EXISTS (
         SELECT 1 FROM matches m
         WHERE m.donation_id = d.donation_id AND m.status NOT IN ('failed','cancelled')
       )`
  );
  return result.rows;
}

/**
 * SOS BROADCAST (Phase 2 feature): a critical request doesn't wait for
 * the next scheduled matching cycle or a human clicking "Run Matching" —
 * it's matched immediately against available donors, and instead of
 * picking just the single best candidate, the top few are all notified
 * at once. Faster response matters more than optimal-donor-selection
 * when someone's request is marked critical.
 */
async function runSOSMatching(pool, request, topN = 3) {
  const donors = await fetchAvailableDonors(pool);
  const existingPairs = await fetchExistingPairs(pool);
  const usedDonors = new Set();

  const candidates = findCandidates(request, donors, existingPairs, usedDonors, topN);
  const created = [];

  for (const { donor, score } of candidates) {
    const match = await createMatch(pool, donor.donation_id, request.request_id, score, request.organ_needed);
    created.push({ match, donor });
  }

  if (created.length > 0) {
    await pool.query(`UPDATE requests SET status = 'matched' WHERE request_id = $1`, [request.request_id]);
  }

  return created;
}

module.exports = {
  isCompatible,
  calcCompatibilityScore,
  requiresCrossmatch,
  findCandidates,
  createMatch,
  logStatusChange,
  fetchExistingPairs,
  fetchAvailableDonors,
  runSOSMatching,
  MIN_SCORE,
};
