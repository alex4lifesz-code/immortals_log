FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=1536
ENV DATABASE_URL=file:/app/data/immortals.db
ENV JWT_SECRET=build-time-placeholder-change-me
ENV APP_URL=http://localhost:4400
ENV NEXT_PUBLIC_APP_URL=http://localhost:4400
ENV COOKIE_SECURE=false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=1536
ENV PORT=4400
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated
EXPOSE 4400
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "4400"]
