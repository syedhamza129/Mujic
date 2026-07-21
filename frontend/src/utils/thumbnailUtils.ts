/**
 * Upgrades a YouTube thumbnail URL to the highest available resolution.
 * Tries maxresdefault first (HD), falls back gracefully to hqdefault.
 * Non-YouTube URLs are returned unchanged.
 */
export function hdThumbnail(url: string | undefined | null, quality: 'max' | 'hq' = 'hq'): string {
  if (!url) return 'https://via.placeholder.com/300';
  
  // 1. YouTube video thumbnails (ytimg.com or youtube.com)
  if (url.includes('ytimg.com') || url.includes('youtube.com')) {
    // Strip query parameters that cause compression (like ?sqp=...)
    let baseUrl = url.split('?')[0];
    
    // Choose resolution target
    const q = quality === 'max' ? 'maxresdefault' : 'hqdefault';
    
    // Replace the default resolution path segment
    return baseUrl
      .replace('/default.jpg', `/${q}.jpg`)
      .replace('/mqdefault.jpg', `/${q}.jpg`)
      .replace('/hqdefault.jpg', `/${q}.jpg`)
      .replace('/sddefault.jpg', `/${q}.jpg`)
      .replace('/maxresdefault.jpg', `/${q}.jpg`);
  }
  
  // 2. Google User Content / YT Music CDN thumbnails (lh3.googleusercontent.com, ggpht.com)
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    let updated = url;
    // Replace wXXX-hXXX
    updated = updated.replace(/=w\d+-h\d+/g, '=w500-h500');
    updated = updated.replace(/-w\d+-h\d+/g, '-w500-h500');
    // Replace sXXX
    updated = updated.replace(/=s\d+/g, '=w500-h500');
    return updated;
  }
  
  return url;
}
