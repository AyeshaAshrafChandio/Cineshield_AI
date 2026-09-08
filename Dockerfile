# Multi-stage production Dockerfile for CineShield AI on Google Cloud Run
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source code and configuration files
COPY . .

# Compile frontend SPA and backend bundle (dist/server.cjs)
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled distribution bundle and static assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Security: Run as unprivileged node user
USER node

EXPOSE 3000

# Container liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.cjs"]
