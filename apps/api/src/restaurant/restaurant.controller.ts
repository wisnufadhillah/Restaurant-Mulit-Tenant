import { Controller, Get, Headers, Param } from "@nestjs/common";
import { RestaurantService } from "./restaurant.service";

@Controller("public/tenants")
export class RestaurantController {
  constructor(private readonly restaurant: RestaurantService) {}

  @Get(":slug/restaurant")
  info(@Param("slug") slug: string) { return this.restaurant.info(slug); }

  @Get("internal/:slug/restaurant")
  internalInfo(@Param("slug") slug: string, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.restaurant.internalInfo(slug, headers["x-internal-service-token"], headers["x-internal-context"], headers["x-session-id"]);
  }

}
