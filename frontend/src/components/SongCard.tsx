import { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolateColor,
  withTiming
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { usePlayerStore, type Song } from '../store/usePlayerStore';
import { likeService } from '../services/likeService';
import { showToast } from './Toast';
import { EqualizerBars } from './SkeletonLoader';
import { SongOptionsModal } from './SongOptionsModal';
import { useDownloadStore } from '../store/useDownloadStore';
import { downloadService } from '../services/downloadService';
import { queueService } from '../services/queueService';
import { hdThumbnail } from '../utils/thumbnailUtils';

interface Props {
  song: Song;
  onLongPress?: () => void;
  onPress?: () => void;
}

export function SongCard({ song, onLongPress, onPress }: Props) {
  const [showOptions, setShowOptions] = useState(false);
  const { currentSong, isPlaying, playbackState } = usePlayerStore();
  const [liked, setLiked] = useState(false);

  const downloadedIds = useDownloadStore((s) => s.downloadedIds);
  const downloadingIds = useDownloadStore((s) => s.downloadingIds);
  const downloadProgress = useDownloadStore((s) => s.downloadProgress);
  const { markDownloaded, markDeleted, setDownloading, setDownloadProgress } = useDownloadStore();

  const isCurrentDownloaded = !!downloadedIds[song.id];
  const isCurrentDownloading = !!downloadingIds[song.id];
  const currentProgress = downloadProgress[song.id] || 0;

  const isCurrentSong = currentSong?.id === song.id;

  const highlightValue = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    highlightValue.value = withTiming(isCurrentSong ? 1 : 0, { duration: 300 });
  }, [isCurrentSong]);

  const animatedCardStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      highlightValue.value,
      [0, 1],
      [Colors.border, Colors.primary]
    );
    const backgroundColor = interpolateColor(
      highlightValue.value,
      [0, 1],
      [Colors.bgCard, Colors.bgElevated]
    );

    return {
      borderColor,
      backgroundColor,
      transform: [{ scale: scale.value }],
    };
  });

  useEffect(() => {
    likeService.checkLiked(song.id).then(setLiked).catch(() => {});
  }, [song.id]);

  const sourceLabel = song.source === 'youtube' ? 'YT'
    : song.source === 'archive' ? 'IA' : 'UP';

  const sourceColor = song.source === 'youtube' ? '#FF0000'
    : song.source === 'archive' ? '#428BCA' : Colors.success;

  async function handlePlay() {
    if (onPress) {
      onPress();
      return;
    }
    try {
      await queueService.playCollection([song], 0);
    } catch (err) {
      console.error('Play error:', err);
    }
  }

  async function toggleLike() {
    try {
      if (liked) {
        await likeService.unlikeSong(song.id);
        setLiked(false);
      } else {
        await likeService.likeSong(song.id);
        setLiked(true);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  }

  async function handleDownload() {
    if (isCurrentDownloaded) {
      await downloadService.deleteSong(song.id);
      markDeleted(song.id);
      return;
    }
    if (isCurrentDownloading) return;
    setDownloading(song.id, true);
    setDownloadProgress(song.id, 0);
    try {
      await downloadService.downloadSong(song.id, (received, total) => {
        if (total > 0) {
          const pct = Math.round((received / total) * 100);
          setDownloadProgress(song.id, pct);
        }
      });
      markDownloaded(song.id, {
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail,
      });
    } catch (err) {
      setDownloading(song.id, false);
      console.error('Download failed:', err);
      showToast('Download failed', 'error');
    }
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <>
    <Animated.View style={[styles.card, animatedCardStyle]}>
      <TouchableOpacity
        style={styles.cardTouchable}
        onPress={handlePlay}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={() => {
          if (onLongPress) {
            onLongPress();
          } else {
            setShowOptions(true);
          }
        }}
        activeOpacity={1}
      >
        <Image
          source={{ uri: hdThumbnail(song.thumbnail) }}
          style={styles.thumbnail}
        />
        <View style={styles.info}>
          <Text style={[styles.title, isCurrentSong && { color: Colors.primary }]} numberOfLines={1}>
            {song.title}
          </Text>
          <View style={styles.meta}>
            <Text style={styles.artist} numberOfLines={1}>{song.artist}</Text>
            {song.duration > 0 && (
              <Text style={styles.duration}>{formatDuration(song.duration)}</Text>
            )}
          </View>
        </View>
        <View style={[styles.sourceBadge, { backgroundColor: sourceColor + '20' }]}>
          <Text style={[styles.sourceText, { color: sourceColor }]}>{sourceLabel}</Text>
        </View>
        <TouchableOpacity style={styles.likeBtn} onPress={toggleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? Colors.error : Colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.dlBtn} onPress={handleDownload} disabled={isCurrentDownloading}>
          {isCurrentDownloading ? (
            <Text style={styles.dlProgressText}>{currentProgress}%</Text>
          ) : (
            <Ionicons
              name={isCurrentDownloaded ? 'checkmark-circle' : 'cloud-download-outline'}
              size={22}
              color={isCurrentDownloaded ? Colors.primary : Colors.textMuted}
            />
          )}
        </TouchableOpacity>
        {isCurrentSong && (playbackState === 'loading' || playbackState === 'buffering') ? (
          <View style={styles.playBtn}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : isCurrentSong && isPlaying ? (
          <View style={styles.playBtn}>
            <EqualizerBars size={20} color={Colors.primary} />
          </View>
        ) : (
          <TouchableOpacity style={styles.playBtn} onPress={handlePlay}>
            <Ionicons name="play-circle" size={36} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
    <SongOptionsModal
      song={song}
      visible={showOptions}
      onClose={() => setShowOptions(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: Colors.bgElevated,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  artist: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  duration: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  likeBtn: {
    padding: 6,
  },
  dlBtn: {
    padding: 6,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dlProgressText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.warning,
    textAlign: 'center',
    width: 28,
  },
  playBtn: {
    padding: 4,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
