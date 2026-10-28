import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { INestApplication } from "@nestjs/common";

export function registerApiDocs(app: INestApplication) {
  if (process.env.NODE_ENV === "production") return;
  const spec = JSON.parse(readFileSync(resolve(__dirname, "../../../docs/api/openapi.json"), "utf8"));
  const router = app.getHttpAdapter();
  router.get("/openapi.json", (_request: unknown, response: { json(value: unknown): void }) => response.json(spec));
  router.get("/docs", (_request: unknown, response: { type(value: string): void; send(value: string): void; setHeader(name: string, value: string): void }) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.type("text/html");
    response.send(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Restaurant API — Scalar</title></head>
<body><div id="app"></div><noscript>Aktifkan JavaScript untuk Scalar. Spesifikasi tersedia di /openapi.json.</noscript>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.0/dist/browser/standalone.js"></script>
<script>Scalar.createApiReference('#app', { url: '/openapi.json', layout: 'modern', agent: { disabled: true }, telemetry: false, persistAuth: false, hideTestRequestButton: true, hideClientButton: true, proxyUrl: '' })</script>
</body></html>`);
  });
}
