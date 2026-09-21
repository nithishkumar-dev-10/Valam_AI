# syntax=docker/dockerfile:1
# =============================================================================
# Valam AI frontend — build the Vite/React SPA and serve it with nginx.
#
#   docker build --build-arg VITE_API_BASE_URL=https://api.valam.in -t valam-frontend ./frontend
#
# The API base URL is a BUILD-TIME value (Vite inlines import.meta.env.*), so it
# must match the environment this bundle will talk to:
#   * local docker-compose : http://localhost:8000
#   * production web       : https://api.valam.in
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — build the static bundle
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Install deps from the lockfile first (cached layer).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — static file server
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS serve

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
