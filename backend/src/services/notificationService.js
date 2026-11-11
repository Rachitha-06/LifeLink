// Email (Nodemailer) + SMS (Twilio) notifications
const nodemailer = require('nodemailer');
const env = require('../config/env');

const emailTransport = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: false,
  auth: { user: env.smtp.user, pass: env.smtp.pass },
});

let twilioClient = null;
if (env.twilio.accountSid && env.twilio.authToken) {
  const twilio = require('twilio');
  twilioClient = twilio(env.twilio.accountSid, env.twilio.authToken);
}

async function sendEmail({ to, subject, html, text }) {
  if (!env.smtp.user) {
    console.log('[EMAIL MOCK]', { to, subject });
    return;
  }
  try {
    await emailTransport.sendMail({ from: `"LifeLink Platform" <${env.smtp.user}>`, to, subject, html, text });
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

async function sendSMS(to, message) {
  if (!twilioClient) {
    console.log('[SMS MOCK]', { to, message });
    return;
  }
  try {
    await twilioClient.messages.create({ body: message, from: env.twilio.phone, to });
  } catch (err) {
    console.error('SMS error:', err.message);
  }
}

/** Defaults to fully enabled if the user has never set preferences —
 * matches the GET /preferences endpoint's default response shape. */
async function getPreferences(pool, userId) {
  const result = await pool.query('SELECT email_enabled, sms_enabled FROM notification_preferences WHERE user_id = $1', [userId]);
  return result.rows[0] || { email_enabled: true, sms_enabled: true };
}

async function sendMatchNotification(pool, donorId, recipientId, organType, score) {
  try {
    const [donorRes, recipientRes] = await Promise.all([
      pool.query('SELECT name, email, phone FROM users WHERE user_id = $1', [donorId]),
      pool.query('SELECT name, email, phone FROM users WHERE user_id = $1', [recipientId]),
    ]);
    const donor = donorRes.rows[0];
    const recipient = recipientRes.rows[0];
    if (!donor || !recipient) return;

    const [donorPrefs, recipientPrefs] = await Promise.all([
      getPreferences(pool, donorId),
      getPreferences(pool, recipientId),
    ]);

    // ORGAN MATCHING REFINEMENT: a compatibility score is a candidate
    // suggestion for medical staff to review, not a matching decision —
    // wording reflects that for anything except Blood, where ABO/Rh
    // compatibility is close enough to deterministic to say "matched."
    const isBlood = organType?.toLowerCase() === 'blood';
    const donorMessage = isBlood
      ? `Great news! A compatible recipient has been found for your ${organType} donation. Compatibility: ${score}%`
      : `A potential recipient match has been identified for your ${organType} donation (${score}% preliminary compatibility). This is a candidate suggestion — the hospital's medical team will confirm eligibility via full evaluation before anything proceeds.`;
    const recipientMessage = isBlood
      ? `A compatible ${organType} donor has been matched to your request. Our team will contact you shortly.`
      : `A potential ${organType} donor has been identified for your request (${score}% preliminary compatibility). This is a candidate suggestion pending full medical review, not a confirmed match yet — our team will contact you with next steps.`;

    // FIX: organType and score were previously interpolated directly into
    // the SQL string via template literals. organType traces back to
    // organ_needed on a recipient-submitted request — genuinely
    // user-controlled input reaching raw SQL text. Now bound as parameters.
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, sent_email, sent_sms)
       VALUES ($1, 'match_found', $2, $3, $4, $5)`,
      [donorId, isBlood ? 'Match Found!' : 'Candidate Match Identified', donorMessage, donorPrefs.email_enabled, donorPrefs.sms_enabled]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, sent_email, sent_sms)
       VALUES ($1, 'match_found', $2, $3, $4, $5)`,
      [recipientId, isBlood ? 'Donor Match Found!' : 'Candidate Donor Identified', recipientMessage, recipientPrefs.email_enabled, recipientPrefs.sms_enabled]
    );

    if (donorPrefs.email_enabled) {
      await sendEmail({
      to: donor.email,
      subject: isBlood
        ? `LifeLink: Match Found for Your ${organType} Donation`
        : `LifeLink: Candidate Match Identified for Your ${organType} Donation`,
      html: isBlood
        ? `
        <h2>A Match Has Been Found</h2>
        <p>Dear ${donor.name},</p>
        <p>A compatible recipient has been found for your <strong>${organType}</strong> donation.</p>
        <p><strong>Compatibility Score:</strong> ${score}%</p>
        <p>Our coordination team will contact you within 24 hours with next steps.</p>
        <p>Thank you for your life-saving contribution.</p>
        <p>— The LifeLink Team</p>
      `
        : `
        <h2>A Candidate Match Has Been Identified</h2>
        <p>Dear ${donor.name},</p>
        <p>Our system has identified a potential recipient for your <strong>${organType}</strong> donation
           (${score}% preliminary compatibility).</p>
        <p>This is a candidate suggestion, not a confirmed match — the hospital's medical team will need
           to complete a full evaluation, including tissue typing and a crossmatch test, before anything proceeds.</p>
        <p>Our coordination team will contact you within 24 hours to explain next steps.</p>
        <p>— The LifeLink Team</p>
      `,
      });
    }

    if (recipientPrefs.email_enabled) {
      await sendEmail({
      to: recipient.email,
      subject: isBlood ? 'LifeLink: A Donor Match Has Been Found' : 'LifeLink: A Candidate Donor Has Been Identified',
      html: isBlood
        ? `
        <h2>Hope Is Here — A Donor Match Has Been Found</h2>
        <p>Dear ${recipient.name},</p>
        <p>We are pleased to inform you that a compatible <strong>${organType}</strong> donor has been matched to your request.</p>
        <p><strong>Compatibility Score:</strong> ${score}%</p>
        <p>Our medical coordination team will contact you within the next few hours.</p>
        <p>— The LifeLink Team</p>
      `
        : `
        <h2>A Candidate Donor Has Been Identified</h2>
        <p>Dear ${recipient.name},</p>
        <p>We wanted to let you know a potential <strong>${organType}</strong> donor has been identified for your
           request (${score}% preliminary compatibility).</p>
        <p>This is an early-stage candidate suggestion, not a confirmed match — full medical evaluation
           (tissue typing and a crossmatch test) still needs to happen before anything is decided.</p>
        <p>Our medical coordination team will contact you shortly to explain next steps.</p>
        <p>— The LifeLink Team</p>
      `,
      });
    }

    if (donor.phone && donorPrefs.sms_enabled) {
      await sendSMS(donor.phone, `LifeLink: A match was found for your ${organType} donation (${score}% compatibility). Check your email for details.`);
    }
    if (recipient.phone && recipientPrefs.sms_enabled) {
      await sendSMS(recipient.phone, `LifeLink: A compatible ${organType} donor has been matched for you. Our team will call you shortly.`);
    }
  } catch (err) {
    console.error('Notification error:', err.message);
  }
}

async function sendDonationReminder(pool, donorId, organType) {
  const donorRes = await pool.query('SELECT name, email, phone FROM users WHERE user_id = $1', [donorId]);
  const donor = donorRes.rows[0];
  if (!donor) return;

  const prefs = await getPreferences(pool, donorId);
  if (!prefs.email_enabled) return;

  await sendEmail({
    to: donor.email,
    subject: `LifeLink: You're Eligible to Donate ${organType} Again`,
    html: `
      <h2>You're Eligible to Donate Again</h2>
      <p>Dear ${donor.name},</p>
      <p>It has been 90 days since your last blood donation. You are now eligible to donate again.</p>
      <p>Many patients are waiting. Please visit your nearest donation center.</p>
      <p>— The LifeLink Team</p>
    `,
  });
}

module.exports = { sendEmail, sendSMS, sendMatchNotification, sendDonationReminder };
