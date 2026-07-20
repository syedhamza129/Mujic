const SOURCE_PREFIX: Record<string, string> = {
  YOUTUBE: 'yt',
  ARCHIVE: 'ia',
  UPLOAD: 'up',
  youtube: 'yt',
  archive: 'ia',
  upload: 'up',
};

export function formatSongId(externalId: string | null | undefined, id: string, source: string): string {
  if (externalId) return externalId;
  const prefix = SOURCE_PREFIX[source] || 'up';
  return `${prefix}_${id}`;
}
