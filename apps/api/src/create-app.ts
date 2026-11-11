import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiErrorFilter } from "./http/error.filter";
import { registerApiDocs } from "./api-docs";

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  const origins = (process.env.API_ALLOWED_ORIGINS ?? "http://127.0.0.1:3000,http://localhost:3000").split(",").map(value => value.trim()).filter(Boolean);
  if (process.env.NODE_ENV === "production" && origins.some(origin => origin.startsWith("http://"))) throw new Error("Production CORS must use HTTPS origins");
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalFilters(new ApiErrorFilter());
  registerApiDocs(app);
  return app;
}
