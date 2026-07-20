-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ARTIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "SongSource" AS ENUM ('YOUTUBE', 'ARCHIVE', 'UPLOAD');

-- CreateEnum
CREATE TYPE "SongStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'REMOVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT,
    "image_url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "external_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "songs" (
    "id" TEXT NOT NULL,
    "external_id" TEXT,
    "title" TEXT NOT NULL,
    "artist_id" TEXT,
    "artist_name" TEXT NOT NULL,
    "album" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "genre" TEXT,
    "year" INTEGER,
    "source" "SongSource" NOT NULL,
    "status" "SongStatus" NOT NULL DEFAULT 'READY',
    "mime_type" TEXT,
    "file_size" INTEGER,
    "storage_path" TEXT,
    "thumbnail_url" TEXT,
    "waveform_url" TEXT,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "song_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_songs" (
    "id" TEXT NOT NULL,
    "playlist_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_songs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "song_id" TEXT NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "listening_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "youtube_cache" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER,
    "duration" INTEGER,
    "encryption_iv" TEXT,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "youtube_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "artists_slug_key" ON "artists"("slug");

-- CreateIndex
CREATE INDEX "artists_name_idx" ON "artists"("name");

-- CreateIndex
CREATE UNIQUE INDEX "songs_external_id_key" ON "songs"("external_id");

-- CreateIndex
CREATE INDEX "songs_title_idx" ON "songs"("title");

-- CreateIndex
CREATE INDEX "songs_artist_name_idx" ON "songs"("artist_name");

-- CreateIndex
CREATE INDEX "songs_source_idx" ON "songs"("source");

-- CreateIndex
CREATE INDEX "songs_play_count_idx" ON "songs"("play_count" DESC);

-- CreateIndex
CREATE INDEX "songs_created_at_idx" ON "songs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "playlists_user_id_idx" ON "playlists"("user_id");

-- CreateIndex
CREATE INDEX "playlist_songs_playlist_id_position_idx" ON "playlist_songs"("playlist_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_songs_playlist_id_song_id_key" ON "playlist_songs"("playlist_id", "song_id");

-- CreateIndex
CREATE INDEX "likes_user_id_created_at_idx" ON "likes"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "likes_user_id_song_id_key" ON "likes"("user_id", "song_id");

-- CreateIndex
CREATE INDEX "listening_history_user_id_played_at_idx" ON "listening_history"("user_id", "played_at" DESC);

-- CreateIndex
CREATE INDEX "listening_history_song_id_idx" ON "listening_history"("song_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");

-- CreateIndex
CREATE UNIQUE INDEX "youtube_cache_video_id_key" ON "youtube_cache"("video_id");

-- CreateIndex
CREATE INDEX "youtube_cache_expires_at_idx" ON "youtube_cache"("expires_at");

-- CreateIndex
CREATE INDEX "youtube_cache_access_count_idx" ON "youtube_cache"("access_count" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_songs" ADD CONSTRAINT "playlist_songs_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_songs" ADD CONSTRAINT "playlist_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_history" ADD CONSTRAINT "listening_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_history" ADD CONSTRAINT "listening_history_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
