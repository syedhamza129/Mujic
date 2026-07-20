import { prisma } from '../../lib/prisma';
import { getSignedUrl, getLocalPath, isR2Configured } from '../../lib/r2';
import { logger } from '../../lib/logger';
import { toRenderableArtworkUrl } from '../../lib/mediaTickets';
import type { MusicProvider, NormalizedSong, StreamInfo, SearchOptions } from '../types';

export class UploadProvider implements MusicProvider {
  readonly type = 'upload' as const;

  async search(options: SearchOptions): Promise<NormalizedSong[]> {
    const query = options.query.trim();
    if (!query) return [];

    try {
      const songs = await prisma.song.findMany({
        where: {
          source: 'UPLOAD',
          status: 'READY',
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { artistName: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: options.limit || 20,
        skip: options.offset || 0,
        orderBy: { playCount: 'desc' },
        include: { artist: true },
      });

      return songs.map((song) => this.normalize(song));
    } catch (err) {
      logger.error({ err, query }, 'Upload search failed');
      return [];
    }
  }

  async getStreamInfo(sourceId: string): Promise<StreamInfo> {
    const id = sourceId.startsWith('up_') ? sourceId.slice(3) : sourceId;

    const song = await prisma.song.findUnique({ where: { id } });
    if (!song) throw new Error('Song not found');
    if (!song.storagePath) {
      throw new Error('Song has no storage path — upload may still be processing');
    }
    if (song.status !== 'READY') {
      throw new Error(`Song is not ready (status: ${song.status})`);
    }

    // Generate signed URL for the stored audio
    const url = await getSignedUrl(song.storagePath, 3600);

    return {
      url,
      mimeType: song.mimeType || 'audio/mpeg',
      fileSize: song.fileSize || undefined,
      duration: song.duration || undefined,
      isTemporary: false,
    };
  }

  async getSongDetails(sourceId: string): Promise<NormalizedSong | null> {
    const id = sourceId.startsWith('up_') ? sourceId.slice(3) : sourceId;

    const song = await prisma.song.findUnique({
      where: { id },
      include: { artist: true },
    });

    return song ? this.normalize(song) : null;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private normalize(song: any): NormalizedSong {
    return {
      id: `up_${song.id}`,
      title: song.title,
      artist: song.artist?.name || song.artistName || 'Unknown Artist',
      album: song.album || undefined,
      duration: song.duration || 0,
      thumbnail: toRenderableArtworkUrl(song.thumbnailUrl) || '',
      source: 'upload',
      streamable: song.status === 'READY',
    };
  }
}
