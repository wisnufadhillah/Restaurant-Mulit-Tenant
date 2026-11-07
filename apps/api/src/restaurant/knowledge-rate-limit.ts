import { HttpException } from "@nestjs/common";
export class TooManyRequestsException extends HttpException {
  constructor(readonly retryAfterSeconds: number) { super("Too many knowledge requests", 429); }
}
