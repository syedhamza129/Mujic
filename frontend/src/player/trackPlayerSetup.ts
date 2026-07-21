import TrackPlayer, {
  Capability,
  RepeatMode,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';

let initPromise: Promise<boolean> | null = null;

async function initPlayer(): Promise<boolean> {
  try {
    await TrackPlayer.setupPlayer({
      maxCacheSize: 1024 * 50,
      minBuffer: 15,
      maxBuffer: 120,
      playBuffer: 1.5,
      backBuffer: 30,
    });
    await TrackPlayer.updateOptions({
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
        Capability.SkipToNext,
      ],
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.ContinuePlayback,
      },
    });
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    return true;
  } catch (e: any) {
    if (e?.message?.includes?.('already been initialized')) {
      return true;
    }
    return false;
  }
}

export function getInitPromise(): Promise<boolean> {
  if (!initPromise) {
    initPromise = initPlayer();
  }
  return initPromise;
}

export function ensurePlayer(): Promise<void> {
  return getInitPromise().then((ok) => {
    if (!ok) throw new Error('Failed to initialize player');
  });
}

export const setupPlayer = getInitPromise;
