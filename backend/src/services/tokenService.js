const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Issues a short-lived access token. Only non-sensitive fields —
 * never password_hash.
 */
function generateAccessToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role, name: user.name },
    env.jwt.secret,
    { expiresIn: env.jwt.accessExpiry }
  );
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Refresh tokens are opaque high-entropy random strings, not JWTs —
 * there's nothing useful to decode client-side, and unlike a password
 * they don't need bcrypt's deliberately-slow hashing; sha256 is the
 * standard approach for hashing a token that's already high-entropy.
 */
async function issueRefreshToken(pool, userId) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.refreshToken.expiryDays * 86400000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
}

/**
 * Validates a raw refresh token from the cookie against the DB.
 * Returns the user_id if valid, or null if missing/expired/revoked —
 * callers should treat null as "not authenticated," not throw.
 */
async function verifyRefreshToken(pool, rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);

  const result = await pool.query(
    `SELECT user_id FROM refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0]?.user_id || null;
}

/** Marks a refresh token revoked. Safe to call on an unknown/already-revoked token. */
async function revokeRefreshToken(pool, rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}

/**
 * Rotation: revoke the token that was just used, issue a brand new one.
 * If a stolen refresh token is ever replayed after the legitimate user
 * has already rotated past it, the attacker's copy simply stops working
 * on next use — rotation is what makes that possible.
 */
async function rotateRefreshToken(pool, oldRawToken, userId) {
  await revokeRefreshToken(pool, oldRawToken);
  return issueRefreshToken(pool, userId);
}

function refreshCookieOptions() {
  const isProd = env.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProd, // secure cookies require HTTPS — true in prod, false for local http dev
    // Cross-origin in prod (frontend on Vercel, backend on Render) needs
    // 'none'; same-origin dev (via the Vite proxy) works fine with 'lax'.
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth', // only ever sent to auth endpoints, not every request
    maxAge: env.refreshToken.expiryDays * 86400000,
  };
}

/** Short-lived (5 min), carries only user_id + the `purpose` claim that
 * middleware/auth.js explicitly rejects everywhere except
 * /auth/2fa/login-verify — this token proves "password was correct,"
 * nothing more, until the TOTP code is also verified. */
function generateTwoFactorPendingToken(userId) {
  return jwt.sign({ user_id: userId, purpose: '2fa_pending' }, env.jwt.secret, { expiresIn: '5m' });
}

module.exports = {
  generateAccessToken,
  generateTwoFactorPendingToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  refreshCookieOptions,
};
