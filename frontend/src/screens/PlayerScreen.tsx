import { useState, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { usePlayerStore } from '../store/usePlayerStore';
import TrackPlayer, { useProgress, usePlaybackState, State } from 'react-native-track-player';
import { useNavigation } from '@react-navigation/native';
import { likeService } from '../services/likeService';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { showToast } from '../components/Toast';
import { queueService } from '../services/queueService';
import { useDownloadStore } from '../store/useDownloadStore';
import { downloadService } from '../services/downloadService';
import { hdThumbnail } from '../utils/thumbnailUtils';

const { width } = Dimensions.get('window');
const ARTWORK_SIZE = width * 0.85;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingTop: 50 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 60,
  },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  topArtist: { color: Colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },

  artworkSection: {
    height: width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkWrap: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
    backgroundColor: '#000',
  },
  artwork: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },

  metaSection: { paddingHorizontal: 25, marginTop: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleCol: { flex: 1, marginRight: 15 },
  title: { color: Colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  artistName: { color: Colors.primary, fontSize: 18, fontWeight: '600', marginTop: 4 },

  progressSection: { paddingHorizontal: 20, marginTop: 25 },
  seekBarTouchable: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  seekTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#FFFFFF20',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seekFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    marginLeft: -8,
    top: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  seekLoadingOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -5 },
  time: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    marginTop: 20,
  },
  modeBtn: { width: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  skipBtn: { width: 50, alignItems: 'center', justifyContent: 'center' },
  mainPlayBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 12,
  },
  playGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 35,
    marginTop: 40,
  },
  footerBtn: { padding: 10, alignItems: 'center', justifyContent: 'center' },
  dlProgressWrap: { alignItems: 'center', justifyContent: 'center' },
  dlProgressText: { color: Colors.primary, fontSize: 10, fontWeight: '700' },
});


function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SeekBarProps {
  currentSong: any;
  isLoading: boolean;
}

function SeekBar({ currentSong, isLoading }: SeekBarProps) {
  const progress = useProgress(250);
  const duration = progress.duration || currentSong?.duration || 1;

  // JS-thread only refs (position-matching, timeouts)
  const durationRef = useRef(duration);
  const isSeekingRef = useRef(false);
  const lastSeekPositionRef = useRef<number | null>(null);
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  durationRef.current = duration;

  // Shared values — accessible from both JS thread AND UI thread worklets
  const seekBarWidthSV = useSharedValue(1);   // bar width in px
  const seekProgressRatio = useSharedValue(0); // 0..1 fill position
  const isDragging = useSharedValue(0);        // 0..1 active dragging animation

  // State only for time text
  const [displayTime, setDisplayTime] = useState({ pos: 0, dur: 1 });

  // JS-thread callbacks (called from worklet via runOnJS, receive ratio not position)
  const onDragBegin = (ratio: number) => {
    isSeekingRef.current = true;
    setDisplayTime(prev => ({ ...prev, pos: ratio * durationRef.current }));
  };
  const onDragUpdate = (ratio: number) => {
    setDisplayTime(prev => ({ ...prev, pos: ratio * durationRef.current }));
  };
  const onDragEnd = async (ratio: number) => {
    const targetPos = ratio * durationRef.current;
    lastSeekPositionRef.current = targetPos;
    setDisplayTime(prev => ({ ...prev, pos: targetPos }));
    if (durationRef.current > 0) await TrackPlayer.seekTo(targetPos);
    if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    seekTimeoutRef.current = setTimeout(() => {
      isSeekingRef.current = false;
      lastSeekPositionRef.current = null;
    }, 1200);
  };
  const onDragCancel = () => { isSeekingRef.current = false; };

  // UI-thread pan gesture
  const panGesture = Gesture.Pan()
    .enabled(!isLoading)
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      isDragging.value = withSpring(1, { damping: 15, stiffness: 120 });
      const ratio = Math.max(0, Math.min(e.x / seekBarWidthSV.value, 1));
      seekProgressRatio.value = ratio;
      runOnJS(onDragBegin)(ratio);
    })
    .onUpdate((e) => {
      'worklet';
      const ratio = Math.max(0, Math.min(e.x / seekBarWidthSV.value, 1));
      seekProgressRatio.value = ratio;
      runOnJS(onDragUpdate)(ratio);
    })
    .onEnd((e) => {
      'worklet';
      isDragging.value = withSpring(0, { damping: 15, stiffness: 120 });
      const ratio = Math.max(0, Math.min(e.x / seekBarWidthSV.value, 1));
      seekProgressRatio.value = ratio;
      runOnJS(onDragEnd)(ratio);
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = withSpring(0, { damping: 15, stiffness: 120 });
      runOnJS(onDragCancel)();
    });

  // Sync playback position when not dragging
  useEffect(() => {
    if (!isSeekingRef.current) {
      if (duration > 0) seekProgressRatio.value = progress.position / duration;
      setDisplayTime({ pos: progress.position, dur: duration });
    } else if (lastSeekPositionRef.current !== null) {
      if (Math.abs(progress.position - lastSeekPositionRef.current) < 1.0) {
        isSeekingRef.current = false;
        lastSeekPositionRef.current = null;
        if (seekTimeoutRef.current) { clearTimeout(seekTimeoutRef.current); seekTimeoutRef.current = null; }
      }
    }
  }, [progress.position, duration]);

  useEffect(() => {
    return () => { if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current); };
  }, []);

  // UI animations for premium track scale and thumb spring responses
  const seekTrackStyle = useAnimatedStyle(() => ({
    height: withSpring(isDragging.value ? 6 : 4, { damping: 15 }),
  }));

  const seekFillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(seekProgressRatio.value * 100, 100)}%`,
    backgroundColor: isDragging.value > 0.1 ? '#fff' : Colors.primary,
  }));

  const seekThumbStyle = useAnimatedStyle(() => ({
    left: `${Math.min(seekProgressRatio.value * 100, 100)}%`,
    transform: [{ scale: withSpring(isDragging.value ? 1.4 : 1.0, { damping: 12 }) }],
    backgroundColor: isDragging.value > 0.1 ? '#fff' : Colors.primary,
  }));

  return (
    <View style={styles.progressSection}>
      <GestureDetector gesture={panGesture}>
        <View
          style={styles.seekBarTouchable}
          onLayout={(e) => { seekBarWidthSV.value = e.nativeEvent.layout.width || 1; }}
        >
          <Animated.View style={[styles.seekTrack, seekTrackStyle]}>
            <Animated.View style={[styles.seekFill, seekFillStyle]} />
          </Animated.View>
          <Animated.View style={[styles.seekThumb, seekThumbStyle]} />
        </View>
      </GestureDetector>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(displayTime.pos)}</Text>
        <Text style={styles.time}>{formatTime(displayTime.dur)}</Text>
      </View>
    </View>
  );
}

export default function PlayerScreen() {
  const navigation = useNavigation();
  const { currentSong, isPlaying,
    shuffle, repeatMode, toggleShuffle, cycleRepeat } = usePlayerStore();
  const playbackState = usePlaybackState();
  const isLoading = playbackState.state === State.Loading || playbackState.state === State.Buffering;
  const [liked, setLiked] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);


  const downloadedIds = useDownloadStore((s) => s.downloadedIds);
  const downloadingIds = useDownloadStore((s) => s.downloadingIds);
  const downloadProgress = useDownloadStore((s) => s.downloadProgress);
  const { markDownloaded, markDeleted, setDownloading, setDownloadProgress } = useDownloadStore();

  const songId = currentSong?.id ?? '';
  const isDownloaded = !!downloadedIds[songId];
  const isDownloading = !!downloadingIds[songId];
  const dlProgress = downloadProgress[songId] ?? 0;

  // duration and currentRatio removed, handled inside SeekBar component

  useEffect(() => {
    if (currentSong) {
      likeService.checkLiked(currentSong.id).then(setLiked).catch(() => {});
    }
  }, [currentSong?.id]);

  if (!currentSong) return null;

  async function togglePlay() {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }

  async function handleNext() {
    await queueService.skipToNext();
  }

  async function handlePrevious() {
    const pos = await TrackPlayer.getPosition();
    if (pos > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }
    await queueService.skipToPrevious();
  }

  async function toggleLike() {
    if (!currentSong) return;
    try {
      if (liked) {
        await likeService.unlikeSong(currentSong.id);
        setLiked(false);
        showToast('Removed from Liked', 'info');
      } else {
        await likeService.likeSong(currentSong.id);
        setLiked(true);
        showToast('Added to Liked ❤️', 'success');
      }
    } catch (err) {
      showToast('Failed to update like', 'error');
    }
  }

  async function handleDownload() {
    if (!currentSong) return;
    if (isDownloaded) {
      await downloadService.deleteSong(currentSong.id);
      markDeleted(currentSong.id);
      showToast('Download removed', 'info');
      return;
    }
    if (isDownloading) return;
    setDownloading(currentSong.id, true);
    setDownloadProgress(currentSong.id, 0);
    try {
      await downloadService.downloadSong(currentSong.id, (received, total) => {
        if (total > 0) setDownloadProgress(currentSong.id, Math.round((received / total) * 100));
      });
      markDownloaded(currentSong.id, {
        title: currentSong.title,
        artist: currentSong.artist,
        thumbnail: currentSong.thumbnail,
      });
      showToast('Downloaded ✓', 'success');
    } catch {
      setDownloading(currentSong.id, false);
      showToast('Download failed', 'error');
    }
  }

  // formatTime helper moved outside

  async function handleSeek(value: number) {
    await TrackPlayer.seekTo(value);
  }

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isPlaying) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.02, { duration: 2000 }), withTiming(1, { duration: 2000 })),
        -1,
        true
      );
    } else {
      pulse.value = withSpring(1);
    }
  }, [isPlaying]);

  const artworkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A1014', Colors.bg, Colors.bg]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-down" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>PLAYING NOW</Text>
          <Text style={styles.topArtist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.navigate('Queue' as never)}>
          <Ionicons name="list" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.artworkSection}>
        <Animated.View style={[styles.artworkWrap, artworkStyle]}>
          <Image
            source={{ uri: hdThumbnail(currentSong.thumbnail, 'max') }}
            style={styles.artwork}
          />
        </Animated.View>
      </View>

      <View style={styles.metaSection}>
        <View style={styles.titleRow}>
          <View style={styles.titleCol}>
            <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={styles.artistName} numberOfLines={1}>{currentSong.artist}</Text>
          </View>
          <TouchableOpacity onPress={toggleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={30}
              color={liked ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <SeekBar currentSong={currentSong} isLoading={isLoading} />

      <View style={styles.controlRow}>
        <TouchableOpacity onPress={toggleShuffle} style={styles.modeBtn}>
          <Ionicons name="shuffle" size={24} color={shuffle ? Colors.primary : Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePrevious} style={styles.skipBtn}>
          <Ionicons name="play-skip-back" size={32} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={togglePlay} style={styles.mainPlayBtn}>
          <LinearGradient
            colors={[Colors.primary, '#E63946']}
            style={styles.playGradient}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={38} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNext} style={styles.skipBtn}>
          <Ionicons name="play-skip-forward" size={32} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={cycleRepeat} style={styles.modeBtn}>
          <Ionicons
            name={repeatMode === 'one' ? 'repeat-outline' : 'repeat'}
            size={24}
            color={repeatMode !== 'off' ? Colors.primary : Colors.textMuted}
          />
          {repeatMode === 'one' && <View style={styles.repeatBadge} />}
        </TouchableOpacity>
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.footerBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle-outline" size={24} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerBtn} onPress={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <View style={styles.dlProgressWrap}>
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginBottom: 3 }} />
              <Text style={styles.dlProgressText}>{dlProgress}%</Text>
            </View>
          ) : (
            <Ionicons
              name={isDownloaded ? 'checkmark-circle' : 'cloud-download-outline'}
              size={24}
              color={isDownloaded ? Colors.primary : Colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>

      <AddToPlaylistModal
        song={currentSong}
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </View>
  );
}
