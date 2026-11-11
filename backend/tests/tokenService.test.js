const tokenService = require('../src/services/tokenService');

// Real Jest mocking (jest.mock + manual implementation) rather than the
// ad-hoc fake-pool objects used during development — this is the
// standard pattern for testing DB-touching code without a live database.
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));
const pool = require('../src/config/db');

describe('tokenService — refresh token lifecycle', () => {
  let storedRows;

  beforeEach(() => {
    storedRows = [];
    pool.query.mockImplementation(async (sql, params = []) => {
      const s = sql.replace(/\s+/g, ' ').trim();

      if (s.startsWith('INSERT INTO refresh_tokens')) {
        const [user_id, token_hash, expires_at] = params;
        storedRows.push({ user_id, token_hash, expires_at, revoked_at: null });
        return { rows: [] };
      }
      if (s.startsWith('SELECT user_id FROM refresh_tokens')) {
        const [token_hash] = params;
        const match = storedRows.find(
          (r) => r.token_hash === token_hash && !r.revoked_at && new Date(r.expires_at) > new Date()
        );
        return { rows: match ? [{ user_id: match.user_id }] : [] };
      }
      if (s.startsWith('UPDATE refresh_tokens SET revoked_at')) {
        const [token_hash] = params;
        const match = storedRows.find((r) => r.token_hash === token_hash && !r.revoked_at);
        if (match) match.revoked_at = new Date();
        return { rows: [] };
      }
      throw new Error('Unhandled query in mock pool: ' + s);
    });
  });

  test('an issued token verifies to the correct user', async () => {
    const token = await tokenService.issueRefreshToken(pool, 'user-1');
    await expect(tokenService.verifyRefreshToken(pool, token)).resolves.toBe('user-1');
  });

  test('a garbage token does not verify', async () => {
    await expect(tokenService.verifyRefreshToken(pool, 'not-a-real-token')).resolves.toBeNull();
  });

  test('rotation invalidates the old token and issues a working new one', async () => {
    const oldToken = await tokenService.issueRefreshToken(pool, 'user-1');
    const newToken = await tokenService.rotateRefreshToken(pool, oldToken, 'user-1');

    await expect(tokenService.verifyRefreshToken(pool, oldToken)).resolves.toBeNull();
    await expect(tokenService.verifyRefreshToken(pool, newToken)).resolves.toBe('user-1');
  });

  test('an explicitly revoked token (logout) stops verifying', async () => {
    const token = await tokenService.issueRefreshToken(pool, 'user-1');
    await tokenService.revokeRefreshToken(pool, token);
    await expect(tokenService.verifyRefreshToken(pool, token)).resolves.toBeNull();
  });

  test('two issued tokens are cryptographically distinct', async () => {
    const t1 = await tokenService.issueRefreshToken(pool, 'user-1');
    const t2 = await tokenService.issueRefreshToken(pool, 'user-1');
    expect(t1).not.toBe(t2);
  });
});

describe('tokenService — access token generation', () => {
  const originalSecret = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
  });
  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  test('generated access token decodes with the expected claims', () => {
    // Re-require after setting env, since env.js reads process.env at load time
    jest.resetModules();
    const jwt = require('jsonwebtoken');
    const env = require('../src/config/env');
    const freshTokenService = require('../src/services/tokenService');

    const token = freshTokenService.generateAccessToken({
      user_id: 'user-1', email: 'a@b.com', role: 'donor', name: 'Test',
    });
    const decoded = jwt.verify(token, env.jwt.secret);
    expect(decoded.user_id).toBe('user-1');
    expect(decoded.role).toBe('donor');
    expect(decoded.exp - decoded.iat).toBe(15 * 60); // 15 minutes
  });

  test('a 2FA-pending token carries the purpose claim and nothing else sensitive', () => {
    jest.resetModules();
    const jwt = require('jsonwebtoken');
    const env = require('../src/config/env');
    const freshTokenService = require('../src/services/tokenService');

    const token = freshTokenService.generateTwoFactorPendingToken('user-1');
    const decoded = jwt.verify(token, env.jwt.secret);
    expect(decoded.purpose).toBe('2fa_pending');
    expect(decoded.role).toBeUndefined();
  });
});
