import jwt from 'jsonwebtoken';
import { env } from '../config/env';

type TicketKind = 'stream' | 'artwork';

interface MediaTicketPayload {
  kind: TicketKind;
  songId?: string;
  storageKey?: string;
}

const STREAM_TICKET_TTL = '5m';
const ARTWORK_TICKET_TTL = '1h';

export function createStreamTicket(songId: string): string {
  return jwt.sign({ kind: 'stream', songId } satisfies MediaTicketPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: STREAM_TICKET_TTL,
  });
}

export function createArtworkTicket(storageKey: string): string {
  return jwt.sign({ kind: 'artwork', storageKey } satisfies MediaTicketPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: ARTWORK_TICKET_TTL,
  });
}

export function verifyMediaTicket(ticket: string, expectedKind: TicketKind): MediaTicketPayload {
  const payload = jwt.verify(ticket, env.JWT_ACCESS_SECRET) as MediaTicketPayload;
  if (payload.kind !== expectedKind) throw new Error('Invalid media ticket kind');
  if (expectedKind === 'stream' && !payload.songId) throw new Error('Invalid stream ticket');
  if (expectedKind === 'artwork' && !payload.storageKey) throw new Error('Invalid artwork ticket');
  return payload;
}

/**
 * Uploaded artwork is stored as a private object key. Return a short-lived
 * opaque URL rather than sending that key to a React Native Image component.
 */
export function toRenderableArtworkUrl(value: string | null | undefined): string | null | undefined {
  if (!value || !value.startsWith('uploads/')) return value;
  const ticket = createArtworkTicket(value);
  return `${env.API_URL}/api/media/artwork/${encodeURIComponent(ticket)}`;
}
