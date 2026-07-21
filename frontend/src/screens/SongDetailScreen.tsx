import { useState, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { songService } from '../services/songService';
import { likeService } from '../services/likeService';
import { usePlayerStore, type Song } from '../store/usePlayerStore';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { showToast } from '../components/Toast';
import { shareSong } from '../utils/shareUtils';
import { queueService } from '../services/queueService';

export default function SongDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params as { id: string };
  const [song, setSong] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  useEffect(() => {
    if (id) loadSong();
  }, [id]);

  async function loadSong() {
    setLoading(true);
    try {
      const data = await songService.getSong(id!);
      setSong(data);
      likeService.checkLiked(data.id).then(setLiked).catch(() => {});
    } catch {
      showToast('Failed to load song', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handlePlay() {
    if (!song) return;
    const s: Song = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      thumbnail: song.thumbnail,
      source: song.source,
      streamable: song.streamable ?? true,
    };
    await queueService.playCollection([s], 0);
  }

  async function toggleLike() {
    if (!song) return;
    try {
      if (liked) {
        await likeService.unlikeSong(song.id);
        setLiked(false);
        showToast('Removed from Liked', 'info');
      } else {
        await likeService.likeSong(song.id);
        setLiked(true);
        showToast('Added to Liked ❤️', 'success');
      }
    } catch {
      showToast('Failed to update like', 'error');
    }
  }

  const sourceLabel = song?.source === 'youtube' ? 'YouTube'
    : song?.source === 'archive' ? 'Internet Archive' : 'Upload';

  const sourceColor = song?.source === 'youtube' ? '#FF0000'
    : song?.source === 'archive' ? '#428BCA' : Colors.success;

  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!song) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Song not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const songForModal: Song = {
    id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    thumbnail: song.thumbnail,
    source: song.source,
    streamable: song.streamable ?? true,
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Song Info</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.artworkWrap}>
          <Image
            source={{ uri: song.thumbnail || 'https://via.placeholder.com/240' }}
            style={styles.artwork}
          />
        </View>

        <Text style={styles.title}>{song.title}</Text>
        <Text style={styles.artist}>{song.artist}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="play" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{(song.playCount || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>plays</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="heart" size={16} color={Colors.error} />
            <Text style={styles.statValue}>{(song.likeCount || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>likes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={16} color={Colors.accent} />
            <Text style={styles.statValue}>{formatDuration(song.duration)}</Text>
            <Text style={styles.statLabel}>duration</Text>
          </View>
        </View>

        <View style={styles.sourceRow}>
          <View style={[styles.sourceBadge, { backgroundColor: sourceColor + '20' }]}>
            <Text style={[styles.sourceText, { color: sourceColor }]}>{sourceLabel}</Text>
          </View>
          {song.album && (
            <Text style={styles.albumText}>Album: {song.album}</Text>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.playBtn} onPress={handlePlay}>
            <Ionicons name="play" size={22} color="#fff" />
            <Text style={styles.playBtnText}>Play</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? Colors.error : Colors.textMuted}
            />
            <Text style={styles.actionLabel}>{liked ? 'Liked' : 'Like'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add-circle-outline" size={24} color={Colors.textMuted} />
            <Text style={styles.actionLabel}>Playlist</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => shareSong(song)}>
            <Ionicons name="share-social-outline" size={24} color={Colors.textMuted} />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AddToPlaylistModal
        song={songForModal}
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
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
  errorText: { color: Colors.textMuted, fontSize: 16, marginBottom: 12 },
  backLink: { padding: 8 },
  backLinkText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 24, paddingBottom: 120, alignItems: 'center' },
  artworkWrap: { marginTop: 12, marginBottom: 24 },
  artwork: {
    width: 240,
    height: 240,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  artist: {
    color: Colors.textSecondary,
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  sourceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sourceText: { fontSize: 13, fontWeight: '600' },
  albumText: { color: Colors.textSecondary, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  playBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  actionLabel: { color: Colors.textMuted, fontSize: 11 },
});
