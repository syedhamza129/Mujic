// ─── Provider System Types ───
// Core interfaces for the multi-source music provider abstraction.
// Each provider (YouTube, Internet Archive, Upload) implements MusicProvider.

export type ProviderType = 'youtube' | 'archive' | 'upload';

export interface NormalizedSong {
  id: string;             // Prefixed: "yt_xxxxx", "ia_xxxxx", "up_xxxxx"
  title: string;
  artist: string;
  album?: string;
  duration: number;       // Seconds
  thumbnail: string;      // URL to cover art
  source: ProviderType;
  streamable: boolean;
  metadata?: Record<string, unknown>;
}

export interface StreamInfo {
  url: string;            // Direct stream URL or signed R2 URL
  mimeType: string;       // "audio/mpeg", "audio/mp4", etc.
  fileSize?: number;      // Total bytes (if known)
  duration?: number;      // Seconds
  isTemporary: boolean;   // true for YouTube, false for uploads
  expiresAt?: Date;       // When this URL expires
}

export interface SearchOptions {
  query: string;
  limit?: number;         // Default 20
  offset?: number;        // For pagination
  filters?: {
    duration?: { min?: number; max?: number };
    artist?: string;
    source?: ProviderType;
  };
}

export interface MusicProvider {
  readonly type: ProviderType;

  search(options: SearchOptions): Promise<NormalizedSong[]>;
  getSongDetails(sourceId: string): Promise<NormalizedSong | null>;
  getStreamInfo(sourceId: string): Promise<StreamInfo>;
  isAvailable(): Promise<boolean>;
}
