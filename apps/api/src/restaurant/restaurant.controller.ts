import { Controller, Get, Param } from "@nestjs/common";
import { RestaurantService } from "./restaurant.service";
import { HoursService } from "./hours.service";

@Controller("public/tenants")
export class RestaurantController {
  constructor(private readonly restaurant: RestaurantService, private readonly hours: HoursService) {}

  @Get(":slug/hours")
  schedule(@Param("slug") slug: string) { return this.hours.publicList(slug); }

  @Get(":slug/restaurant")
  info(@Param("slug") slug: string) { return this.restaurant.info(slug); }
}
