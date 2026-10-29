import { Body, Controller, Headers, Param, Patch, Put } from "@nestjs/common";
import { RestaurantService } from "./restaurant.service";

@Controller("staff")
export class StaffCatalogueController {
  constructor(private readonly restaurant: RestaurantService) {}
  @Patch(":slug/menu/:id")
  updateMenu(@Param("slug") slug: string, @Param("id") id: string, @Body() body: Record<string, unknown>, @Headers("cookie") cookie: string | undefined, @Headers("origin") origin: string | undefined) { return this.restaurant.updateMenu(slug, id, body, cookie, origin); }
  @Patch(":slug/tables/:id")
  updateTable(@Param("slug") slug: string, @Param("id") id: string, @Body() body: Record<string, unknown>, @Headers("cookie") cookie: string | undefined, @Headers("origin") origin: string | undefined) { return this.restaurant.updateTable(slug, id, body, cookie, origin); }
  @Put(":slug/hours/:dayOfWeek")
  updateHours(@Param("slug") slug: string, @Param("dayOfWeek") dayOfWeek: string, @Body() body: Record<string, unknown>, @Headers("cookie") cookie: string | undefined, @Headers("origin") origin: string | undefined) { return this.restaurant.updateHours(slug, Number(dayOfWeek), body, cookie, origin); }
}
