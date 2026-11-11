const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Verifies the Bearer token on the request and attaches the decoded
 * payload to req.user. Rejects with 401 if missing/invalid/expired.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    // MILESTONE 9: 2FA-pending tokens carry a `purpose` claim and are
    // deliberately rejected here — they're only valid at the
    // /auth/2fa/login-verify endpoint (which checks purpose itself,
    // not via this middleware). Without this check, a pending token
    // would still pass authenticate() on routes that don't also use
    // authorize(), since it's incidentally missing fields like `role`
    // rather than being explicitly barred.
    if (decoded.purpose) {
      return res.status(401).json({ error: 'Two-factor verification required.' });
    }
    req.user = decoded;
    return next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired. Please log in again.'
        : 'Invalid authentication token.';
    return res.status(401).json({ error: message });
  }
}

/**
 * Restricts a route to specific roles. Use after authenticate().
 *   router.get('/admin-only', authenticate, authorize('admin'), handler)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
