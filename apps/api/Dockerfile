# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS dependencies
WORKDIR /workspace/apps/api
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY apps/api/package.json apps/api/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY apps/api/ ./
COPY infra/db/migrations /workspace/infra/db/migrations
RUN pnpm build && pnpm prune --prod

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    SERVICE_NAME=almac-api \
    PORT=4000 \
    MIGRATIONS_DIR=/workspace/infra/db/migrations
WORKDIR /workspace/apps/api
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./
COPY --from=build --chown=node:node /workspace/apps/api/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/infra /workspace/infra
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
