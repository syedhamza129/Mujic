import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, type PhotoQuality } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';
import { AVATAR_KEY, PRESET_AVATARS, getAvatarSource } from '../constants/avatars';

const { width } = Dimensions.get('window');
const COLS = 3;
const ITEM_SIZE = (width - 48 - (COLS - 1) * 12) / COLS;

export default function AvatarPickerScreen() {
  const navigation = useNavigation();
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then((val) => {
      if (val) {
        setCurrentKey(val);
        setSelectedUri(val);
      }
    });
  }, []);

  async function handlePickFromGallery() {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.85 as PhotoQuality,
        maxWidth: 500,
        maxHeight: 500,
      });
      if (result.didCancel || !result.assets?.[0]?.uri) return;
      setSelectedUri(result.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Could not open photo library');
    }
  }

  async function handleSave() {
    if (!selectedUri) return;
    await AsyncStorage.setItem(AVATAR_KEY, selectedUri);
    navigation.goBack();
  }

  async function handleRemove() {
    await AsyncStorage.removeItem(AVATAR_KEY);
    setSelectedUri(null);
    setCurrentKey(null);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Avatar</Text>
        <TouchableOpacity
          style={[styles.saveBtn, !selectedUri && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!selectedUri}
        >
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Preview */}
        <View style={styles.previewSection}>
          <View style={styles.previewCircle}>
            {selectedUri ? (
              <Image source={getAvatarSource(selectedUri)} style={styles.previewImage} />
            ) : (
              <LinearGradient colors={['#BE1D3D', '#FF4D6D']} style={styles.previewGradient}>
                <Ionicons name="person" size={50} color="#fff" />
              </LinearGradient>
            )}
          </View>
          <Text style={styles.previewLabel}>
            {selectedUri ? 'Selected avatar' : 'No avatar selected'}
          </Text>
          {currentKey && (
            <TouchableOpacity onPress={handleRemove} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>Remove current</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Upload from gallery */}
        <TouchableOpacity style={styles.galleryBtn} onPress={handlePickFromGallery} activeOpacity={0.8}>
          <LinearGradient colors={['#BE1D3D22', '#FF4D6D11']} style={styles.galleryBtnGrad}>
            <View style={styles.galleryBtnIcon}>
              <Ionicons name="images" size={22} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.galleryBtnTitle}>Upload from Gallery</Text>
              <Text style={styles.galleryBtnSub}>Use your own photo</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Avatar grid */}
        <Text style={styles.sectionTitle}>Preset Avatars</Text>
        <View style={styles.grid}>
          {PRESET_AVATARS.map((avatar) => {
            const isActive = selectedUri === avatar.fileName;
            return (
              <TouchableOpacity
                key={avatar.id}
                style={[styles.gridItem, isActive && styles.gridItemActive]}
                onPress={() => setSelectedUri(avatar.fileName)}
                activeOpacity={0.8}
              >
                <Image source={avatar.source} style={styles.gridImage} />
                {isActive && (
                  <View style={styles.checkOverlay}>
                    <Ionicons name="checkmark-circle" size={26} color={Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF08',
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 18, fontWeight: '700' },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  content: { paddingHorizontal: 16, paddingBottom: 60 },

  previewSection: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  previewCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.primary + '60',
  },
  previewImage: { width: '100%', height: '100%' },
  previewGradient: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  previewLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  removeBtn: { paddingHorizontal: 16, paddingVertical: 6 },
  removeBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  galleryBtn: { marginBottom: 28, borderRadius: 18, overflow: 'hidden' },
  galleryBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: 18,
  },
  galleryBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryBtnTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  galleryBtnSub: { color: Colors.textMuted, fontSize: 12, fontWeight: '500', marginTop: 2 },

  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 14 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  gridItemActive: {
    borderColor: Colors.primary,
  },
  gridImage: { width: '100%', height: '100%' },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000055',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
