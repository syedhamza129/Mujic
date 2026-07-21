import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

function ShimmerBlock({ width, height, borderRadius = 8, style }: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: Colors.bgElevated,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SongCardSkeleton() {
  return (
    <View style={skeletonStyles.songCard}>
      <ShimmerBlock width={52} height={52} borderRadius={8} />
      <View style={skeletonStyles.songInfo}>
        <ShimmerBlock width="75%" height={14} />
        <ShimmerBlock width="50%" height={12} style={{ marginTop: 6 }} />
      </View>
      <ShimmerBlock width={36} height={36} borderRadius={18} />
    </View>
  );
}

export function RecentCardSkeleton() {
  return (
    <View style={skeletonStyles.recentCard}>
      <ShimmerBlock width={114} height={114} borderRadius={8} />
      <ShimmerBlock width={90} height={12} style={{ marginTop: 8 }} />
      <ShimmerBlock width={60} height={10} style={{ marginTop: 4 }} />
    </View>
  );
}

export function PlaylistCardSkeleton() {
  return (
    <View style={skeletonStyles.playlistCard}>
      <ShimmerBlock width={44} height={44} borderRadius={10} />
      <View style={skeletonStyles.playlistInfo}>
        <ShimmerBlock width="60%" height={14} />
        <ShimmerBlock width="30%" height={11} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

export function EqualizerBars({ size = 18, color = Colors.primary }: { size?: number; color?: string }) {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    function animateBar(val: Animated.Value, lo: number, hi: number, dur: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: hi, duration: dur, useNativeDriver: false }),
          Animated.timing(val, { toValue: lo, duration: dur, useNativeDriver: false }),
        ])
      );
    }
    const a1 = animateBar(bar1, 0.2, 1.0, 400);
    const a2 = animateBar(bar2, 0.3, 0.9, 550);
    const a3 = animateBar(bar3, 0.15, 0.85, 470);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const barWidth = Math.max(2, size / 6);
  const gap = Math.max(1, size / 9);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: size, gap }}>
      {[bar1, bar2, bar3].map((val, i) => (
        <Animated.View
          key={i}
          style={{
            width: barWidth,
            borderRadius: barWidth / 2,
            backgroundColor: color,
            height: val.interpolate({
              inputRange: [0, 1],
              outputRange: [size * 0.2, size],
            }),
          }}
        />
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  recentCard: {
    width: 130,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
});
