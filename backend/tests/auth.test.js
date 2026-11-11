const request = require('supertest');

jest.mock('../src/config/db', () => ({ query: jest.fn(), end: jest.fn() }));
jest.mock('../src/sockets/messageSocket', () => ({ attachMessageSocket: jest.fn() }));

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-ok';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';

const pool = require('../src/config/db');
const app = require('../src/server');
const { generateTOTP } = require('../src/services/twoFactorService');

/** In-memory fake users table backing the mocked pool.query — same
 * pattern as the ad-hoc fake pools used during development, now
 * wired through jest.mock instead of manual require.cache patching. */
function setupMockUsers(initialUsers) {
  const users = [...initialUsers];
  const refreshTokens = [];

  pool.query.mockImplementation(async (sql, params = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (s.startsWith('SELECT user_id FROM users WHERE email')) {
      const u = users.find((u) => u.email === params[0]);
      return { rows: u ? [{ user_id: u.user_id }] : [] };
    }
    if (s.startsWith('SELECT * FROM users WHERE email = $1 AND is_active')) {
      const u = users.find((u) => u.email === params[0] && u.is_active);
      return { rows: u ? [u] : [] };
    }
    if (s.startsWith('SELECT * FROM users WHERE user_id = $1 AND is_active')) {
      const u = users.find((u) => u.user_id === params[0] && u.is_active);
      return { rows: u ? [u] : [] };
    }
    if (s.startsWith('INSERT INTO users')) {
      const newUser = {
        user_id: 'new-' + (users.length + 1),
        name: params[0], email: params[1], password_hash: params[2], role: params[3],
        is_active: true, two_factor_enabled: false, two_factor_secret: null,
      };
      users.push(newUser);
      return { rows: [newUser] };
    }
    if (s.startsWith('UPDATE users SET last_login')) return { rows: [] };
    if (s.startsWith('INSERT INTO refresh_tokens')) {
      refreshTokens.push({ user_id: params[0], token_hash: params[1] });
      return { rows: [] };
    }
    throw new Error('Unhandled query in mock pool: ' + s);
  });

  return users;
}

describe('POST /api/auth/register', () => {
  beforeEach(() => setupMockUsers([]));

  test('rejects a password under 8 characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test', email: 'test@example.com', password: 'short', role: 'donor',
    });
    expect(res.status).toBe(400);
  });

  test('rejects an invalid role', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test', email: 'test@example.com', password: 'longenough123', role: 'superadmin',
    });
    expect(res.status).toBe(400);
  });

  test('succeeds with valid input and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Donor', email: 'donor@example.com', password: 'longenough123', role: 'donor',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('donor@example.com');
    expect(res.body.user.password_hash).toBeUndefined(); // never leak the hash
  });
});

describe('POST /api/auth/login', () => {
  const bcrypt = require('bcryptjs');

  test('rejects wrong password with a generic error (no email enumeration)', async () => {
    const hash = await bcrypt.hash('correctpassword', 12);
    setupMockUsers([{ user_id: 'u1', email: 'user@example.com', password_hash: hash, role: 'donor', is_active: true, two_factor_enabled: false }]);

    const wrongPassRes = await request(app).post('/api/auth/login').send({ email: 'user@example.com', password: 'wrongpassword' });
    const noUserRes = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'anything' });

    expect(wrongPassRes.status).toBe(401);
    expect(noUserRes.status).toBe(401);
    expect(wrongPassRes.body.error).toBe(noUserRes.body.error); // identical message either way
  });

  test('correct password without 2FA returns a full session', async () => {
    const hash = await bcrypt.hash('correctpassword', 12);
    setupMockUsers([{ user_id: 'u1', email: 'user@example.com', password_hash: hash, role: 'donor', is_active: true, two_factor_enabled: false }]);

    const res = await request(app).post('/api/auth/login').send({ email: 'user@example.com', password: 'correctpassword' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.requires2FA).toBeUndefined();
  });

  test('correct password WITH 2FA enabled does not return a token, requires verification', async () => {
    const hash = await bcrypt.hash('correctpassword', 12);
    setupMockUsers([{
      user_id: 'u1', email: 'admin@example.com', password_hash: hash, role: 'admin', is_active: true,
      two_factor_enabled: true, two_factor_secret: 'ABCDEFGHIJKLMNOP',
    }]);

    const res = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'correctpassword' });
    expect(res.status).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body.tempToken).toBeDefined();
    expect(res.body.token).toBeUndefined();
  });

  test('full 2FA flow: login -> tempToken -> correct code -> real session', async () => {
    const hash = await bcrypt.hash('correctpassword', 12);
    const secret = 'ABCDEFGHIJKLMNOP';
    setupMockUsers([{
      user_id: 'u1', email: 'admin@example.com', password_hash: hash, role: 'admin', is_active: true,
      two_factor_enabled: true, two_factor_secret: secret,
    }]);

    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'correctpassword' });
    const { tempToken } = loginRes.body;

    const wrongCodeRes = await request(app).post('/api/auth/2fa/login-verify').send({ tempToken, code: '000000' });
    expect(wrongCodeRes.status).toBe(401);

    const correctCode = generateTOTP(secret);
    const verifyRes = await request(app).post('/api/auth/2fa/login-verify').send({ tempToken, code: correctCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeDefined();
    expect(verifyRes.body.user.two_factor_secret).toBeUndefined(); // never leak the secret
  });

  test('a tempToken cannot be used as a normal Bearer token on protected routes', async () => {
    const hash = await bcrypt.hash('correctpassword', 12);
    setupMockUsers([{
      user_id: 'u1', email: 'admin@example.com', password_hash: hash, role: 'admin', is_active: true,
      two_factor_enabled: true, two_factor_secret: 'ABCDEFGHIJKLMNOP',
    }]);

    const loginRes = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'correctpassword' });
    const { tempToken } = loginRes.body;

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tempToken}`);
    expect(meRes.status).toBe(401);
  });
});
