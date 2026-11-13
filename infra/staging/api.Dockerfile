FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @restaurant/api...
COPY apps/api apps/api
# Generation validates configuration but does not connect to a database.
RUN DATABASE_URL=postgresql://offline@127.0.0.1:1/offline pnpm --filter @restaurant/api build
RUN mkdir -p /app/.local/menu-images && chown node:node /app/.local/menu-images

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
RUN chown node:node /app/.local/menu-images && chmod 700 /app/.local/menu-images
COPY infra/staging/api-entrypoint.cjs /app/infra/staging/api-entrypoint.cjs
USER node
WORKDIR /app/apps/api
ENTRYPOINT ["node", "/app/infra/staging/api-entrypoint.cjs"]
CMD ["serve"]
