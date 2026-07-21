import { logger } from '../lib/logger';
import { uploadToR2 } from '../lib/r2';

interface AlbumArtResult {
  coverKey: string;
  coverMime: string;
}

export async function fetchAlbumArt(
  title: string,
  artist: string | null,
  userId: string,
  songId: string,
): Promise<AlbumArtResult | null> {
  const queryParts: string[] = [];
  if (artist) queryParts.push(`artist:"${artist}"`);
  queryParts.push(`track:"${title}"`);
  const query = queryParts.join(' ');

  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;

    const body = await response.json();
    const data = body?.data?.[0];
    if (!data?.album?.cover_big) return null;

    const coverUrl = data.album.cover_big;
    logger.info({ title, artist, coverUrl }, 'Album art found via Deezer');

    const coverResponse = await fetch(coverUrl, { signal: AbortSignal.timeout(15000) });
    if (!coverResponse.ok) return null;

    const coverBuffer = Buffer.from(await coverResponse.arrayBuffer());
    const coverMime = coverResponse.headers.get('content-type') || 'image/jpeg';
    const coverExt = coverMime.includes('png') ? '.png' : '.jpg';
    const coverKey = `uploads/${userId}/${songId}/cover${coverExt}`;

    await uploadToR2(coverKey, coverBuffer, coverMime);
    return { coverKey, coverMime };
  } catch (err) {
    logger.warn({ err, title, artist }, 'Failed to fetch album art from Deezer');
    return null;
  }
}
