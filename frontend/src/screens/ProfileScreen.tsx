import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { useEffect, useState, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVATAR_KEY, getAvatarSource } from '../constants/avatars';

interface UserStats {
  totalPlays: number;
  likedSongs: number;
  playlistCount: number;
}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, refreshToken, logout, setUser } = useAuthStore();
  const downloadCount = useDownloadStore((s) => Object.keys(s.downloadedIds).length);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  // Re-read avatar whenever screen gains focus (returns from AvatarPickerScreen)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(AVATAR_KEY).then((uri) => {
        setLocalAvatar(uri ?? null);
      }).catch(() => {});
    }, [])
  );

  async function loadProfile() {
    try {
      const me = await authService.getMe();
      setUser(me);
    } catch {
      // Token might be expired
    }
  }

  async function loadStats() {
    setLoadingStats(true);
    try {
      const data = await userService.getStats();
      setStats(data);
    } catch {
      // Stats might fail, show fallback
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleLogout() {
    try {
      if (refreshToken) await authService.logout(refreshToken);
    } catch {
      // Ignore errors
    }
    logout();
  }

  function handlePickAvatar() {
    navigation.navigate('AvatarPicker' as never);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {localAvatar ? (
            <Image source={getAvatarSource(localAvatar)} style={styles.avatarImage} />
          ) : (
            <LinearGradient
              colors={['#BE1D3D', '#FF4D6D']}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>
                {((user?.displayName || user?.username || '?')[0]).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <TouchableOpacity style={styles.editBadge} onPress={handlePickAvatar}>
            <Ionicons name="pencil" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.username}>{user?.displayName || user?.username || 'Guest'}</Text>
        <View style={styles.handleRow}>
          <Text style={styles.handle}>@{user?.username || 'guest'}</Text>
          <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.statsBlock}>
        <View style={styles.statItem}>
          <LinearGradient colors={['#FF4D6D20', 'transparent']} style={styles.statIconCircle}>
            <Ionicons name="play" size={18} color={Colors.primary} />
          </LinearGradient>
          <Text style={styles.statValue}>{stats?.totalPlays ?? 8}</Text>
          <Text style={styles.statLabel}>Plays</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <LinearGradient colors={['#FF4D6D20', 'transparent']} style={styles.statIconCircle}>
            <Ionicons name="heart" size={18} color={Colors.primary} />
          </LinearGradient>
          <Text style={styles.statValue}>{stats?.likedSongs ?? 0}</Text>
          <Text style={styles.statLabel}>Liked Songs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <LinearGradient colors={['#FF4D6D20', 'transparent']} style={styles.statIconCircle}>
            <Ionicons name="download" size={18} color={Colors.primary} />
          </LinearGradient>
          <Text style={styles.statValue}>{downloadCount}</Text>
          <Text style={styles.statLabel}>Downloads</Text>
        </View>
      </View>

      <View style={styles.settingsSection}>
        <TouchableOpacity style={styles.settingsItem}>
          <View style={[styles.itemIconWrap, { backgroundColor: '#FFFFFF08' }]}>
            <Ionicons name="settings-outline" size={20} color={Colors.text} />
          </View>
          <Text style={styles.settingsText}>Settings</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem} onPress={() => navigation.navigate('Downloads' as never)}>
          <View style={[styles.itemIconWrap, { backgroundColor: '#FFFFFF08' }]}>
            <Ionicons name="download-outline" size={20} color={Colors.text} />
          </View>
          <Text style={styles.settingsText}>Downloads</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <View style={[styles.itemIconWrap, { backgroundColor: '#FFFFFF08' }]}>
            <Ionicons name="pulse-outline" size={20} color={Colors.text} />
          </View>
          <Text style={styles.settingsText}>Audio Quality</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <View style={[styles.itemIconWrap, { backgroundColor: '#FFFFFF08' }]}>
            <Ionicons name="help-circle-outline" size={20} color={Colors.text} />
          </View>
          <Text style={styles.settingsText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsItem}>
          <View style={[styles.itemIconWrap, { backgroundColor: '#FFFFFF08' }]}>
            <Ionicons name="musical-note-outline" size={20} color={Colors.text} />
          </View>
          <Text style={styles.settingsText}>About MuJiC</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <View style={styles.appLogo}>
          <Ionicons name="musical-notes" size={16} color={Colors.primary} />
          <Text style={styles.appLogoText}>MuJiC</Text>
        </View>
        <Text style={styles.versionText}>Version 1.0.0 (MVP)</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingTop: 60, paddingHorizontal: 25 },
  header: { alignItems: 'center', marginBottom: 35 },
  avatarContainer: { position: 'relative' },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#FFFFFF10',
  },
  avatarGradient: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF10',
  },
  avatarText: { color: '#fff', fontSize: 42, fontWeight: '800' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 5,
    backgroundColor: '#1A1014',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  username: { color: Colors.text, fontSize: 28, fontWeight: '800', marginTop: 15 },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  handle: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },

  statsBlock: {
    flexDirection: 'row',
    backgroundColor: '#1A101480',
    borderRadius: 24,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF05',
    marginBottom: 35,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statDivider: { width: 1, height: '60%', backgroundColor: '#FFFFFF10', alignSelf: 'center' },

  settingsSection: { gap: 8, marginBottom: 35 },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 15,
  },
  itemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: { flex: 1, color: Colors.text, fontSize: 17, fontWeight: '600' },

  footer: { alignItems: 'center', gap: 6 },
  appLogo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appLogoText: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  versionText: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },
  logoutBtn: {
    marginTop: 20,
    backgroundColor: '#1A1014',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF08',
  },
  logoutText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
