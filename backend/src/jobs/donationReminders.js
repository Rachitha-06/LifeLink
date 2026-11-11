const pool = require('../config/db');
const { sendDonationReminder } = require('../services/notificationService');

/**
 * sendDonationReminder() has existed in notificationService.js since
 * Milestone 1 but nothing ever called it. Runs daily: finds donors whose
 * 90-day blood-donation eligibility resets *today* and reminds them.
 * Matching on next_eligible_date = today (rather than <= today) means
 * each donor gets reminded once, right when they become eligible again,
 * as long as this job runs at least once daily — no separate
 * "already reminded" tracking needed.
 */
async function runDonationReminders() {
  const result = await pool.query(
    `SELECT DISTINCT ON (donor_id) donor_id, organ_type
     FROM donations
     WHERE organ_type = 'Blood' AND next_eligible_date = CURRENT_DATE
     ORDER BY donor_id, donation_date DESC`
  );

  for (const row of result.rows) {
    await sendDonationReminder(pool, row.donor_id, row.organ_type);
  }

  if (result.rows.length > 0) {
    console.log(`[donation-reminders] Sent ${result.rows.length} reminder(s).`);
  }
  return result.rows.length;
}

module.exports = { runDonationReminders };
