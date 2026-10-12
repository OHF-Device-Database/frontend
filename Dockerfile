# syntax=docker/dockerfile:1

# Build the Astro app with the standalone Node adapter (used everywhere except
# on Netlify).
# --platform=$BUILDPLATFORM: dist/ is architecture-independent (pure JS), so
# run the build once natively instead of once per target platform under QEMU.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app

# All app config (NOINDEX, API_AUTHORITY) is runtime-only (astro:env secrets):
# nothing is baked in at build time, so one image serves every environment.
# Pass the values with -e at run time; NOINDEX defaults to true (no indexing).

# Enable pnpm via corepack, pinned to the version in package.json.
RUN corepack enable

# Install dependencies (cached unless the lockfile changes).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Build the standalone server output into dist/.
COPY . .
RUN pnpm build

# Production dependencies the server imports at runtime. Runs on the target
# platform so packages with native binaries get the right ones.
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Runtime image: Node, the server output and its production dependencies.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Host/port the standalone server binds to. HOST=0.0.0.0 is required in a container.
ENV HOST=0.0.0.0
ENV PORT=4321

# tini reaps zombies and forwards signals so `docker stop` shuts down cleanly.
RUN apk add --no-cache tini

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/" || exit 1

# Run as the built-in unprivileged node user.
USER node

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "./dist/server/entry.mjs"]
