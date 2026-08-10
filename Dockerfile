# ── Stage 1: compile TypeScript ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ── Stage 2: development (borgbackup + ts-node, source mounted at runtime) ───
FROM node:20-alpine AS dev
RUN apk add --no-cache borgbackup bash
ENV BORG_CACHE_DIR=/tmp/borg-cache \
    BORG_CONFIG_DIR=/tmp/borg-config
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci --ignore-scripts
CMD ["npx", "ts-node", "src/index.ts"]

# ── Stage 3: production (minimal, no devDeps, compiled JS only) ───────────────
FROM node:20-alpine AS production
RUN apk add --no-cache borgbackup bash
ENV BORG_CACHE_DIR=/tmp/borg-cache \
    BORG_CONFIG_DIR=/tmp/borg-config
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --omit=dev
COPY --from=builder /build/dist ./dist
CMD ["node", "dist/index.js"]
