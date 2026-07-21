# syntax=docker/dockerfile:1

# ─── Stage 1: Build ───
FROM node:20-alpine AS builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ─── Stage 2: Production ───
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache ffmpeg python3 py3-pip && \
    python3 -m pip install --break-system-packages --upgrade yt-dlp

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/storage

ENV NODE_ENV=production
EXPOSE 3000

COPY backend/start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]