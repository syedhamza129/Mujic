import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { playlistService } from '../services/playlistService';
import { usePlayerStore, type Song } from '../store/usePlayerStore';
import { usePlaylistStore } from '../store/usePlaylistStore';
import { SongCard } from '../components/SongCard';
import { SongCardSkeleton } from '../components/SkeletonLoader';
import { sharePlaylist } from '../utils/shareUtils';
import { queueService } from '../services/queueService';

interface PlaylistSongItem {
  position: number;
  addedAt: string;
  song: Song;
}

interface PlaylistDetail {
  id: string;
  name: string;
  description?: string | null;
  songCount: number;
  songs: PlaylistSongItem[];
}

export default function PlaylistDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params as { id: string };
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { deletePlaylist } = usePlaylistStore();

  useEffect(() => {
    if (id) loadPlaylist();
  }, [id]);

  async function loadPlaylist(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await playlistService.getPlaylist(id!);
      setPlaylist(data);
    } catch (err) {
      console.error('Load playlist error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function startPlayback(songs: Song[], startIndex: number) {
    await queueService.playCollection(songs, startIndex);
  }

  async function handlePlayAll() {
    if (!playlist || playlist.songs.length === 0) return;
    const songs = playlist.songs.map((ps) => ps.song);
    await startPlayback(songs, 0);
  }

  async function handleShufflePlay() {
    if (!playlist || playlist.songs.length === 0) return;
    const songs = [...playlist.songs.map((ps) => ps.song)];
    for (let i = songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songs[i], songs[j]] = [songs[j], songs[i]];
    }
    usePlayerStore.getState().toggleShuffle();
    if (!usePlayerStore.getState().shuffle) usePlayerStore.getState().toggleShuffle();
    await startPlayback(songs, 0);
  }

  async function handleRemoveSong(songId: string) {
    try {
      await playlistService.removeSong(id!, songId);
      loadPlaylist();
    } catch (err) {
      console.error('Remove song error:', err);
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePlaylist(id!);
              navigation.goBack();
            } catch (err) {
              console.error('Delete playlist error:', err);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={{ width: 150, height: 22, borderRadius: 6, backgroundColor: Colors.bgElevated, marginBottom: 6 }} />
            <View style={{ width: 80, height: 12, borderRadius: 4, backgroundColor: Colors.bgElevated }} />
          </View>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.list}>
          <SongCardSkeleton />
          <SongCardSkeleton />
          <SongCardSkeleton />
          <SongCardSkeleton />
        </View>
      </View>
    );
  }

  if (!playlist) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Playlist not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginTop: 8 }}>
          <Text style={{ color: Colors.primary, fontSize: 15, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{playlist.name}</Text>
          {playlist.description && (
            <Text style={styles.headerDesc} numberOfLines={2}>{playlist.description}</Text>
          )}
          <Text style={styles.headerMeta}>
            {playlist.songCount} song{playlist.songCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => sharePlaylist({ id: id!, name: playlist.name, songCount: playlist.songCount })}
          style={styles.deleteBtn}
        >
          <Ionicons name="share-social-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={22} color={Colors.error} />
        </TouchableOpacity>
      </View>

      {playlist.songs.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll} activeOpacity={0.8}>
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.playAllText}>Play All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shuffleBtn} onPress={handleShufflePlay} activeOpacity={0.8}>
            <Ionicons name="shuffle" size={20} color={Colors.primary} />
            <Text style={styles.shuffleText}>Shuffle</Text>
          </TouchableOpacity>
        </View>
      )}

      {playlist.songs.length > 0 ? (
        <FlatList
          data={playlist.songs}
          keyExtractor={(item) => item.song.id + item.position}
          renderItem={({ item }) => (
            <SongCard
              song={item.song}
              onLongPress={() => handleRemoveSong(item.song.id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadPlaylist(true)} tintColor={Colors.primary} />
          }
        />
      ) : (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyTitle}>No songs yet</Text>
          <Text style={styles.emptySubtitle}>
            Search for songs and add them to this playlist
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: { color: Colors.textMuted, fontSize: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerInfo: { flex: 1 },
  headerTitle: { color: Colors.text, fontSize: 22, fontWeight: '700' },
  headerDesc: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  headerMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  deleteBtn: { padding: 8 },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  playAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  playAllText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  shuffleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  shuffleText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});
