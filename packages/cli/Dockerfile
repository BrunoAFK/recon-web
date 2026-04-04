# @recon-web/cli — Lightweight CLI image (no Chromium)
# Build context must be the repo root: docker build -f packages/cli/Dockerfile .

# ── Build stage ───────────────────────────────────────────
# node:24.14.1-bookworm
FROM node@sha256:bb20cf73b3ad7212834ec48e2174cdcb5775f6550510a5336b842ae32741ce6c AS build

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
# node:24.14.1-alpine3.23
FROM node@sha256:01743339035a5c3c11a373cd7c83aeab6ed1457b55da6a69e014a95ac4e4700b AS runtime

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
