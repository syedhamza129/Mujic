import TrackPlayer, { RatingType, Capability } from 'react-native-track-player';

export const setupPlayer = async (): Promise<boolean> => {
  const isSetup = await TrackPlayer.isServiceRegistered();
  if (isSetup) {
    const isInitialized = await TrackPlayer.isInitialized();
    if (isInitialized) {
      return true;
    }
  }

  try {
    await TrackPlayer.setupPlayer({
      waitForBuffer: true,
    });
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior:
          TrackPlayer.APP_KILLED_PLAYBACK_BEHAVIOR.ContinuePlayback,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SeekTo,
      ],
      ratingType: RatingType.Heart,
      progressUpdateEventInterval: 1,
    });
    return true;
  } catch {
    return false;
  }
};
