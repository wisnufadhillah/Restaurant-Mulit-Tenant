import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiErrorFilter } from "./http/error.filter";
import { registerApiDocs } from "./api-docs";

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: ["http://127.0.0.1:3000", "http://localhost:3000"], credentials: true });
  app.useGlobalFilters(new ApiErrorFilter());
  registerApiDocs(app);
  return app;
}
