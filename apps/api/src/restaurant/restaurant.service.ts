import { Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";

@Injectable()
export class RestaurantService implements OnModuleDestroy {
  private readonly database = createDatabaseClient();

  async info(slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new NotFoundException();
    let tenant;
    try {
      tenant = await this.database.tenant.findFirst({
        where: { slug, status: "active" },
        select: {
          slug: true, name: true,
          outlets: {
            where: { isActive: true }, orderBy: { id: "asc" },
            select: { name: true, address: true, contactPhone: true, timezone: true, durationMinutes: true, minNoticeMinutes: true, maxAdvanceDays: true, cancelCutoffMinutes: true, maxPartySize: true },
          },
        },
      });
    } catch { throw new ServiceUnavailableException(); }
    if (!tenant) throw new NotFoundException();
    return { data: tenant, retrieved_at: new Date().toISOString(), source: "restaurant_api" };
  }

  async onModuleDestroy() { await this.database.$disconnect(); }
}
