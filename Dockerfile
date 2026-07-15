# ── Build stage ────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/cache
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV CACHE_DIR=/app/cache
EXPOSE 3000
CMD ["node", "dist/index.js"]
