import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { Colors } from '../constants/colors';
import { uploadService, UploadProgress, UploadStatus, UserUpload } from '../services/uploadService';
import { showToast } from '../components/Toast';
import RNFS from 'react-native-fs';

type UploadState = 'idle' | 'selected' | 'uploading' | 'processing' | 'done' | 'error';

export default function UploadScreen() {
  const navigation = useNavigation();

  const [file, setFile] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [songId, setSongId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<UploadStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [uploads, setUploads] = useState<UserUpload[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const pollerRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    loadUploads();
    return () => { pollerRef.current?.cancel(); };
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const loadUploads = async () => {
    try {
      const { songs } = await uploadService.listUploads(20, 0);
      setUploads(songs);
    } catch {
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUploads();
    setRefreshing(false);
  }, []);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.pick({ type: [DocumentPicker.types.audio] });
      const asset = result[0];
      setFile({
        uri: asset.uri,
        name: asset.name || 'audio',
        mimeType: asset.type || 'audio/mpeg',
        size: asset.size || 0,
      });

      const nameWithoutExt = (asset.name || 'audio').replace(/\.[^.]+$/, '');
      if (!title) setTitle(nameWithoutExt);

      setUploadState('selected');
      setErrorMsg('');
    } catch (err) {
      if (DocumentPicker.isCancel(err)) return;
      showToast('Failed to pick file', 'error');
    }
  };

  const startUpload = async () => {
    if (!file) return;

    setUploadState('uploading');
    setProgress(0);
    setErrorMsg('');

    try {
      const result = await uploadService.uploadSong(
        file.uri,
        file.name,
        file.mimeType,
        {
          title: title || undefined,
          artist: artist || undefined,
          album: album || undefined,
          fileSize: file.size,
        },
        (p: UploadProgress) => setProgress(p.percentage)
      );

      // Copy the local file to the local downloads directory so the player plays it locally
      const DOWNLOADS_DIR = `${RNFS.DocumentDirectoryPath}/downloads`;
      const dirExists = await RNFS.exists(DOWNLOADS_DIR);
      if (!dirExists) {
        await RNFS.mkdir(DOWNLOADS_DIR);
      }
      const destPath = `${DOWNLOADS_DIR}/up_${result.songId.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
      
      // Delete existing destination if any to avoid errors
      const fileExists = await RNFS.exists(destPath);
      if (fileExists) {
        await RNFS.unlink(destPath);
      }
      await RNFS.copyFile(file.uri, destPath);

      setSongId(result.songId);
      setUploadState('done');
      setProgress(100);
      showToast('Song registered locally! 🎵', 'success');
      loadUploads();
    } catch (err: any) {
      setUploadState('error');
      setErrorMsg(err.message || 'Upload failed');
      showToast(err.message || 'Upload failed', 'error');
    }
  };

  const resetForm = () => {
    pollerRef.current?.cancel();
    setFile(null);
    setTitle('');
    setArtist('');
    setAlbum('');
    setUploadState('idle');
    setProgress(0);
    setSongId(null);
    setProcessingStatus(null);
    setErrorMsg('');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      ready: { bg: Colors.primary + '20', text: Colors.primary, label: 'Ready' },
      processing: { bg: Colors.warning + '20', text: Colors.warning, label: 'Processing' },
      failed: { bg: Colors.error + '20', text: Colors.error, label: 'Failed' },
    };
    const s = map[status] || map.processing;
    return (
      <View style={[styles.badge, { backgroundColor: s.bg }]}>
        <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
      </View>
    );
  };

  const renderUploadItem = ({ item }: { item: UserUpload }) => (
    <TouchableOpacity
      style={styles.uploadItem}
      onPress={() => item.status === 'ready' && navigation.navigate('SongDetail' as never, { id: 'up_' + item.id } as never)}
      activeOpacity={item.status === 'ready' ? 0.7 : 1}
    >
      <View style={styles.uploadItemIcon}>
        <Ionicons
          name={item.status === 'ready' ? 'musical-note' : item.status === 'failed' ? 'close-circle' : 'hourglass'}
          size={22}
          color={item.status === 'ready' ? Colors.primary : item.status === 'failed' ? Colors.error : Colors.warning}
        />
      </View>
      <View style={styles.uploadItemInfo}>
        <Text style={styles.uploadItemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.uploadItemArtist} numberOfLines={1}>
          {item.artistName} {item.duration ? `\u2022 ${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : ''}
        </Text>
      </View>
      {statusBadge(item.status)}
    </TouchableOpacity>
  );

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.inner, { opacity: fadeIn }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Music</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          <View style={styles.card}>
            {uploadState === 'idle' && (
              <TouchableOpacity style={styles.pickArea} onPress={pickFile} activeOpacity={0.7}>
                <LinearGradient
                  colors={[Colors.primary + '20', Colors.bgCard]}
                  style={styles.pickGradient}
                >
                  <View style={styles.pickIconWrap}>
                    <Ionicons name="cloud-upload" size={48} color={Colors.primary} />
                  </View>
                  <Text style={styles.pickTitle}>Select Audio File</Text>
                  <Text style={styles.pickSubtitle}>MP3, WAV, FLAC, M4A \u2022 Max 50MB</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {uploadState === 'selected' && file && (
              <>
                <View style={styles.fileInfo}>
                  <Ionicons name="musical-note" size={28} color={Colors.primary} />
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <Text style={styles.fileSize}>{formatSize(file.size)}</Text>
                  </View>
                  <TouchableOpacity onPress={resetForm}>
                    <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Song title"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Artist</Text>
                  <TextInput
                    style={styles.input}
                    value={artist}
                    onChangeText={setArtist}
                    placeholder="Artist name (optional)"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Album</Text>
                  <TextInput
                    style={styles.input}
                    value={album}
                    onChangeText={setAlbum}
                    placeholder="Album name (optional)"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <TouchableOpacity onPress={startUpload} activeOpacity={0.8}>
                  <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.uploadBtn}>
                    <Ionicons name="cloud-upload" size={20} color="#fff" />
                    <Text style={styles.uploadBtnText}>Upload</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {(uploadState === 'uploading' || uploadState === 'processing') && (
              <View style={styles.progressSection}>
                <View style={styles.progressIconRow}>
                  <Ionicons
                    name={uploadState === 'uploading' ? 'cloud-upload' : 'cog'}
                    size={36}
                    color={uploadState === 'uploading' ? Colors.primary : Colors.warning}
                  />
                </View>
                <Text style={styles.progressTitle}>
                  {uploadState === 'uploading' ? 'Uploading...' : 'Processing...'}
                </Text>
                <Text style={styles.progressSubtitle}>
                  {uploadState === 'uploading'
                    ? `${progress}% uploaded`
                    : 'Extracting metadata and preparing for streaming'}
                </Text>
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressBar, { width: progressWidth }]}>
                    <LinearGradient
                      colors={[Colors.primary, Colors.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.progressGradient}
                    />
                  </Animated.View>
                </View>
              </View>
            )}

            {uploadState === 'done' && (
              <View style={styles.doneSection}>
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={36} color="#fff" />
                </View>
                <Text style={styles.doneTitle}>Upload Complete!</Text>
                <Text style={styles.doneSubtitle}>{processingStatus?.title || title} is ready to play</Text>
                <View style={styles.doneActions}>
                  <TouchableOpacity
                    style={styles.doneActionBtn}
                    onPress={() => songId && navigation.navigate('SongDetail' as never, { id: 'up_' + songId } as never)}
                  >
                    <Ionicons name="play-circle" size={20} color={Colors.primary} />
                    <Text style={styles.doneActionText}>View Song</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.doneActionBtn, { backgroundColor: Colors.primary + '15' }]}
                    onPress={resetForm}
                  >
                    <Ionicons name="add-circle" size={20} color={Colors.primary} />
                    <Text style={styles.doneActionText}>Upload Another</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {uploadState === 'error' && (
              <View style={styles.errorSection}>
                <View style={styles.errorCircle}>
                  <Ionicons name="alert" size={32} color="#fff" />
                </View>
                <Text style={styles.errorTitle}>Upload Failed</Text>
                <Text style={styles.errorSubtitle}>{errorMsg}</Text>
                <TouchableOpacity onPress={resetForm} activeOpacity={0.8}>
                  <LinearGradient colors={[Colors.error, '#C0392B']} style={styles.uploadBtn}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.uploadBtnText}>Try Again</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {uploads.length > 0 && (
            <View style={styles.listSection}>
              <Text style={styles.sectionTitle}>My Uploads</Text>
              {uploads.map((item) => (
                <View key={item.id}>{renderUploadItem({ item })}</View>
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  pickArea: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  pickGradient: {
    alignItems: 'center',
    paddingVertical: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
  },
  pickIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pickTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  pickSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  uploadBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  progressSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  progressIconRow: {
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  progressSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressGradient: {
    flex: 1,
  },
  doneSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  doneSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  doneActions: {
    flexDirection: 'row',
    gap: 12,
  },
  doneActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  doneActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  errorSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  listSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 14,
  },
  uploadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  uploadItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  uploadItemInfo: {
    flex: 1,
  },
  uploadItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  uploadItemArtist: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
