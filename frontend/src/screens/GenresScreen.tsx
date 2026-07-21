import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { genreService, Genre, GenreSong } from '../services/genreService';
import type { Song } from '../store/usePlayerStore';
import { SongCard } from '../components/SongCard';
import { queueService } from '../services/queueService';
import { showToast } from '../components/Toast';

// ─── Genre color palette ───
const GENRE_COLORS = [
  '#BE1D3D', '#FF4D6D', '#C2184A', '#801026', '#FF8FA3',
  '#BE1D3D', '#FF4D6D', '#C2184A', '#801026', '#FF8FA3',
  '#BE1D3D', '#FF4D6D', '#C2184A', '#801026', '#FF8FA3',
];

function getGenreColor(index: number) {
  return GENRE_COLORS[index % GENRE_COLORS.length];
}

// ─── Genre icon mapping ───
function getGenreIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('rock')) return 'flame';
  if (lower.includes('pop')) return 'star';
  if (lower.includes('hip') || lower.includes('rap')) return 'mic';
  if (lower.includes('jazz')) return 'musical-notes';
  if (lower.includes('class')) return 'book';
  if (lower.includes('electro') || lower.includes('edm')) return 'flash';
  if (lower.includes('country')) return 'leaf';
  if (lower.includes('r&b') || lower.includes('soul')) return 'heart';
  if (lower.includes('metal')) return 'skull';
  if (lower.includes('blues')) return 'water';
  if (lower.includes('reggae')) return 'sunny';
  if (lower.includes('folk')) return 'bonfire';
  if (lower.includes('latin')) return 'globe';
  if (lower.includes('indie')) return 'radio';
  return 'musical-note';
}

export default function GenresScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as { genre?: string };
  const fadeIn = useRef(new Animated.Value(0)).current;

  // ─── State ───
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(params.genre || null);
  const [songs, setSongs] = useState<GenreSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    loadGenres();
  }, []);

  useEffect(() => {
    if (selectedGenre) loadGenreSongs(selectedGenre);
  }, [selectedGenre]);

  const loadGenres = async () => {
    try {
      const data = await genreService.getGenres();
      setGenres(data);
    } catch (err) {
      showToast('Failed to load genres', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadGenreSongs = async (genre: string) => {
    setLoading(true);
    try {
      const { songs: s, total: t } = await genreService.getGenreSongs(genre, 30);
      setSongs(s);
      setTotal(t);
    } catch (err) {
      showToast('Failed to load songs for this genre', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedGenre) await loadGenreSongs(selectedGenre);
    else await loadGenres();
    setRefreshing(false);
  }, [selectedGenre]);

  const handleSongPress = async (song: GenreSong, index: number) => {
    const queue: Song[] = songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      duration: s.duration,
      thumbnail: s.thumbnail,
      source: s.source as 'youtube' | 'archive' | 'upload',
      streamable: true,
    }));
    await queueService.playCollection(queue, index);
  };

  // ─── Genre Grid View ───
  if (!selectedGenre) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.inner, { opacity: fadeIn }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Browse Genres</Text>
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            key="grid"
            data={genres}
            numColumns={2}
            keyExtractor={(item) => item.name}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
            }
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.genreCard, { backgroundColor: getGenreColor(index) + '25' }]}
                activeOpacity={0.7}
                onPress={() => setSelectedGenre(item.name)}
              >
                <Ionicons
                  name={getGenreIcon(item.name) as any}
                  size={28}
                  color={getGenreColor(index)}
                />
                <Text style={styles.genreName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.genreCount}>
                  {item.songCount} song{item.songCount !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🎵</Text>
                  <Text style={styles.emptyTitle}>No genres yet</Text>
                  <Text style={styles.emptySubtitle}>Upload songs with genre metadata to see them here</Text>
                </View>
              ) : null
            }
          />
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ─── Genre Songs View ───
  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.inner, { opacity: fadeIn }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSelectedGenre(null); setSongs([]); }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedGenre}</Text>
          <Text style={styles.headerCount}>{total} songs</Text>
        </View>

        <FlatList
          key="list"
          data={songs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.songList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          renderItem={({ item, index }) => (
            <SongCard
              song={{
                id: item.id,
                title: item.title,
                artist: item.artist,
                duration: item.duration,
                thumbnail: item.thumbnail,
                source: item.source as 'youtube' | 'archive' | 'upload',
                streamable: true,
              }}
              onPress={() => handleSongPress(item, index)}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No songs in this genre</Text>
              </View>
            ) : null
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, flex: 1, textAlign: 'center' },
  headerCount: { fontSize: 13, color: Colors.textSecondary, width: 70, textAlign: 'right' },
  gridContent: { paddingHorizontal: 12, paddingBottom: 120 },
  genreCard: {
    flex: 1,
    margin: 6,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  genreCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  songList: { paddingHorizontal: 16, paddingBottom: 120 },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});
