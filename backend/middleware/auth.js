const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'shree_mithai_super_secret_jwt_key_2026';

function signToken(user) {
  return jwt.sign(
    {
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      avatar: user.avatar || ''
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function extractUserFromRequest(req) {
  const candidates = [];

  // 1. Custom headers (immune to cloud preview proxies overwriting Authorization)
  if (req.headers['x-auth-token']) {
    candidates.push(String(req.headers['x-auth-token']).trim());
  }
  if (req.headers['x-admin-token']) {
    candidates.push(String(req.headers['x-admin-token']).trim());
  }

  // 2. Query string token fallback (?authToken=...)
  if (req.query && req.query.authToken) {
    candidates.push(String(req.query.authToken).trim());
  }

  // 3. Standard Authorization: Bearer <token>
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    candidates.push(header.slice(7).trim());
  }

  for (const token of candidates) {
    if (!token || token === 'null' || token === 'undefined') continue;
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (_err) {
      // Try next token candidate
    }
  }
  return null;
}

function requireAuth(req, res, next) {
  const user = extractUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  req.user = user;
  next();
}

function optionalAuth(req, _res, next) {
  req.user = extractUserFromRequest(req);
  next();
}

function requireAdmin(req, res, next) {
  const user = extractUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required. Please sign in on the Admin Console.' });
  }
  req.user = user;
  next();
}

module.exports = { signToken, requireAuth, optionalAuth, requireAdmin };
