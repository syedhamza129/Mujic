import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { usePlayerStore } from '../store/usePlayerStore';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import TrackPlayer, { useProgress } from 'react-native-track-player';
import { useState, useEffect } from 'react';
import { likeService } from '../services/likeService';
import { hdThumbnail } from '../utils/thumbnailUtils';

export function MiniPlayer() {
  const { currentSong, isPlaying } = usePlayerStore();
  const progress = useProgress(250);
  const navigation = useNavigation<any>();
  const currentRoute = useNavigationState((state) => {
    if (!state) return '';
    const route = state.routes[state.index];
    return route?.name || '';
  });
  const [liked, setLiked] = useState(false);

  const translateY = useSharedValue(100);

  useEffect(() => {
    if (currentSong) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 100 });
    } else {
      translateY.value = withTiming(100, { duration: 300 });
    }
  }, [currentSong?.id]);

  useEffect(() => {
    if (currentSong) {
      likeService.checkLiked(currentSong.id).then(setLiked).catch(() => {});
    }
  }, [currentSong?.id]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!currentSong || currentRoute === 'Player') return null;

  async function handleTogglePlay(e: any) {
    e.stopPropagation();
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }

  async function handleToggleLike(e: any) {
    e.stopPropagation();
    if (!currentSong) return;
    try {
      if (liked) {
        await likeService.unlikeSong(currentSong.id);
        setLiked(false);
      } else {
        await likeService.likeSong(currentSong.id);
        setLiked(true);
      }
    } catch {
      // silently fail
    }
  }

  function openFullPlayer() {
    navigation.navigate('Player');
  }

  const progressPercent = progress.duration > 0
    ? (progress.position / progress.duration) * 100
    : 0;

  return (
    <Animated.View style={[styles.wrapper, containerStyle]}>
      <TouchableOpacity
        style={styles.pill}
        onPress={openFullPlayer}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: hdThumbnail(currentSong.thumbnail) }}
          style={styles.thumbnail}
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleToggleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? Colors.primary : Colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={handleTogglePlay}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={Colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1014F0',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: '#BE1D3D33',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 22,
    backgroundColor: Colors.bgElevated,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  artist: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 4,
  },
  iconBtn: {
    padding: 8,
  },
  playBtn: {
    padding: 8,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: '#FFFFFF10',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
});
