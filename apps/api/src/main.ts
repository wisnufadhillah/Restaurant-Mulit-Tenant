import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  await app.listen(3001, "127.0.0.1");
  console.info("API listening at http://127.0.0.1:3001/api/v1");
  console.info("Health: http://127.0.0.1:3001/api/v1/health (process liveness only)");
  if (process.env.NODE_ENV !== "production") console.info("API docs: http://127.0.0.1:3001/docs");
}

void bootstrap().catch(() => {
  console.error("API startup failed; configuration details suppressed");
  process.exitCode = 1;
});
