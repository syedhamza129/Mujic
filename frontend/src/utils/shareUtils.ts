import { Share } from 'react-native';

export async function shareSong(song: { title: string; artist: string; id: string }) {
  try {
    await Share.share({
      message: `🎵 ${song.title} by ${song.artist}\n\nListening on Mujic`,
      title: `${song.title} — ${song.artist}`,
    });
  } catch {
  }
}

export async function sharePlaylist(playlist: { name: string; songCount: number; id: string }) {
  try {
    await Share.share({
      message: `🎶 ${playlist.name} — ${playlist.songCount} song${playlist.songCount !== 1 ? 's' : ''}\n\nCheck it out on Mujic`,
      title: playlist.name,
    });
  } catch {
  }
}
