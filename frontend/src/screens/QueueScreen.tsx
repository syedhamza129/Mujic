import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { usePlayerStore, type Song } from '../store/usePlayerStore';
import { SongCard } from '../components/SongCard';
import { songService } from '../services/songService';
import { useNavigation } from '@react-navigation/native';
import { queueService } from '../services/queueService';

export default function QueueScreen() {
  const navigation = useNavigation();
  const { queue, queueIndex, currentSong, clearQueue, removeFromQueue } = usePlayerStore();

  async function playSongAt(index: number) {
    await queueService.playCollection(queue, index);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue</Text>
        {queue.length > 0 ? (
          <TouchableOpacity onPress={clearQueue} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {/* Now Playing */}
      {currentSong && (
        <View style={styles.nowPlaying}>
          <Text style={styles.sectionLabel}>Now Playing</Text>
          <SongCard song={currentSong} />
        </View>
      )}

      {/* Queue */}
      {queue.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>
              Up Next ({queue.length - queueIndex - 1} song{queue.length - queueIndex - 1 !== 1 ? 's' : ''})
            </Text>
          </View>
          <FlatList
            data={queue.slice(queueIndex + 1)}
            keyExtractor={(item, i) => item.id + '_' + (queueIndex + 1 + i)}
            renderItem={({ item, index }) => {
              const actualIndex = queueIndex + 1 + index;
              return (
                <View style={styles.queueItem}>
                  <Text style={styles.queueNumber}>{index + 1}</Text>
                  <View style={styles.queueSong}>
                    <TouchableOpacity onPress={() => playSongAt(actualIndex)} style={styles.queueInfo}>
                      <Text style={styles.queueTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.queueArtist} numberOfLines={1}>{item.artist}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeFromQueue(actualIndex)}
                      style={styles.removeBtn}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyTitle}>Queue is empty</Text>
          <Text style={styles.emptySubtitle}>
            Play a playlist or album to build your queue
          </Text>
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
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  clearBtn: { padding: 8 },
  clearText: { color: Colors.error, fontSize: 14, fontWeight: '600' },
  nowPlaying: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 8 },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  queueNumber: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    width: 28,
    textAlign: 'center',
  },
  queueSong: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  queueInfo: { flex: 1 },
  queueTitle: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  queueArtist: { color: Colors.textMuted, fontSize: 12 },
  removeBtn: { padding: 6 },
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
