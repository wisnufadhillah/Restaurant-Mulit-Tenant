import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  await app.listen(3001, "127.0.0.1");
}

void bootstrap().catch(() => {
  console.error("API startup failed; configuration details suppressed");
  process.exitCode = 1;
});
