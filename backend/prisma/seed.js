require('dotenv').config();
const { createPrismaClient } = require('../src/db/client');
const { hashPassword } = require('../src/admin/password');

// Operators are provisioned here or by direct DB access — there is no
// signup route, mirroring the customer side's "no accounts" ethos.
// This is a dev/local convenience; a real provisioning process (or the
// admin-settings screen from the build order) replaces it later.
async function main() {
  const email = process.env.OPERATOR_SEED_EMAIL;
  const password = process.env.OPERATOR_SEED_PASSWORD;
  const displayName = process.env.OPERATOR_SEED_NAME || 'Operator';

  if (!email || !password) {
    throw new Error('Set OPERATOR_SEED_EMAIL and OPERATOR_SEED_PASSWORD to seed an operator');
  }

  const prisma = createPrismaClient(process.env.DATABASE_URL);
  const passwordHash = await hashPassword(password);

  const operator = await prisma.operator.upsert({
    where: { email },
    update: { passwordHash, displayName },
    create: { email, passwordHash, displayName },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded operator ${operator.email}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
