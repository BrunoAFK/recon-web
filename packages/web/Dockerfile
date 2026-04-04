# @recon-web/web — Frontend-only image (nginx + reverse proxy)
# Build context must be the repo root: docker build -f packages/web/Dockerfile .

# ── Build stage ───────────────────────────────────────────
FROM node:22-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/api/package.json packages/api/
COPY packages/cli/package.json packages/cli/
COPY packages/web/package.json packages/web/

RUN npm ci --ignore-scripts

# Web needs core types for build, plus its own source
COPY packages/core/tsconfig.json packages/core/tsconfig.json
COPY packages/core/src/ packages/core/src/
COPY packages/web/tsconfig.json packages/web/tsconfig.json
COPY packages/web/tsconfig.node.json* packages/web/
COPY packages/web/vite.config.ts packages/web/
COPY packages/web/index.html packages/web/
COPY packages/web/public/ packages/web/public/
COPY packages/web/src/ packages/web/src/

# Build core (needed for type resolution) then web
RUN npx tsc -b packages/core
RUN npm run build --workspace=@recon-web/web

# ── Runtime stage ─────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf.template /etc/nginx/templates/default.conf.template

ENV API_UPSTREAM=http://api:3000

EXPOSE 80
