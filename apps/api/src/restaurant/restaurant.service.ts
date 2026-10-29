import { Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";

export function localScheduleDate(now: Date, timezone = "Asia/Jakarta") {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

@Injectable()
export class RestaurantService implements OnModuleDestroy {
  private readonly database = createDatabaseClient();

  async info(slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new NotFoundException();
    const now = new Date();
    const date = localScheduleDate(now);
    const calendarDate = new Date(`${date}T00:00:00.000Z`);
    let tenant;
    try {
      tenant = await this.database.tenant.findFirst({
        where: { slug, status: "active" },
        select: {
          slug: true, name: true,
          outlets: {
            where: { isActive: true }, orderBy: { id: "asc" },
            select: { name: true, address: true, contactPhone: true, timezone: true, durationMinutes: true, minNoticeMinutes: true, maxAdvanceDays: true, cancelCutoffMinutes: true, maxPartySize: true, specialHours: { where: { date: calendarDate }, select: { openMinute: true, closeMinute: true } }, weeklyHours: { orderBy: { weekday: "asc" }, select: { weekday: true, openMinute: true, closeMinute: true } } },
          },
        },
      });
    } catch { throw new ServiceUnavailableException(); }
    if (!tenant) throw new NotFoundException();
    const outlets = tenant.outlets.map(({ specialHours, ...outlet }) => {
      const special = specialHours[0];
      const weekly = outlet.weeklyHours.find(row => row.weekday === calendarDate.getUTCDay());
      const schedule = special ?? weekly;
      return { ...outlet, todayHours: { date, timezone: outlet.timezone, configured: !!schedule, source: special ? "special" : weekly ? "weekly" : "unconfigured", openMinute: schedule?.openMinute ?? null, closeMinute: schedule?.closeMinute ?? null } };
    });
    return { data: { ...tenant, outlets }, retrieved_at: now.toISOString(), source: "restaurant_api" };
  }

  async onModuleDestroy() { await this.database.$disconnect(); }
}
