const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const pool = require('../config/db');
const env = require('../config/env');
const { authenticate, authorize } = require('../middleware/auth');
const {
  generateAccessToken,
  generateTwoFactorPendingToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  refreshCookieOptions,
} = require('../services/tokenService');
const { generateSecret, verifyTOTP, buildOtpauthUri } = require('../services/twoFactorService');
const { verifyCaptcha } = require('../services/captchaService');

const router = express.Router();
const VALID_ROLES = ['donor', 'recipient', 'hospital_admin'];

/** Issues both tokens for a fresh login/register, sets the refresh cookie,
 * and returns the shape the frontend expects: { message, user, token }. */
async function issueSession(res, user, message) {
  const accessToken = generateAccessToken(user);
  const refreshToken = await issueRefreshToken(pool, user.user_id);
  res.cookie(env.refreshToken.cookieName, refreshToken, refreshCookieOptions());

  const safeUser = { ...user };
  delete safeUser.password_hash;
  delete safeUser.two_factor_secret;
  return { message, user: safeUser, token: accessToken };
}

router.post('/register', async (req, res, next) => {
  const {
    name, email, password, role, age, blood_type, organ_type,
    phone, city, state, hospital_id, captchaToken,
  } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const captchaResult = await verifyCaptcha(captchaToken);
  if (!captchaResult.success) {
    return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
  }

  try {
    const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users
        (name, email, password_hash, role, age, blood_type, organ_type, phone, city, state, hospital_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [name, email, passwordHash, role, age || null, blood_type || null, organ_type || null,
        phone || null, city || null, state || null, hospital_id || null]
    );

    const session = await issueSession(res, result.rows[0], 'Registered successfully.');
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );
    // Same error for "no such user" and "wrong password" — don't leak
    // which one it was, that lets attackers enumerate valid emails.
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.two_factor_enabled) {
      // Password is correct, but that's not enough — no tokens issued
      // yet. tempToken only proves "password was correct" (see the
      // `purpose` claim explicitly rejected by authenticate()).
      return res.json({
        requires2FA: true,
        tempToken: generateTwoFactorPendingToken(user.user_id),
      });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);
    const session = await issueSession(res, user, 'Login successful.');
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/login-verify — completes login for accounts with
// 2FA enabled. Takes the tempToken from /login plus a TOTP code.
router.post('/2fa/login-verify', async (req, res, next) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ error: 'tempToken and code are required.' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(tempToken, env.jwt.secret);
    } catch {
      return res.status(401).json({ error: 'Verification session expired. Please log in again.' });
    }
    if (decoded.purpose !== '2fa_pending') {
      return res.status(401).json({ error: 'Invalid verification token.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE user_id = $1 AND is_active = TRUE', [decoded.user_id]);
    if (!result.rows.length) return res.status(401).json({ error: 'Account no longer active.' });
    const user = result.rows[0];

    if (!user.two_factor_enabled || !verifyTOTP(user.two_factor_secret, code)) {
      return res.status(401).json({ error: 'Invalid verification code.' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);
    const session = await issueSession(res, user, 'Login successful.');
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/setup — generates a secret + QR code, but saves
// nothing yet. The secret only becomes real once /2fa/confirm verifies
// the person actually scanned it and can produce a valid code — see the
// schema comment on two_factor_secret for why.
router.post('/2fa/setup', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  try {
    const secret = generateSecret();
    const otpauthUrl = buildOtpauthUri(secret, req.user.email);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    res.json({ secret, otpauthUrl, qrCodeDataUrl });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/confirm — verifies the code against the
// not-yet-saved secret, and only then persists it.
router.post('/2fa/confirm', authenticate, authorize('admin', 'hospital_admin'), async (req, res, next) => {
  const { secret, code } = req.body;
  if (!secret || !code) {
    return res.status(400).json({ error: 'secret and code are required.' });
  }
  if (!verifyTOTP(secret, code)) {
    return res.status(400).json({ error: 'Invalid code. Please check your authenticator app and try again.' });
  }

  try {
    await pool.query(
      'UPDATE users SET two_factor_secret = $1, two_factor_enabled = TRUE WHERE user_id = $2',
      [secret, req.user.user_id]
    );
    res.json({ message: 'Two-factor authentication enabled.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/disable — requires the current password, since
// turning off 2FA is a security-lowering action, not a routine setting.
router.post('/2fa/disable', authenticate, async (req, res, next) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Current password is required to disable 2FA.' });

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [req.user.user_id]);
    const validPassword = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Incorrect password.' });

    await pool.query(
      'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = FALSE WHERE user_id = $1',
      [req.user.user_id]
    );
    res.json({ message: 'Two-factor authentication disabled.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh — mints a new access token from the httpOnly
// refresh cookie. Deliberately NOT behind `authenticate` — the whole
// point is that the access token has already expired.
router.post('/refresh', async (req, res, next) => {
  const oldRawToken = req.cookies?.[env.refreshToken.cookieName];

  try {
    const userId = await verifyRefreshToken(pool, oldRawToken);
    if (!userId) {
      res.clearCookie(env.refreshToken.cookieName, { path: '/api/auth' });
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE user_id = $1 AND is_active = TRUE', [userId]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Account no longer active.' });
    }
    const user = result.rows[0];

    const accessToken = generateAccessToken(user);
    const newRefreshToken = await rotateRefreshToken(pool, oldRawToken, user.user_id);
    res.cookie(env.refreshToken.cookieName, newRefreshToken, refreshCookieOptions());

    const safeUser = { ...user };
    delete safeUser.password_hash;
    delete safeUser.two_factor_secret;
    res.json({ message: 'Session refreshed.', user: safeUser, token: accessToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — revokes the refresh token server-side, not
// just a client-side "forget the token." Works even with an already-
// expired access token, since it doesn't require `authenticate`.
router.post('/logout', async (req, res, next) => {
  const rawToken = req.cookies?.[env.refreshToken.cookieName];
  try {
    await revokeRefreshToken(pool, rawToken);
    res.clearCookie(env.refreshToken.cookieName, { path: '/api/auth' });
    res.json({ message: 'Logged out.' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.*, h.name AS hospital_name
       FROM users u LEFT JOIN hospitals h ON u.hospital_id = h.hospital_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });

    const user = result.rows[0];
    delete user.password_hash;
    delete user.two_factor_secret; // never sent back after setup confirmation — see /2fa/setup and /2fa/confirm
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [req.user.user_id]
    );
    const validPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [newHash, req.user.user_id]);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
