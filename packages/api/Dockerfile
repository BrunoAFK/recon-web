# @recon-web/api — API-only image (no frontend)
# Build context must be the repo root: docker build -f packages/api/Dockerfile .

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
COPY packages/api/tsconfig.json packages/api/tsconfig.json
COPY packages/api/src/ packages/api/src/

# Build only core + api (not cli/web)
RUN npx tsc -b packages/core packages/api

# ── Runtime stage ─────────────────────────────────────────
# node:24.14.1-bookworm-slim
FROM node@sha256:06e5c9f86bfa0aaa7163cf37a5eaa8805f16b9acb48e3f85645b09d459fc2a9f AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      chromium \
      traceroute \
      ca-certificates \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libdrm2 \
      libxkbcommon0 \
      libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/cli/package.json packages/cli/
COPY packages/web/package.json packages/web/

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    npm ci --omit=dev && \
    apt-get purge -y python3 make g++ && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /root/.npm

COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/api/dist packages/api/dist

ENV NODE_ENV=production
ENV CHROME_PATH=/usr/bin/chromium
ENV STATIC_DIR=none
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "packages/api/dist/index.js"]
