# syntax=docker/dockerfile:1

# ─── Stage 1: Build ───
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Production ───
FROM node:20-alpine AS runner
WORKDIR /app

# Install FFmpeg and yt-dlp
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    python3 -m pip install --break-system-packages --upgrade yt-dlp

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Create storage directory for local fallback
RUN mkdir -p /app/storage

ENV NODE_ENV=production
EXPOSE 3000

# Copy startup script (writes YOUTUBE_COOKIES env var to /app/cookies.txt for yt-dlp)
COPY start.sh ./
RUN chmod +x start.sh

CMD ["./start.sh"]