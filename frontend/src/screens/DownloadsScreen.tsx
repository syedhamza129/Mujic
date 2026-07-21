import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { SongCard } from '../components/SongCard';
import type { Song } from '../store/usePlayerStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { queueService } from '../services/queueService';

export default function DownloadsScreen() {
  const navigation = useNavigation();
  const downloadedCount = useDownloadStore((s) => Object.keys(s.downloadedIds).length);
  const getDownloadedSongs = useDownloadStore((s) => s.getDownloadedSongs);
  const [songs, setSongs] = useState<Song[]>([]);
  const [refreshing, setRefreshing] = useState(false);


  useFocusEffect(
    useCallback(() => {
      setSongs(getDownloadedSongs());
    }, [downloadedCount])
  );

  async function handlePlayAll() {
    if (songs.length === 0) return;
    await queueService.playCollection(songs, 0);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloads</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="download" size={36} color="#fff" />
        </View>
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>{songs.length} song{songs.length !== 1 ? 's' : ''}</Text>
          {songs.length > 0 && (
            <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.playAllText}>Play All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {songs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cloud-download-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptySubtitle}>
            Download songs by tapping the download icon on any song
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SongCard song={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setSongs(getDownloadedSongs());
                setRefreshing(false);
              }}
              tintColor={Colors.primary}
            />
          }
        />
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
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerInfo: { marginLeft: 16, flex: 1 },
  bannerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  playAllText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});
