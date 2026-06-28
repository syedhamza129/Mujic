import TrackPlayer, {
  RatingType,
  Capability,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';

export const setupPlayer = async (): Promise<boolean> => {
  try {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.ContinuePlayback,
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
  } catch (e: any) {
    if (e?.message?.includes?.('already been initialized')) {
      return true;
    }
    return false;
  }
};
