# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ============================================
# Stage 2: Generate Prisma client
# ============================================
FROM node:20-alpine AS prisma
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Create output directory and generate Prisma client
RUN mkdir -p src/generated/prisma
RUN npx prisma generate

# ============================================
# Stage 3: Build the application
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=prisma /app/node_modules ./node_modules
COPY . .
# Copy generated Prisma client AFTER `COPY . .` so it isn't overwritten
# (src/generated/prisma is gitignored and absent from the build context)
COPY --from=prisma /app/src/generated ./src/generated

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./dev.db"

RUN npm run build

# ============================================
# Stage 4: Install runtime-only deps (with build tools)
# ============================================
FROM node:20-alpine AS runtime-deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Start from standalone's node_modules so npm install adds to them
COPY --from=builder /app/.next/standalone/node_modules ./node_modules
RUN echo '{"private":true}' > package.json
RUN npm install --no-save prisma@7.4.1 @prisma/adapter-libsql @libsql/client bcryptjs

# ============================================
# Stage 5: Production runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema, config, migrations and generated client for runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated

# Copy pre-built runtime dependencies (no build tools needed here)
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy seed and migration scripts
COPY --from=builder /app/scripts ./scripts

# Bundle a database snapshot so first boot can start with preloaded user data
COPY --from=builder /app/seed-data/cultivation.seed.sqlite /app/seed/cultivation.db

# Create data directory for SQLite and set permissions
RUN mkdir -p /app/data /app/seed && chown -R nextjs:nodejs /app/data /app/seed

# Startup script normalization strips UTF-8 BOM + CRLF to prevent exec errors
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN set -eux; \
    if [ "$(head -c 3 /app/docker-entrypoint.sh | od -An -t x1 | tr -d ' \n')" = "efbbbf" ]; then \
      tail -c +4 /app/docker-entrypoint.sh > /app/docker-entrypoint.sh.nobom; \
      mv /app/docker-entrypoint.sh.nobom /app/docker-entrypoint.sh; \
    fi; \
    sed -i 's/\r$//' /app/docker-entrypoint.sh; \
    chmod +x /app/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/checkins || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
