import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

import { RestaurantController } from "./restaurant/restaurant.controller";
import { StaffCatalogueController } from "./restaurant/staff-catalogue.controller";
import { RestaurantService } from "./restaurant/restaurant.service";
import { StaffAuthController } from "./auth/staff-auth.controller";
import { StaffAuthService } from "./auth/staff-auth.service";

@Module({ controllers: [HealthController, RestaurantController, StaffCatalogueController, StaffAuthController], providers: [RestaurantService, StaffAuthService] })
export class AppModule {}
