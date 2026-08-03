const bcrypt = require('bcryptjs');
const { verifyPassword } = require('./password');
const { InvalidCredentialsError } = require('./errors');

// A syntactically valid hash so a login attempt against a non-existent
// email still pays the bcrypt cost — same response time whether or not
// the account exists, so the endpoint can't be used to enumerate emails.
const DUMMY_HASH = bcrypt.hashSync('no-such-operator', 12);

// Every attempt is written to AdminAuditLog, success or failure — this is
// the admin route audit trail CLAUDE.md's Security section calls for.
async function attemptLogin(prisma, { email, password, ip, userAgent }) {
  const operator = await prisma.operator.findUnique({ where: { email } });
  const valid = await verifyPassword(password, operator?.passwordHash ?? DUMMY_HASH);

  if (!operator || !operator.isActive || !valid) {
    await prisma.adminAuditLog.create({
      data: { actor: `unknown:${email}`, action: 'operator.login.failure', ip, userAgent },
    });
    throw new InvalidCredentialsError();
  }

  await prisma.adminAuditLog.create({
    data: { actor: `operator:${operator.id}`, action: 'operator.login.success', ip, userAgent },
  });

  return operator;
}

module.exports = { attemptLogin };
