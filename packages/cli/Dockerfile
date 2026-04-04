# @recon-web/cli — Lightweight CLI image (no Chromium)
# Build context must be the repo root: docker build -f packages/cli/Dockerfile .

# ── Build stage ───────────────────────────────────────────
FROM node:22-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/cli/package.json packages/cli/
COPY packages/web/package.json packages/web/

RUN npm ci --ignore-scripts

COPY packages/core/tsconfig.json packages/core/tsconfig.json
COPY packages/core/src/ packages/core/src/
COPY packages/cli/tsconfig.json packages/cli/tsconfig.json
COPY packages/cli/src/ packages/cli/src/

# Build only core + cli
RUN npx tsc -b packages/core packages/cli

# ── Runtime stage ─────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/cli/package.json packages/cli/
COPY packages/web/package.json packages/web/

RUN npm ci --omit=dev --ignore-scripts && \
    rm -rf /root/.npm

COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/cli/dist packages/cli/dist

ENV NODE_ENV=production

ENTRYPOINT ["node", "packages/cli/dist/index.js"]
