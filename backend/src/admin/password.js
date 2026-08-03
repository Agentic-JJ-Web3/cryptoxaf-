const bcrypt = require('bcryptjs');

const BCRYPT_COST = 12;

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = { hashPassword, verifyPassword };
