# ── Stage 1: runtime base (OS packages, Borg, init system) ───────────────────
FROM node:alpine AS base
RUN apk add --no-cache borgbackup bash tini
ENV BORG_CACHE_DIR=/tmp/borg-cache \
    BORG_CONFIG_DIR=/tmp/borg-config
WORKDIR /app
ENTRYPOINT ["/sbin/tini", "--"]

# ── Stage 2: compile TypeScript ──────────────────────────────────────────────
FROM node:alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ── Stage 3: development (source mounted at runtime, executed via tsx) ────────
FROM base AS dev
COPY package*.json tsconfig.json ./
RUN npm ci --ignore-scripts
CMD ["npx", "tsx", "src/index.ts"]

# ── Stage 4: production (minimal, no devDeps, compiled JS only) ───────────────
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --omit=dev && npm cache clean --force
COPY --from=builder /build/dist ./dist
CMD ["node", "dist/index.js"]
