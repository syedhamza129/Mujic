import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TouchableOpacity,
  Image, TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { usePlayerStore, type Song } from '../store/usePlayerStore';
import { showToast } from './Toast';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { downloadService } from '../services/downloadService';

interface Props {
  song: Song | null;
  visible: boolean;
  onClose: () => void;
}

export function SongOptionsModal({ song, visible, onClose }: Props) {
  const { addNextToQueue, addToQueue } = usePlayerStore();
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Check download status whenever the modal opens for a song
  useEffect(() => {
    if (song && visible) {
      downloadService.isDownloaded(song.id).then(setIsDownloaded);
      setDownloadProgress(0);
    }
  }, [song?.id, visible]);

  if (!song) return null;

  const handlePlayNext = () => {
    addNextToQueue(song);
    showToast('Added to play next 🎵', 'success');
    onClose();
  };

  const handleAddToQueue = () => {
    addToQueue(song);
    showToast('Added to queue', 'success');
    onClose();
  };

  const handleAddToPlaylist = () => {
    setShowAddPlaylist(true);
  };

  const handleDownload = async () => {
    if (isDownloaded || isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      await downloadService.downloadSong(song.id, (received, total) => {
        if (total > 0) setDownloadProgress(Math.round((received / total) * 100));
      });
      setIsDownloaded(true);
      showToast('Downloaded! 🎵', 'success');
      onClose();
    } catch (err: any) {
      showToast('Download failed — try again', 'error');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const downloadLabel = isDownloading
    ? `Downloading${downloadProgress > 0 ? ` ${downloadProgress}%` : '…'}`
    : isDownloaded
    ? 'Downloaded'
    : 'Download';

  const downloadColor = isDownloaded ? Colors.primary : Colors.text;

  return (
    <>
      <Modal
        visible={visible && !showAddPlaylist}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />

                <View style={styles.songHeader}>
                  <Image source={{ uri: song.thumbnail || 'https://via.placeholder.com/60' }} style={styles.thumbnail} />
                  <View style={styles.songInfo}>
                    <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.artist} numberOfLines={1}>{song.artist}</Text>
                  </View>
                </View>

                <View style={styles.optionsList}>
                  <TouchableOpacity style={styles.optionItem} onPress={handlePlayNext}>
                    <View style={styles.iconWrap}>
                      <Ionicons name="play-forward-outline" size={22} color={Colors.primary} />
                    </View>
                    <Text style={styles.optionText}>Play Next</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optionItem} onPress={handleAddToQueue}>
                    <View style={styles.iconWrap}>
                      <Ionicons name="list-outline" size={22} color={Colors.text} />
                    </View>
                    <Text style={styles.optionText}>Add to Queue</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optionItem} onPress={handleAddToPlaylist}>
                    <View style={styles.iconWrap}>
                      <Ionicons name="add-circle-outline" size={22} color={Colors.text} />
                    </View>
                    <Text style={styles.optionText}>Add to Playlist</Text>
                  </TouchableOpacity>

                  {/* Download option */}
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={handleDownload}
                    disabled={isDownloading || isDownloaded}
                    activeOpacity={isDownloaded ? 1 : 0.6}
                  >
                    <View style={styles.iconWrap}>
                      {isDownloading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <Ionicons
                          name={isDownloaded ? 'checkmark-circle' : 'download-outline'}
                          size={22}
                          color={downloadColor}
                        />
                      )}
                    </View>
                    <Text style={[styles.optionText, { color: downloadColor }]}>{downloadLabel}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.optionItem, { borderBottomWidth: 0 }]} onPress={onClose}>
                    <View style={styles.iconWrap}>
                      <Ionicons name="information-circle-outline" size={22} color={Colors.text} />
                    </View>
                    <Text style={styles.optionText}>Song Info</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Text style={styles.closeBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <AddToPlaylistModal
        song={song}
        visible={showAddPlaylist}
        onClose={() => {
          setShowAddPlaylist(false);
          onClose();
        }}
      />
    </>
  );
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A1014',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: '#FFFFFF10',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#FFFFFF20',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  songHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: '#FFFFFF05',
    padding: 12,
    borderRadius: 20,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 14,
  },
  songInfo: {
    flex: 1,
    marginLeft: 15,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  artist: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  optionsList: {
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF05',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF05',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  optionText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: '#FFFFFF08',
    height: 55,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  closeBtnText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
