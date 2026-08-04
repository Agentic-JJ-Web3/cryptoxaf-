// "Notify me when you reopen" from the closed-state screen. No SMS
// integration yet — just captures the number for an operator to follow
// up by hand, same "manual for now" pattern as the rest of the platform.
async function createNotifyRequest(prisma, phone) {
  return prisma.notifyRequest.create({ data: { phone } });
}

module.exports = { createNotifyRequest };
