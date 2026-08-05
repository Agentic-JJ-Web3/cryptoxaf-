// "Notify me when you reopen" requests from the closed-state screen —
// captured by src/customer/notifyService.js, followed up here by hand
// (no SMS integration yet, same "manual for now" pattern as everything
// else — see CLAUDE.md).

async function listNotifyRequests(prisma) {
  const requests = await prisma.notifyRequest.findMany({ orderBy: { createdAt: 'asc' } });
  return {
    requests,
    pendingCount: requests.filter((r) => !r.notifiedAt).length,
  };
}

async function markNotified(prisma, { id, operator }) {
  const existing = await prisma.notifyRequest.findUnique({ where: { id } });
  if (!existing) return null;

  // Idempotent: a second tap (or a slow connection double-submit) just
  // returns the already-notified record instead of overwriting the
  // original notifiedAt or writing a duplicate audit entry.
  if (existing.notifiedAt) return existing;

  const updated = await prisma.notifyRequest.update({
    where: { id },
    data: { notifiedAt: new Date() },
  });

  await prisma.adminAuditLog.create({
    data: {
      actor: `operator:${operator.id}`,
      action: 'notifyRequest.markNotified',
      metadata: { notifyRequestId: id },
    },
  });

  return updated;
}

module.exports = { listNotifyRequests, markNotified };
