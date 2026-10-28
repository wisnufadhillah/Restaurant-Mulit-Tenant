import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

import { RestaurantController } from "./restaurant/restaurant.controller";
import { RestaurantService } from "./restaurant/restaurant.service";
import { StaffController } from "./auth/staff.controller";
import { StaffService } from "./auth/staff.service";
import { StaffRepository } from "./auth/staff.repository";

import { MenuController } from "./menu/menu.controller";
import { MenuService } from "./menu/menu.service";

import { TableController } from "./restaurant/table.controller";
import { TableService } from "./restaurant/table.service";

import { HoursController } from "./restaurant/hours.controller";
import { HoursService } from "./restaurant/hours.service";

import { ProfileController, ProfileService } from "./restaurant/profile.controller";

import { SpecialHoursController } from "./restaurant/special-hours.controller";
import { SpecialHoursService } from "./restaurant/special-hours.service";

@Module({ controllers: [HealthController, RestaurantController, StaffController, MenuController, TableController, HoursController, ProfileController, SpecialHoursController], providers: [RestaurantService, StaffService, StaffRepository, MenuService, TableService, HoursService, ProfileService, SpecialHoursService] })
export class AppModule {}
