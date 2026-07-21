import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, RefreshControl, ScrollView, Image
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PlaylistCardSkeleton } from '../components/SkeletonLoader';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { usePlaylistStore, type PlaylistItem } from '../store/usePlaylistStore';
import { likeService } from '../services/likeService';
import LinearGradient from 'react-native-linear-gradient';

const CHIPS = ['Playlists', 'Songs', 'Albums', 'Artists'];

export default function LibraryScreen() {
  const navigation = useNavigation();
  const { playlists, loading, fetchPlaylists, createPlaylist } = usePlaylistStore();
  const [likedCount, setLikedCount] = useState(0);
  const [activeChip, setActiveChip] = useState('Playlists');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchPlaylists();
      likeService.getLikedSongs(1, 0).then((d) => setLikedCount(d.total)).catch(() => {});
    }, [])
  );

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const pl = await createPlaylist(name);
      setNewName('');
      setShowCreate(false);
      navigation.navigate('PlaylistDetail' as never, { id: pl.id } as never);
    } catch (err) {
      console.error('Create playlist error:', err);
    } finally {
      setCreating(false);
    }
  }

  function renderPlaylist({ item }: { item: PlaylistItem }) {
    return (
      <TouchableOpacity
        style={styles.playlistCard}
        onPress={() => navigation.navigate('PlaylistDetail' as never, { id: item.id } as never)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#2A141B', '#1A1014']}
          style={styles.playlistIcon}
        >
          <Ionicons name="musical-notes" size={20} color={Colors.primary} />
        </LinearGradient>
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.playlistMeta}>
            {item.songCount} song{item.songCount !== 1 ? 's' : ''} • Playlist
          </Text>
        </View>
        <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}><Ionicons name="search" size={22} color={Colors.text} /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowCreate(true)}><Ionicons name="add" size={28} color={Colors.text} /></TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
          {CHIPS.map(chip => (
            <TouchableOpacity
              key={chip}
              style={[styles.chip, activeChip === chip && styles.chipActive]}
              onPress={() => setActiveChip(chip)}
            >
              <Text style={[styles.chipText, activeChip === chip && styles.chipTextActive]}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPlaylists} tintColor={Colors.primary} />}
      >
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('LikedSongs' as never)}>
            <LinearGradient colors={['#BE1D3D', '#FF4D6D']} style={styles.actionIconWrap}>
              <Ionicons name="heart" size={26} color="#fff" />
            </LinearGradient>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Liked Songs</Text>
              <Text style={styles.actionSubtitle}>{likedCount} songs</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Upload' as never)}>
            <LinearGradient colors={['#2A141B', '#3D1520']} style={styles.actionIconWrap}>
              <Ionicons name="cloud-upload" size={26} color={Colors.primary} />
            </LinearGradient>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Upload Music</Text>
              <Text style={styles.actionSubtitle}>Add your own</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Playlists</Text>
        </View>

        {loading && playlists.length === 0 ? (
          <View style={{ paddingHorizontal: 20 }}>
            <PlaylistCardSkeleton /><PlaylistCardSkeleton /><PlaylistCardSkeleton />
          </View>
        ) : playlists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="musical-notes-outline" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No playlists yet</Text>
            <Text style={styles.emptySubtitle}>Tap the + button to create your first playlist and start organizing.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {playlists.map(p => renderPlaylist({ item: p }))}
          </View>
        )}
        <View style={{ height: 140 }} />
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Playlist</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Playlist name"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.modalBtn, !newName.trim() && { opacity: 0.5 }]}
              onPress={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Create Playlist</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20
  },
  title: { color: Colors.text, fontSize: 32, fontWeight: '800' },
  headerIcons: { flexDirection: 'row', gap: 15 },
  iconBtn: { padding: 4 },

  chipsRow: { marginBottom: 20 },
  chipsContent: { paddingHorizontal: 20, gap: 10 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1014',
    borderWidth: 1,
    borderColor: '#FFFFFF10',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  actionGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 25,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#1A1014',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFFFFF08',
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTextWrap: { gap: 2 },
  actionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  actionSubtitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { color: Colors.text, fontSize: 19, fontWeight: '800' },

  listContainer: { paddingHorizontal: 20 },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 15,
  },
  playlistIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: { flex: 1, gap: 2 },
  playlistName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  playlistMeta: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },

  emptyContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1014',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#1A1014',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    paddingBottom: 50
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  modalInput: {
    backgroundColor: '#0D0B0F',
    borderRadius: 15,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF10'
  },
  modalBtn: {
    backgroundColor: Colors.primary,
    height: 55,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
