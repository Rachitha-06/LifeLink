const env = require('../config/env');

/**
 * Verifies a Google reCAPTCHA v2 token server-side. Same graceful-mock
 * pattern as email/SMS/Cloudinary/Anthropic elsewhere in this project:
 * without RECAPTCHA_SECRET_KEY configured, registration isn't blocked —
 * it just logs that verification was skipped, so the rest of the flow
 * stays testable without a real Google account.
 */
async function verifyCaptcha(token) {
  if (!env.recaptcha.secretKey) {
    console.log('[CAPTCHA MOCK] No RECAPTCHA_SECRET_KEY configured — skipping verification.');
    return { success: true, mock: true };
  }

  if (!token) {
    return { success: false, mock: false };
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.recaptcha.secretKey, response: token }),
    });
    const data = await response.json();
    return { success: !!data.success, mock: false };
  } catch (err) {
    console.error('CAPTCHA verification error:', err.message);
    return { success: false, mock: false };
  }
}

module.exports = { verifyCaptcha };
