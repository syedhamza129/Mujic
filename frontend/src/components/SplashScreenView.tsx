import React, { useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { Colors } from '../constants/colors';

const { width, height } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export function SplashScreenView({ onFinish }: Props) {
  const [error, setError] = useState(false);

  // If video fails to load / play, skip straight to the app
  const handleError = () => {
    setError(true);
    onFinish();
  };

  if (error) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Video
        source={require('../assets/splash_video.mp4')}
        style={styles.video}
        resizeMode="cover"
        repeat={false}
        muted={false}
        controls={false}
        paused={false}
        playInBackground={false}
        playWhenInactive={false}
        disableFocus={true}
        ignoreSilentSwitch="ignore"
        onEnd={onFinish}
        onError={handleError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
    zIndex: 999,
  },
  video: {
    width,
    height,
  },
});
