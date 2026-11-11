import { createApp } from "./create-app";

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.API_HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid API port");
  await app.listen(port, host);
  console.info(`API listening at ${host}:${port}/api/v1`);
  console.info(`Health: ${host}:${port}/api/v1/health (process liveness only)`);
  if (process.env.NODE_ENV !== "production") console.info("API docs: http://127.0.0.1:3001/docs");
}

void bootstrap().catch(() => {
  console.error("API startup failed; configuration details suppressed");
  process.exitCode = 1;
});
