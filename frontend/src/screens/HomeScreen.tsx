import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  Image, TouchableOpacity, RefreshControl, Dimensions, ImageBackground,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore, type Song } from '../store/usePlayerStore';
import { historyService } from '../services/historyService';
import { exploreService } from '../services/exploreService';
import { recommendationService } from '../services/recommendationService';
import { queueService } from '../services/queueService';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hdThumbnail } from '../utils/thumbnailUtils';
import { getAvatarSource } from '../constants/avatars';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 40 - 12) / 2;

const QUICK_PICKS_LABELS = [
  { label: 'Made For You', icon: 'person', colors: ['#BE1D3D', '#801026'] },
  { label: 'New Releases', icon: 'sparkles', colors: ['#FF4D6D', '#BE1D3D'] },
  { label: 'Trending', icon: 'trending-up', colors: ['#1DB954', '#148A3B'] },
  { label: 'Moods', icon: 'color-palette', colors: ['#6C3BAA', '#4A237A'] },
];

const EXPLORE_LIST = [
  { name: 'Bollywood', colors: ['#E8505B', '#C43A45'] },
  { name: 'Pop', colors: ['#4CC9F0', '#3089A8'] },
  { name: 'Rock', colors: ['#F72585', '#B51764'] },
  { name: 'Hip Hop', colors: ['#F59E0B', '#C77D08'] },
  { name: 'EDM', colors: ['#7209B7', '#4A0499'] },
  { name: 'Indie', colors: ['#06D6A0', '#04A87C'] },
  { name: 'Classical', colors: ['#B8B8B8', '#808080'] },
  { name: 'Jazz', colors: ['#FFB703', '#C98D02'] },
  { name: 'Romantic', colors: ['#FF4D6D', '#BE1D3D'] },
  { name: 'Workout', colors: ['#E63946', '#B32D39'] },
  { name: 'Chill', colors: ['#457B9D', '#2D5E7A'] },
  { name: 'Party', colors: ['#FF9F1C', '#CC7A16'] },
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [recommendedSongs, setRecommendedSongs] = useState<Song[]>([]);
  const [sections, setSections] = useState<Record<string, Song[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [historyData, recData, exploreData] = await Promise.allSettled([
        historyService.getRecentlyPlayed(10),
        recommendationService.getRecommendations(10),
        exploreService.getSections(),
      ]);
      if (historyData.status === 'fulfilled') setRecentSongs(historyData.value.songs || []);
      if (recData.status === 'fulfilled') setRecommendedSongs(recData.value.songs || []);
      if (exploreData.status === 'fulfilled') setSections(exploreData.value.sections || {});
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
      // Re-read avatar on focus so it updates after returning from AvatarPickerScreen
      AsyncStorage.getItem('local_avatar_uri').then((uri) => setLocalAvatar(uri ?? null)).catch(() => {});
    }, [])
  );

  async function playHomeSong(song: Song) {
    try {
      await queueService.playCollection([song], 0);
    } catch (err) {
      console.error('Play error:', err);
    }
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const sectionKeys = Object.keys(sections);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingText}>{greeting},</Text>
          <Text style={styles.userName}>{user?.displayName || user?.username || 'Guest'}</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('History' as never)}>
            <Ionicons name="time-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile' as never)}>
            {localAvatar ? (
              <Image source={getAvatarSource(localAvatar)} style={styles.profilePic} />
            ) : (
              <LinearGradient colors={['#BE1D3D', '#FF4D6D']} style={styles.profilePicGradient}>
                <Text style={styles.profilePicInitial}>
                  {((user?.displayName || user?.username || '?')[0]).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={Colors.primary}
          />
        }
      >
        <>
          {recentSongs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick picks</Text>
                <View style={styles.quickPicksGrid}>
                  {recentSongs.slice(0, 4).map((song) => (
                    <TouchableOpacity
                      key={song.id}
                      style={styles.quickPickCard}
                      onPress={() => playHomeSong(song)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: hdThumbnail(song.thumbnail) }} style={styles.quickPickImage} />
                      <View style={styles.quickPickOverlay}>
                        <Text style={styles.quickPickLabel} numberOfLines={2}>{song.title}</Text>
                        <Text style={styles.quickPickSub} numberOfLines={1}>{song.artist}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {sectionKeys.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Explore</Text>
                <FlatList
                  horizontal
                  data={EXPLORE_LIST}
                  keyExtractor={(item) => item.name}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, marginTop: 12 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Genres' as never, { genre: item.name.toLowerCase() } as never)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={item.colors} style={styles.genreChip}>
                        <Text style={styles.genreChipText}>{item.name}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {sectionKeys.map((key) => {
              const songs = sections[key] || [];
              if (songs.length === 0) return null;
              return (
                <View style={styles.section} key={key}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Genres' as never, { genre: key } as never)}
                    >
                      <Text style={styles.seeAll}>See all</Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    horizontal
                    data={songs.slice(0, 6)}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12, marginTop: 12 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.recentCard}
                        onPress={() => playHomeSong(item)}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: hdThumbnail(item.thumbnail) }}
                          style={styles.recentArt}
                        />
                        <Text style={styles.recentTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.recentArtist} numberOfLines={1}>{item.artist}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              );
            })}

            {recommendedSongs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommended for you</Text>
                {recommendedSongs.slice(0, 5).map((song) => (
                  <TouchableOpacity
                    key={song.id}
                    style={styles.recRow}
                    onPress={() => playHomeSong(song)}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: hdThumbnail(song.thumbnail) }} style={styles.recThumb} />
                    <View style={styles.recInfo}>
                      <Text style={styles.recTitle} numberOfLines={1}>{song.title}</Text>
                      <Text style={styles.recArtist} numberOfLines={1}>{song.artist}</Text>
                    </View>
                    <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
          )}
        </>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  greetingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  userName: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    zIndex: 1,
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },
  profileBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  profilePic: {
    width: 36,
    height: 36,
  },
  profilePicGradient: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicInitial: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 140,
  },

  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 0,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },

  quickPicksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  quickPickCard: {
    width: CARD_WIDTH,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
  },
  quickPickImage: {
    width: 56,
    height: 56,
    borderRadius: 4,
  },
  quickPickOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 10,
    paddingRight: 8,
  },
  quickPickLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  quickPickSub: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },

  genreChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  genreChipText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },

  recentCard: {
    width: 140,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF08',
  },
  recentArt: {
    width: '100%',
    height: 124,
    borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    marginBottom: 8,
  },
  recentTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  recentArtist: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },

  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF08',
  },
  recThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: Colors.bgElevated,
  },
  recInfo: {
    flex: 1,
    marginLeft: 12,
  },
  recTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  recArtist: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
