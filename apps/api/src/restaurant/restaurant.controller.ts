import { Controller, Get, Param } from "@nestjs/common";
import { RestaurantService } from "./restaurant.service";

@Controller("public/tenants")
export class RestaurantController {
  constructor(private readonly restaurant: RestaurantService) {}

  @Get(":slug/restaurant")
  info(@Param("slug") slug: string) { return this.restaurant.info(slug); }
}
