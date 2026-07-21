import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  ActivityIndicator, Keyboard, TouchableOpacity, ScrollView, Image, FlatList
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../constants/colors';
import { searchService } from '../services/searchService';
import { exploreService } from '../services/exploreService';
import { SongCard } from '../components/SongCard';
import { RecentCardSkeleton, SongCardSkeleton } from '../components/SkeletonLoader';
import type { Song } from '../store/usePlayerStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { queueService } from '../services/queueService';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { hdThumbnail } from '../utils/thumbnailUtils';

type SourceFilter = 'all' | 'youtube' | 'archive' | 'upload';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SourceFilter>('all');

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [exploreSections, setExploreSections] = useState<Record<string, Song[]>>({});
  const [loadingExplore, setLoadingExplore] = useState(true);
  useEffect(() => {
    exploreService.getSections()
      .then((data) => setExploreSections(data.sections || {}))
      .catch(() => {})
      .finally(() => setLoadingExplore(false));
  }, []);

  const exploreKeys: { key: string; title: string; emoji: string }[] = [
    { key: 'bollywood', title: 'Bollywood Hits', emoji: '🎬' },
    { key: 'international', title: 'International Top', emoji: '🌍' },
    { key: 'trending', title: '🔥 Trending', emoji: '' },
    { key: 'pop', title: 'Pop', emoji: '🎤' },
    { key: 'hiphop', title: 'Hip Hop', emoji: '🎧' },
    { key: 'rock', title: 'Rock', emoji: '🎸' },
    { key: 'edm', title: 'EDM & Electronic', emoji: '🔊' },
    { key: 'chill', title: 'Chill Vibes', emoji: '😌' },
    { key: 'romantic', title: 'Romantic', emoji: '💕' },
    { key: 'party', title: 'Party Anthems', emoji: '🎉' },
    { key: 'workout', title: 'Workout', emoji: '💪' },
    { key: 'indie', title: 'Indie', emoji: '🎵' },
    { key: 'classical', title: 'Classical', emoji: '🎻' },
    { key: 'jazz', title: 'Jazz', emoji: '🎷' },
  ];

  function handleTextChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchService.autocomplete(text.trim());
        const items = data.suggestions || data.results || [];
        const texts = items.map((s: any) => (typeof s === 'string' ? s : s.text || s.title || ''));
        setSuggestions(texts.filter(Boolean));
        setShowSuggestions(texts.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  }

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  async function executeSearch(q: string, source?: SourceFilter) {
    const term = q.trim();
    if (!term) return;
    Keyboard.dismiss();
    setShowSuggestions(false);
    setSuggestions([]);

    setLoading(true);
    setSearched(true);
    try {
      const sourceParam = (source || activeFilter) === 'all' ? undefined : (source || activeFilter);
      const data = await searchService.search(term, 20, 0, sourceParam);
      setResults(data.songs || []);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = useCallback(() => {
    executeSearch(query);
  }, [query, activeFilter]);

  function handleSuggestionTap(suggestion: string) {
    setQuery(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    executeSearch(suggestion);
  }

  async function playExploreSong(song: Song) {
    try {
      await queueService.playCollection([song], 0);
    } catch (err) {
      console.error('Play error:', err);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search artists, songs, podcasts..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={`${s}_${i}`}
                style={styles.suggestionItem}
                onPress={() => handleSuggestionTap(s)}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.suggestionText} numberOfLines={1}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.statusCenter}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : results.length > 0 ? (
          <View style={styles.resultsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <TouchableOpacity onPress={() => { setResults([]); setSearched(false); setQuery(''); }}>
                <Text style={styles.seeAll}>Clear</Text>
              </TouchableOpacity>
            </View>
            {results.map((song) => (
              <SongCard key={song.id} song={song} />
            ))}
          </View>
        ) : (
          <>
            {loadingExplore ? (
              <View style={styles.section}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={{ marginBottom: 20 }}>
                    <View style={{ width: '60%', height: 18, backgroundColor: Colors.bgElevated, borderRadius: 8, marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <SongCardSkeleton />
                      <SongCardSkeleton />
                      <SongCardSkeleton />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              exploreKeys.map(({ key, title, emoji }) => {
                const songs = exploreSections[key];
                if (!songs || songs.length === 0) return null;
                return (
                  <View key={key} style={styles.exploreSection}>
                    <Text style={styles.exploreSectionTitle}>{emoji ? `${emoji} ${title}` : title}</Text>
                    <FlatList
                      horizontal
                      data={songs}
                      keyExtractor={(item) => key + '_' + item.id}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.exploreRow}
                      renderItem={({ item }) => (
                        <ExploreCard item={item} onPress={() => playExploreSong(item)} />
                      )}
                    />
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  title: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
    zIndex: 100,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1014',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: '#FFFFFF08',
  },
  searchIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  suggestionsContainer: {
    backgroundColor: '#1A1014',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF12',
    overflow: 'hidden',
    position: 'absolute',
    top: 55,
    left: 20,
    right: 20,
    zIndex: 1000,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#FFFFFF08',
    gap: 12,
  },
  suggestionText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
    flex: 1
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  statusCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  exploreSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  exploreSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 12,
  },
  exploreRow: {
    gap: 12,
    paddingRight: 20,
  },
  exploreCard: {
    width: 140,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF08',
  },
  exploreArt: {
    width: '100%',
    height: 124,
    borderRadius: 12,
    backgroundColor: Colors.bgElevated,
    marginBottom: 10,
  },
  exploreCardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  exploreCardArtist: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});

function ExploreCard({ item, onPress }: { item: Song; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => { scale.value = withSpring(0.94); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
    >
      <Animated.View style={[styles.exploreCard, animatedStyle]}>
        <Image
          source={{ uri: hdThumbnail(item.thumbnail) }}
          style={styles.exploreArt}
        />
        <Text style={styles.exploreCardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.exploreCardArtist} numberOfLines={1}>{item.artist}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
