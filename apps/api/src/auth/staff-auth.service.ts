import { Injectable, ForbiddenException } from "@nestjs/common";
import { StaffService } from "./staff.service";
import { cookieToken, StaffController } from "./staff.controller";

type ResponseLike = { setHeader(name: string, value: string): void };
export function assertAllowedOrigin(origin: string | undefined) {
  new StaffController({} as StaffService).prepare({ headers: { origin }, socket: {} }, { setHeader() {} }, true);
}

// Compatibility adapter: canonical staff identities, cookie policy and authorization remain centralized.
@Injectable()
export class StaffAuthService {
  constructor(private readonly staff: StaffService) {}
  async login(slug: string, username: unknown, password: unknown, response: ResponseLike, origin?: string) {
    return new StaffController(this.staff).login({ tenantSlug: slug, username, password }, { headers: { origin, "content-type": "application/json" }, socket: {} }, response);
  }
  async current(slug: string, cookie: string | undefined) {
    return this.staff.authenticate(cookieToken({ headers: { cookie }, socket: {} }), slug);
  }
  async logout(cookie: string | undefined, response: ResponseLike, origin?: string) {
    assertAllowedOrigin(origin);
    // The canonical logout endpoint requires tenant scope; unscoped compatibility logout is disabled.
    throw new ForbiddenException();
  }
}
