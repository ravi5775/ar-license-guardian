# self-hosted branch image. Node adapter, no native modules, no server ffmpeg.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
ENV RUNTIME=node DB_DRIVER=postgres RATELIMIT_DRIVER=redis
RUN bun run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production RUNTIME=node DB_DRIVER=postgres RATELIMIT_DRIVER=redis
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/server/server.js"]
