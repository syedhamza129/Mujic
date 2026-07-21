export const AVATAR_KEY = 'local_avatar_uri';

const avatarImages: Record<string, any> = {
  'animodih.jpg': require('../assets/avatars/animodih.jpg'),
  'baby.jpg': require('../assets/avatars/baby.jpg'),
  'cool car.jpg': require('../assets/avatars/cool car.jpg'),
  'dora.jpg': require('../assets/avatars/dora.jpg'),
  'ghee khatam.jpg': require('../assets/avatars/ghee khatam.jpg'),
  'kevin hart.jpg': require('../assets/avatars/kevin hart.jpg'),
  'kool boy.jpg': require('../assets/avatars/kool boy.jpg'),
  'ksi.jpg': require('../assets/avatars/ksi.jpg'),
  'minim.jpg': require('../assets/avatars/minim.jpg'),
  'modih.jpg': require('../assets/avatars/modih.jpg'),
  'monkey smirk.jpg': require('../assets/avatars/monkey smirk.jpg'),
};

export const PRESET_AVATARS = Object.entries(avatarImages).map(([fileName, source]) => ({
  id: fileName,
  source,
  fileName,
}));

export function getAvatarSource(storedValue: string | null): any {
  if (!storedValue) return null;
  if (storedValue.startsWith('file://') || storedValue.startsWith('content://')) {
    return { uri: storedValue };
  }
  return avatarImages[storedValue] || { uri: storedValue };
}
