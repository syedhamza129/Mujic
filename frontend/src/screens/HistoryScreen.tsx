import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { historyService } from '../services/historyService';
import type { Song } from '../store/usePlayerStore';
import { SongCard } from '../components/SongCard';
import { SongCardSkeleton } from '../components/SkeletonLoader';
import { queueService } from '../services/queueService';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await historyService.getRecentlyPlayed(50);
      setSongs(data.songs || []);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [])
  );

  async function handlePlayAll() {
    if (songs.length === 0) return;
    await queueService.playCollection(songs, 0);
  }

  async function handleClearHistory() {
    try {
      await historyService.clearHistory();
      setSongs([]);
    } catch {
      console.error('Clear history failed');
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recently Played</Text>
        {songs.length > 0 ? (
          <TouchableOpacity onPress={handleClearHistory}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 34 }} />
        )}
      </View>

      {/* Play All */}
      {!loading && songs.length > 0 && (
        <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll} activeOpacity={0.8}>
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={styles.playAllText}>Play All</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.list}>
          <SongCardSkeleton />
          <SongCardSkeleton />
          <SongCardSkeleton />
          <SongCardSkeleton />
          <SongCardSkeleton />
        </View>
      ) : songs.length > 0 ? (
        <FlatList
          data={songs}
          keyExtractor={(item, i) => item.id + '_' + i}
          renderItem={({ item, index }) => (
            <SongCard
              song={item}
              onPress={async () => {
                await queueService.playCollection(songs, index);
              }}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true)} tintColor={Colors.primary} />
          }
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🕐</Text>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySubtitle}>Songs you play will appear here</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
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
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  playAllText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  clearText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});
