const cron = require('node-cron');
const { runAutoMatchCycle } = require('./autoMatch');
const { runDonationReminders } = require('./donationReminders');
const { runExpireStaleRequests } = require('./expireRequests');

/**
 * Registers all scheduled jobs. Called once from server.js, only when
 * the process is actually running the server (not when server.js is
 * required for tests) — same guard pattern as pool.query/app.listen.
 */
function startScheduledJobs() {
  // Every 15 minutes — catches anything the SOS immediate-trigger missed
  // and handles all non-critical requests, which don't get an immediate
  // trigger at creation.
  cron.schedule('*/15 * * * *', () => {
    runAutoMatchCycle().catch((err) => console.error('[auto-match] failed:', err.message));
  });

  // Once daily at 08:00 server time — donation eligibility reminders.
  cron.schedule('0 8 * * *', () => {
    runDonationReminders().catch((err) => console.error('[donation-reminders] failed:', err.message));
  });

  // Once daily at 00:30 — expire stale requests just after midnight.
  cron.schedule('30 0 * * *', () => {
    runExpireStaleRequests().catch((err) => console.error('[expire-requests] failed:', err.message));
  });

  console.log('Scheduled jobs registered: auto-match (15m), donation reminders (daily), expire requests (daily).');
}

module.exports = { startScheduledJobs };
