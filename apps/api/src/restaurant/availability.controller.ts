import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";

@Controller("public/tenants/:slug/availability")
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  check(@Param("slug") slug: string, @Req() request: { url: string }, @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }) {
    response.setHeader("Cache-Control", "no-store");
    const params = new URL(request.url, "http://localhost").searchParams;
    return this.availability.check(slug, params);
  }
}
