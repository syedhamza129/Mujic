import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import TrackPlayer, {
  usePlaybackState,
  useProgress,
  useActiveTrack,
  State,
  Event,
} from 'react-native-track-player';
import Slider from '@react-native-community/slider';
import { setupPlayer } from '../player/trackPlayerSetup';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen(): React.JSX.Element {
  const playbackState = usePlaybackState();
  const { position, duration } = useProgress(250);
  const activeTrack = useActiveTrack();
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ready = await setupPlayer();
      if (mounted) {
        setIsPlayerReady(ready);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isPlayerReady) return;
    (async () => {
      const queue = await TrackPlayer.getQueue();
      if (queue.length === 0) {
        await TrackPlayer.add([
          {
            id: 'test-track',
            url: require('../assets/test.mp3'),
            title: '440Hz Test Tone',
            artist: 'Mujic PoC',
            duration: 30,
          },
        ]);
      }
    })();
  }, [isPlayerReady]);

  const togglePlayback = useCallback(async () => {
    const state = playbackState.state;
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, [playbackState.state]);

  const isPlaying = playbackState.state === State.Playing;
  const isLoading = playbackState.state === State.Loading ||
    playbackState.state === State.Buffering;

  const displayPosition = isSeeking ? seekPosition : position;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Text style={styles.title}>Mujic PoC</Text>

      <View style={styles.artworkPlaceholder}>
        <Text style={styles.artworkIcon}>♪</Text>
      </View>

      <Text style={styles.trackTitle}>
        {activeTrack?.title ?? 'No Track Loaded'}
      </Text>
      <Text style={styles.trackArtist}>
        {activeTrack?.artist ?? ''}
      </Text>

      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={displayPosition}
          minimumTrackTintColor="#1DB954"
          maximumTrackTintColor="#535353"
          thumbTintColor="#FFFFFF"
          onSlidingStart={() => {
            setIsSeeking(true);
            setSeekPosition(position);
          }}
          onValueChange={(value) => setSeekPosition(value)}
          onSlidingComplete={async (value) => {
            setIsSeeking(false);
            await TrackPlayer.seekTo(value);
          }}
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(displayPosition)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={async () => {
            await TrackPlayer.skipToPrevious();
          }}
        >
          <Text style={styles.controlIcon}>⏮</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.playButton]}
          onPress={togglePlayback}
          disabled={!isPlayerReady || isLoading}
        >
          <Text style={styles.playIcon}>
            {isLoading ? '⏳' : isPlaying ? '⏸' : '▶'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={async () => {
            await TrackPlayer.skipToNext();
          }}
        >
          <Text style={styles.controlIcon}>⏭</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 14,
    color: '#b3b3b3',
    letterSpacing: 2,
    marginBottom: 32,
  },
  artworkPlaceholder: {
    width: 240,
    height: 240,
    borderRadius: 8,
    backgroundColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  artworkIcon: {
    fontSize: 80,
    color: '#1DB954',
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 16,
    color: '#b3b3b3',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  timeText: {
    fontSize: 12,
    color: '#b3b3b3',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  controlButton: {
    padding: 8,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIcon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  playIcon: {
    fontSize: 32,
    color: '#000000',
  },
});
