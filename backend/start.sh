#!/bin/sh
# Write YouTube cookies from env var to file for yt-dlp
if [ -n "$YOUTUBE_COOKIES" ]; then
  printf '%s\n' "$YOUTUBE_COOKIES" | tr -d '\r' > /app/cookies.txt
  echo "start.sh: Wrote YOUTUBE_COOKIES to /app/cookies.txt ($(wc -l < /app/cookies.txt) lines)"
fi

# Run pending database migrations
echo "start.sh: Synchronizing database schema..."
npx prisma db push --accept-data-loss

exec node dist/server.js


