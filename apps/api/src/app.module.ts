import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

import { RestaurantController } from "./restaurant/restaurant.controller";
import { RestaurantService } from "./restaurant/restaurant.service";

@Module({ controllers: [HealthController, RestaurantController], providers: [RestaurantService] })
export class AppModule {}
