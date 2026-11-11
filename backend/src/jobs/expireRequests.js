const pool = require('../config/db');

/**
 * Expires requests past their expires_at date that never found a
 * candidate — 'pending' or 'reviewing' only. A 'matched' request found
 * a candidate and is progressing through medical review/confirmation,
 * so it shouldn't auto-expire just because the original deadline passed.
 */
async function runExpireStaleRequests() {
  const result = await pool.query(
    `UPDATE requests
     SET status = 'expired', updated_at = NOW()
     WHERE status IN ('pending', 'reviewing')
       AND expires_at IS NOT NULL
       AND expires_at < CURRENT_DATE
     RETURNING request_id`
  );

  if (result.rows.length > 0) {
    console.log(`[expire-requests] Expired ${result.rows.length} stale request(s).`);
  }
  return result.rows.length;
}

module.exports = { runExpireStaleRequests };
