# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS dependencies
WORKDIR /workspace/apps/web
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY apps/web/package.json apps/web/pnpm-lock.yaml apps/web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY apps/web/ ./
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_STORAGE_ROOT=/data/uploads
WORKDIR /workspace/apps/web
COPY --from=build --chown=node:node /workspace/apps/web/public ./public
COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone/apps/web ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./.next/static
COPY --from=build --chown=node:node /workspace/apps/web/scripts ./scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "scripts/start-production.mjs"]
