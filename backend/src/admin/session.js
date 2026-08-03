const jwt = require('jsonwebtoken');

const SESSION_COOKIE = 'cxaf_admin_session';
const TOKEN_TTL = '12h';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function signSession(jwtSecret, operator) {
  return jwt.sign({ sub: operator.id, email: operator.email }, jwtSecret, { expiresIn: TOKEN_TTL });
}

// Throws on missing/invalid/expired token — callers decide how to respond.
function verifySession(jwtSecret, token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { SESSION_COOKIE, TOKEN_TTL_MS, signSession, verifySession };
