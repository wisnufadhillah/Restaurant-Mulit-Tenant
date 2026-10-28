import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";

export interface StaffAccount {
  id: string; tenantId: string; username: string; passwordHash: string; role: string; isActive: boolean;
  tenant: { status: string; slug: string };
}
export interface StaffSessionRecord {
  tokenHash: string; tenantId: string; staffId: string; expiresAt: Date; revokedAt: Date | null;
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

  async createSession(data: { tenantId: string; staffId: string; tokenHash: string; expiresAt: Date }) {
    await this.database.staffSession.create({ data });
  }

  session(tokenHash: string): Promise<StaffSessionRecord | null> {
    return this.database.staffSession.findUnique({
      where: { tokenHash }, include: { staff: { include: { tenant: { select: { status: true, slug: true } } } } },
    });
  }

  async revoke(tokenHash: string) {
    await this.database.staffSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async onModuleDestroy() { await this.database.$disconnect(); }
}
