import { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { playlistService } from '../services/playlistService';
import { showToast } from './Toast';
import type { Song } from '../store/usePlayerStore';

interface PlaylistItem {
  id: string;
  name: string;
  songCount: number;
}

interface Props {
  song: Song | null;
  visible: boolean;
  onClose: () => void;
}

export function AddToPlaylistModal({ song, visible, onClose }: Props) {
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      playlistService.getMyPlaylists(50, 0)
        .then((data) => setPlaylists(data.playlists || []))
        .catch(() => showToast('Failed to load playlists', 'error'))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  async function handleAdd(playlistId: string, playlistName: string) {
    if (!song || adding) return;
    setAdding(playlistId);
    try {
      await playlistService.addSong(playlistId, song.id);
      showToast(`Added to "${playlistName}"`, 'success');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to add song';
      if (msg.includes('already')) {
        showToast('Song already in playlist', 'info');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setAdding(null);
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !song) return;
    setCreating(true);
    try {
      const pl = await playlistService.createPlaylist(name);
      await playlistService.addSong(pl.id, song.id);
      showToast(`Created "${name}" and added song`, 'success');
      setNewName('');
      setShowCreate(false);
      onClose();
    } catch {
      showToast('Failed to create playlist', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add to Playlist</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {song && (
            <Text style={styles.songInfo} numberOfLines={1}>
              {song.title} — {song.artist}
            </Text>
          )}

          {showCreate ? (
            <View style={styles.createRow}>
              <TextInput
                style={styles.createInput}
                placeholder="Playlist name"
                placeholderTextColor={Colors.textMuted}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
              <TouchableOpacity
                style={[styles.createBtn, !newName.trim() && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelCreate}
                onPress={() => { setShowCreate(false); setNewName(''); }}
              >
                <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
              <View style={styles.newIcon}>
                <Ionicons name="add" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.newText}>New Playlist</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.playlistRow}
                  onPress={() => handleAdd(item.id, item.name)}
                  disabled={!!adding}
                  activeOpacity={0.7}
                >
                  <View style={styles.playlistIcon}>
                    <Ionicons name="musical-notes" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.playlistMeta}>
                      {item.songCount} song{item.songCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {adding === item.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No playlists yet. Create one above!
                </Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  closeBtn: { padding: 4 },
  songInfo: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  newIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  createInput: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  createBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelCreate: { padding: 4 },
  list: { marginTop: 4 },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  playlistIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  playlistName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  playlistMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
});
