const crypto = require('crypto');

// RFC 4648 base32 alphabet — used for TOTP secrets by every authenticator
// app (Google Authenticator, Authy, etc.), so this has to match exactly.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder) {
    const lastChunk = bits.slice(-remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(encoded) {
  const clean = encoded.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character in TOTP secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** Generates a random 20-byte (160-bit) secret, base32-encoded — the
 * standard secret length TOTP apps expect. */
function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

const PERIOD_SECONDS = 30;
const DIGITS = 6;

/** RFC 6238 TOTP, built on RFC 4226 HOTP. `counter` defaults to the
 * current 30-second time step but is overridable for testing and for
 * checking adjacent windows (clock drift tolerance). */
function generateTOTP(base32Secret, counter = Math.floor(Date.now() / 1000 / PERIOD_SECONDS)) {
  const key = base32Decode(base32Secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
  return code;
}

/**
 * Verifies a submitted code, tolerating +/-1 time step (30s each way)
 * for clock drift between the server and the person's phone — a common,
 * expected real-world gap, not a security weakening (still only a
 * 90-second total window on a 6-digit code).
 */
function verifyTOTP(base32Secret, token) {
  if (!/^\d{6}$/.test(token)) return false;
  const currentCounter = Math.floor(Date.now() / 1000 / PERIOD_SECONDS);
  for (const drift of [0, -1, 1]) {
    if (generateTOTP(base32Secret, currentCounter + drift) === token) return true;
  }
  return false;
}

function buildOtpauthUri(secret, accountEmail, issuer = 'LifeLink') {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = { generateSecret, generateTOTP, verifyTOTP, buildOtpauthUri };
