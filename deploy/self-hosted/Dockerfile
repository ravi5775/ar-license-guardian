# Multi-stage hardened production Dockerfile for Aether AR
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
ENV RUNTIME=node DB_DRIVER=postgres RATELIMIT_DRIVER=redis NODE_ENV=production
RUN bun run build

FROM node:22-alpine AS runtime
WORKDIR /app

# Security: run as non-root user
USER node

ENV NODE_ENV=production \
    RUNTIME=node \
    DB_DRIVER=postgres \
    RATELIMIT_DRIVER=redis \
    PORT=3000

COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/server.js"]
