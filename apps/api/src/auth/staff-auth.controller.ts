import { Body, Controller, Headers, Post, Res } from "@nestjs/common";
import { StaffAuthService } from "./staff-auth.service";
type ResponseLike = { setHeader(name: string, value: string): void };

@Controller("staff")
export class StaffAuthController {
  constructor(private readonly auth: StaffAuthService) {}

  @Post("login")
  login(@Body() body: Record<string, unknown>, @Headers("origin") origin: string | undefined, @Res({ passthrough: true }) response: ResponseLike) { return this.auth.login(typeof body.tenantSlug === "string" ? body.tenantSlug : "", body.email, body.password, response, origin); }

  @Post("logout")
  logout(@Headers("cookie") cookie: string | undefined, @Headers("origin") origin: string | undefined, @Res({ passthrough: true }) response: ResponseLike) { return this.auth.logout(cookie, response, origin); }
}
