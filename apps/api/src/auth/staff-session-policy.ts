export const STAFF_IDLE_MS = 30 * 60 * 1000;
export const STAFF_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export function activeStaffSessionWhere(now: Date) {
  return {
    revokedAt: null,
    expiresAt: { gt: now },
    createdAt: { gt: new Date(now.getTime() - STAFF_ABSOLUTE_MS) },
    lastActivityAt: { gt: new Date(now.getTime() - STAFF_IDLE_MS) },
    staff: { isActive: true, role: { in: ["owner", "staff"] }, tenant: { status: "active" } },
  };
}

export function staffSessionDeadline(session: { createdAt: Date; lastActivityAt: Date; expiresAt: Date }) {
  return Math.min(session.lastActivityAt.getTime() + STAFF_IDLE_MS, session.createdAt.getTime() + STAFF_ABSOLUTE_MS, session.expiresAt.getTime());
}
