const { prisma } = require('./testDb');
const { createApp } = require('../src/app');

function buildTestApp() {
  return createApp({ prisma, jwtSecret: process.env.JWT_SECRET, isProduction: false });
}

module.exports = { buildTestApp };
