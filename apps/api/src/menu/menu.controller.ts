import { Body, Controller, Get, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { StaffController, StaffRequest, StaffResponse, cookieToken } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import { MenuService } from "./menu.service";
import { Readable } from "node:stream";
type ImageResponse = StaffResponse & { send(body: Buffer): unknown };

@Controller()
export class MenuController {
  constructor(private readonly menu: MenuService, private readonly staff: StaffService) {}
  private async actor(slug: string, request: StaffRequest, response: StaffResponse, mutation: boolean, owner = false) {
    new StaffController(this.staff).prepare(request, response, mutation);
    return this.staff.authenticate(cookieToken(request), slug, owner ? ["owner"] : ["owner", "staff"]);
  }
  @Get("public/tenants/:slug/menu")
  publicList(@Param("slug") slug: string) { return this.menu.publicList(slug); }
  @Get("public/tenants/:slug/menu/catalogue")
  publicCatalogue(@Param("slug") slug: string) { return this.menu.publicList(slug, true); }
  @Get("staff/tenants/:slug/menu")
  async list(@Param("slug") slug: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, false); return this.menu.list(actor.tenantId);
  }
  @Post("staff/tenants/:slug/menu/images")
  async upload(@Param("slug") slug: string, @Req() request: StaffRequest & Readable, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, true, true);
    return this.menu.upload(actor.tenantId, request);
  }
  @Get("staff/tenants/:slug/menu/images/:key")
  async staffImage(@Param("slug") slug: string, @Param("key") key: string, @Req() request: StaffRequest, @Res() response: ImageResponse) {
    const actor = await this.actor(slug, request, response, false);
    const image = await this.menu.image(key, actor.tenantId);
    response.setHeader("Content-Type", "image/webp"); response.setHeader("X-Content-Type-Options", "nosniff");
    return response.send(image);
  }
  @Get("public/tenants/:slug/menu/images/:key")
  async publicImage(@Param("slug") slug: string, @Param("key") key: string, @Res() response: ImageResponse) {
    const image = await this.menu.image(key, undefined, slug);
    response.setHeader("Content-Type", "image/webp"); response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    return response.send(image);
  }
  @Post("staff/tenants/:slug/menu")
  async create(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, true, true); return this.menu.create(actor.tenantId, body, actor.id);
  }
  @Patch("staff/tenants/:slug/menu/:id")
  async update(@Param("slug") slug: string, @Param("id") id: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, true, true); return this.menu.update(actor.tenantId, id, body, false, actor.id);
  }
  @Patch("staff/tenants/:slug/menu/:id/availability")
  async availability(@Param("slug") slug: string, @Param("id") id: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, true); return this.menu.update(actor.tenantId, id, body, true, actor.id);
  }
}
