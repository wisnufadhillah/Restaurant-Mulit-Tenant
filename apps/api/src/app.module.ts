import { Module } from "@nestjs/common";
import { StaffReservationsController } from "./restaurant/staff-reservations.controller";
import { StaffReservationsService } from "./restaurant/staff-reservations.service";
import { KnowledgeController } from "./restaurant/knowledge.controller";
import { KnowledgeRepository } from "./restaurant/knowledge.repository";
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

import { InternalToolsController } from "./restaurant/internal-tools.controller";
import { ChatSessionsService } from "./restaurant/chat-sessions.service";
import { ChatSessionController } from "./restaurant/chat-session.controller";
import { ChatCatalogueController } from "./restaurant/chat-catalogue.controller";
import { ChatMessageController, ConversationTransport } from "./restaurant/chat-message.controller";
import { AvailabilityController } from "./restaurant/availability.controller";
import { AvailabilityService } from "./restaurant/availability.service";
import { AvailabilityRepository } from "./restaurant/availability.repository";
import { ReservationController } from "./restaurant/reservation.controller";
import { ReservationService } from "./restaurant/reservation.service";
import { ReservationRepository } from "./restaurant/reservation.repository";
import { OrdersController } from "./restaurant/orders.controller";

@Module({ controllers: [OrdersController, StaffReservationsController, KnowledgeController, ReservationController, AvailabilityController, ChatMessageController, ChatCatalogueController, ChatSessionController, InternalToolsController, HealthController, RestaurantController, StaffController, MenuController, TableController, HoursController, ProfileController, SpecialHoursController], providers: [StaffReservationsService, KnowledgeRepository, ReservationService, ReservationRepository, AvailabilityService, AvailabilityRepository, ConversationTransport, ChatSessionsService, RestaurantService, StaffService, StaffRepository, MenuService, TableService, HoursService, ProfileService, SpecialHoursService] })
export class AppModule {}
