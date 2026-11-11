/**
 * Centralized environment configuration.
 *
 * Loads .env once and validates required variables at startup, so the app
 * fails fast with a clear error instead of crashing later mid-request with
 * a confusing "undefined is not a function" somewhere in a route.
 */
const dotenv = require('dotenv');
dotenv.config();

const REQUIRED_VARS = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy backend/.env.example to backend/.env and fill in real values.'
    );
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }
}

validateEnv();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },

  // MILESTONE 2: real access/refresh split. Access tokens are short-lived
  // and never persisted client-side outside memory; the refresh token is
  // opaque (not a JWT), stored server-side as a hash, sent only via an
  // httpOnly cookie the frontend JS can never read.
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRE || '15m',
  },
  refreshToken: {
    expiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS, 10) || 7,
    cookieName: 'refreshToken',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phone: process.env.TWILIO_PHONE,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Configurable rather than hardcoded — check
    // https://docs.claude.com/en/docs/about-claude/models for the
    // current model lineup before deploying; this default may be stale
    // by the time this project is actually run.
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  },

  recaptcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY,
  },
};
