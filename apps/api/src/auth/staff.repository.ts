import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { activeStaffSessionWhere } from "./staff-session-policy";

export interface StaffAccount {
  id: string; tenantId: string; username: string; passwordHash: string; role: string; isActive: boolean;
  tenant: { status: string; slug: string };
}
export interface StaffSessionRecord {
  tokenHash: string; tenantId: string; staffId: string; createdAt: Date; lastActivityAt: Date; expiresAt: Date; revokedAt: Date | null;
  staff: StaffAccount;
}

@Injectable()
export class StaffRepository implements OnModuleDestroy {
  private readonly database = createDatabaseClient();

  account(slug: string, username: string): Promise<StaffAccount | null> {
    return this.database.staff.findFirst({
      where: { username, tenant: { slug, status: "active" }, isActive: true },
      include: { tenant: { select: { status: true, slug: true } } },
    });
  }

  async createSession(data: { tenantId: string; staffId: string; tokenHash: string; createdAt: Date; lastActivityAt: Date; expiresAt: Date }) {
    await this.database.staffSession.create({ data });
  }

  session(tokenHash: string): Promise<StaffSessionRecord | null> {
    return this.database.staffSession.findUnique({
      where: { tokenHash }, include: { staff: { include: { tenant: { select: { status: true, slug: true } } } } },
    });
  }

  async activity(tokenHash: string, slug: string) {
    return this.database.$transaction(async tx => {
      const [session] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM staff_sessions WHERE token_hash = ${tokenHash} FOR UPDATE`;
      if (!session) return { count: 0 };
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const active = activeStaffSessionWhere(now);
      return tx.staffSession.updateMany({
        where: { id: session.id, tokenHash, ...active, lastActivityAt: { ...active.lastActivityAt, lte: now }, staff: { ...active.staff, tenant: { slug, status: "active" } } },
        data: { lastActivityAt: now },
      });
    }, { isolationLevel: "ReadCommitted", maxWait: 2000, timeout: 5000 });
  }

  async revoke(tokenHash: string) {
    await this.database.staffSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async onModuleDestroy() { await this.database.$disconnect(); }
}
