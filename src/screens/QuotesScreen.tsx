import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Share,
  Animated,
  PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { QUOTES, type Quote } from '../core/quotes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH - 40;
const FAVORITES_KEY = '@thinkora/fav_quotes';

type Category = 'all' | 'productivity' | 'motivation' | 'mindfulness' | 'wisdom' | 'discipline';

const CARD_COLORS: string[] = [
  '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
  '#a18cd1', '#ff9a9e', '#89f7fe', '#c471f5', '#6366f1',
  '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899',
];

const CATEGORY_CONFIG: { id: Category; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All', icon: 'sparkles', color: '#7C3AED' },
  { id: 'productivity', label: 'Focus', icon: 'flash', color: '#4A90D9' },
  { id: 'motivation', label: 'Motivate', icon: 'rocket', color: '#F59E0B' },
  { id: 'mindfulness', label: 'Calm', icon: 'leaf', color: '#10B981' },
  { id: 'wisdom', label: 'Wisdom', icon: 'bulb', color: '#8B5CF6' },
  { id: 'discipline', label: 'Grit', icon: 'barbell', color: '#EF4444' },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

// ── Swipeable Hero Card ────────────────────────────────────────

function SwipeableQuoteCard({
  quotes,
  favorites,
  onToggleFav,
}: {
  quotes: Quote[];
  favorites: Set<string>;
  onToggleFav: (key: string) => void;
}) {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dayOfYear = getDayOfYear();

  const rand = useMemo(() => seededRandom(dayOfYear * 7919), [dayOfYear]);
  const shuffledIndices = useMemo(() => {
    const indices = Array.from({ length: quotes.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [quotes.length, dayOfYear]);

  const quote = quotes[shuffledIndices[currentIndex % shuffledIndices.length]];
  const nextQuote = quotes[shuffledIndices[(currentIndex + 1) % shuffledIndices.length]];
  const bg = CARD_COLORS[currentIndex % CARD_COLORS.length];
  const nextBg = CARD_COLORS[(currentIndex + 1) % CARD_COLORS.length];
  const quoteKey = `${quote.text.slice(0, 30)}`;
  const isFav = favorites.has(quoteKey);

  const animateCard = useCallback((toX: number, cb: () => void) => {
    Animated.parallel([
      Animated.timing(pan.x, { toValue: toX, duration: 250, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      cb();
      pan.setValue({ x: 0, y: 0 });
      cardOpacity.setValue(1);
      scaleAnim.setValue(1);
    });
  }, [pan, cardOpacity, scaleAnim]);

  const goNext = useCallback(() => animateCard(-SCREEN_WIDTH, () => setCurrentIndex(i => i + 1)), [animateCard]);
  const goPrev = useCallback(() => {
    if (currentIndex === 0) {
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      return;
    }
    animateCard(SCREEN_WIDTH, () => setCurrentIndex(i => i - 1));
  }, [currentIndex, animateCard, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => { pan.x.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) goNext();
        else if (g.dx > SWIPE_THRESHOLD) goPrev();
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      },
    })
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-6deg', '0deg', '6deg'],
  });

  const handleShare = useCallback(async () => {
    const msg = quote.author
      ? `"${quote.text}"\n\n— ${quote.author}\n\nDaily inspiration from Thinkora\nhttps://play.google.com/store/apps/details?id=com.thinkora`
      : `"${quote.text}"\n\nDaily inspiration from Thinkora\nhttps://play.google.com/store/apps/details?id=com.thinkora`;
    await Share.share({ message: msg });
  }, [quote]);

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const catColor = CATEGORY_CONFIG.find(c => c.id === quote.category)?.color ?? '#7C3AED';

  return (
    <View style={heroStyles.wrapper}>
      {/* Next card behind */}
      <View style={[heroStyles.card, { backgroundColor: nextBg, opacity: 0.4, transform: [{ scale: 0.92 }] }]}>
        <Text style={heroStyles.quoteText} numberOfLines={4}>"{nextQuote.text}"</Text>
      </View>

      {/* Current card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          heroStyles.card,
          {
            backgroundColor: bg,
            transform: [{ translateX: pan.x }, { rotate }, { scale: scaleAnim }],
            opacity: cardOpacity,
            shadowColor: bg,
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 24,
          },
        ]}
      >
        {/* Decorative elements */}
        <View style={[heroStyles.decorCircle, { top: -40, right: -30, width: 160, height: 160, backgroundColor: '#FFFFFF15' }]} />
        <View style={[heroStyles.decorCircle, { bottom: -20, left: -40, width: 120, height: 120, backgroundColor: '#FFFFFF10' }]} />
        <View style={[heroStyles.decorQuoteMark, { top: 20, left: 20 }]}>
          <Text style={heroStyles.bigQuoteMark}>"</Text>
        </View>

        <View style={heroStyles.cardContent}>
          {/* Date + Category */}
          <View style={heroStyles.topMeta}>
            <Text style={heroStyles.dateText}>{dateStr}</Text>
            <View style={[heroStyles.catPill, { backgroundColor: '#FFFFFF25' }]}>
              <Ionicons name={CATEGORY_CONFIG.find(c => c.id === quote.category)?.icon ?? 'sparkles'} size={12} color="#FFFFFFCC" />
              <Text style={heroStyles.catPillText}>{quote.category}</Text>
            </View>
          </View>

          {/* Quote text */}
          <Text style={heroStyles.quoteText}>"{quote.text}"</Text>

          {/* Author */}
          {quote.author ? (
            <View style={heroStyles.authorRow}>
              <View style={heroStyles.authorDash} />
              <Text style={heroStyles.authorText}>{quote.author}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={heroStyles.actionsRow}>
            <TouchableOpacity style={heroStyles.actionBtn} onPress={goPrev} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={heroStyles.actionBtn} onPress={() => onToggleFav(quoteKey)} activeOpacity={0.7}>
              <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? '#FF6B6B' : '#FFF'} />
            </TouchableOpacity>
            <TouchableOpacity style={heroStyles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="share-social" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={heroStyles.actionBtn} onPress={goNext} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={heroStyles.hint}>Swipe for more</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  wrapper: {
    height: SCREEN_HEIGHT * 0.44,
    marginHorizontal: 20,
    marginTop: 12,
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  decorQuoteMark: {
    position: 'absolute',
    zIndex: 0,
  },
  bigQuoteMark: {
    fontSize: 120,
    fontWeight: '900',
    color: '#FFFFFF12',
    lineHeight: 120,
  },
  topMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF88',
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFFCC',
    textTransform: 'capitalize',
  },
  quoteText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: 0.2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  authorDash: {
    width: 20,
    height: 2,
    backgroundColor: '#FFFFFF55',
    borderRadius: 1,
  },
  authorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFFBB',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 11,
    color: '#FFFFFF44',
    textAlign: 'center',
  },
});

// ── Main Screen ────────────────────────────────────────────────

export function QuotesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dayOfYear = getDayOfYear();

  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);

  // Quote of the Day — always a new quote each day, guaranteed unique from yesterday
  const quoteOfTheDay = useMemo(() => {
    // Use a combination of day + year to ensure uniqueness across years
    const now = new Date();
    const seed = dayOfYear * 31 + now.getFullYear();
    const idx = seed % QUOTES.length;
    return QUOTES[idx];
  }, [dayOfYear]);

  const qotdKey = quoteOfTheDay.text.slice(0, 30);
  const qotdIsFav = favorites.has(qotdKey);
  const qotdCatColor = CATEGORY_CONFIG.find(c => c.id === quoteOfTheDay.category)?.color ?? '#7C3AED';

  // Load favorites
  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then(raw => {
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    }).catch(() => {});
  }, []);

  const toggleFav = useCallback((key: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const filteredQuotes = useMemo(() => {
    let list = selectedCategory === 'all' ? QUOTES : QUOTES.filter(q => q.category === selectedCategory);
    if (showFavOnly) list = list.filter(q => favorites.has(q.text.slice(0, 30)));
    return list;
  }, [selectedCategory, showFavOnly, favorites]);

  const moreQuotes = useMemo(() => {
    const rand = seededRandom(dayOfYear * 1013);
    const shuffled = [...filteredQuotes].sort(() => rand() - 0.5);
    return showAll ? shuffled : shuffled.slice(0, 6);
  }, [dayOfYear, showAll, filteredQuotes]);

  const categoryColors: Record<string, string> = {
    productivity: '#4A90D9', motivation: '#F59E0B', mindfulness: '#10B981',
    wisdom: '#8B5CF6', discipline: '#EF4444',
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    headerSafe: { paddingTop: insets.top },
    // Category chips
    chipScroll: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: theme.colors.cardBg,
    },
    chipActive: {
      backgroundColor: theme.colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textMuted,
    },
    chipTextActive: {
      color: '#FFF',
    },
    // Fav filter
    favFilter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
    },
    favBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: showFavOnly ? '#FF6B6B20' : theme.colors.cardBg,
    },
    favBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: showFavOnly ? '#FF6B6B' : theme.colors.textMuted,
    },
    // Quote list
    listWrap: {
      paddingHorizontal: 20,
      paddingBottom: 120,
    },
    quoteCard: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: 20,
      padding: 20,
      marginBottom: 12,
      borderLeftWidth: 4,
    },
    quoteCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    quoteCatBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
    },
    quoteCatText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    quoteText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      lineHeight: 24,
      fontStyle: 'italic',
    },
    quoteAuthor: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textMuted,
      marginTop: 10,
    },
    quoteActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 12,
    },
    quoteActionBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    showMoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      backgroundColor: theme.colors.cardBg,
      borderRadius: 16,
      marginTop: 4,
    },
    showMoreText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    emptyText: {
      textAlign: 'center',
      color: theme.colors.textMuted,
      paddingVertical: 40,
      fontSize: 14,
    },
    // Quote of the Day
    qotdWrap: {
      marginHorizontal: 20,
      marginTop: 12,
      borderRadius: 20,
      overflow: 'hidden',
    },
    qotdGradient: {
      padding: 22,
      borderRadius: 20,
    },
    qotdLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 14,
    },
    qotdLabelText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#FFFFFFAA',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    qotdText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      lineHeight: 28,
      textAlign: 'center',
      marginBottom: 12,
    },
    qotdAuthor: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFFFFFBB',
      textAlign: 'center',
      marginBottom: 14,
    },
    qotdActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    qotdActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#FFFFFF20',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
    },
    qotdActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFFDD',
    },
  }), [theme, insets, showFavOnly]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* Category filter chips */}
        <View style={[styles.headerSafe, { backgroundColor: theme.colors.background }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <View style={styles.chipRow}>
              {CATEGORY_CONFIG.map(cat => {
                const isActive = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.chip, isActive && { backgroundColor: cat.color }]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={cat.icon} size={14} color={isActive ? '#FFF' : cat.color} />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Quote of the Day */}
        <View style={styles.qotdWrap}>
          <View style={[styles.qotdGradient, { backgroundColor: qotdCatColor }]}>
            <View style={styles.qotdLabel}>
              <Ionicons name="sunny" size={16} color="#FFFFFFAA" />
              <Text style={styles.qotdLabelText}>Quote of the Day</Text>
            </View>
            <Text style={styles.qotdText}>"{quoteOfTheDay.text}"</Text>
            {quoteOfTheDay.author ? (
              <Text style={styles.qotdAuthor}>— {quoteOfTheDay.author}</Text>
            ) : null}
            <View style={styles.qotdActions}>
              <TouchableOpacity style={styles.qotdActionBtn} onPress={() => toggleFav(qotdKey)} activeOpacity={0.7}>
                <Ionicons name={qotdIsFav ? 'heart' : 'heart-outline'} size={14} color={qotdIsFav ? '#FF6B6B' : '#FFFFFFDD'} />
                <Text style={styles.qotdActionText}>{qotdIsFav ? 'Saved' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qotdActionBtn}
                onPress={async () => {
                  const msg = quoteOfTheDay.author
                    ? `"${quoteOfTheDay.text}"\n\n— ${quoteOfTheDay.author}\n\nQuote of the Day from Thinkora\nhttps://play.google.com/store/apps/details?id=com.thinkora`
                    : `"${quoteOfTheDay.text}"\n\nQuote of the Day from Thinkora\nhttps://play.google.com/store/apps/details?id=com.thinkora`;
                  await Share.share({ message: msg });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="share-social" size={14} color="#FFFFFFDD" />
                <Text style={styles.qotdActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Swipeable card — explore more */}
        <SwipeableQuoteCard
          quotes={filteredQuotes.length > 0 ? filteredQuotes : QUOTES}
          favorites={favorites}
          onToggleFav={toggleFav}
        />

        {/* Section header with favorites filter */}
        <View style={[styles.favFilter, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Browse Quotes</Text>
          <TouchableOpacity style={styles.favBtn} onPress={() => setShowFavOnly(f => !f)} activeOpacity={0.7}>
            <Ionicons name={showFavOnly ? 'heart' : 'heart-outline'} size={14} color={showFavOnly ? '#FF6B6B' : theme.colors.textMuted} />
            <Text style={styles.favBtnText}>{showFavOnly ? 'Favorites' : 'All'}</Text>
          </TouchableOpacity>
        </View>

        {/* Quote cards list */}
        <View style={styles.listWrap}>
          {moreQuotes.length === 0 && (
            <Text style={styles.emptyText}>
              {showFavOnly ? 'No favorite quotes yet.\nTap the heart on any quote to save it.' : 'No quotes in this category.'}
            </Text>
          )}
          {moreQuotes.map((q, i) => {
            const qKey = q.text.slice(0, 30);
            const isQFav = favorites.has(qKey);
            const catClr = categoryColors[q.category] || theme.colors.primary;
            return (
              <View key={i} style={[styles.quoteCard, { borderLeftColor: catClr }]}>
                <View style={styles.quoteCardHeader}>
                  <View style={[styles.quoteCatBadge, { backgroundColor: catClr + '18' }]}>
                    <Ionicons name={CATEGORY_CONFIG.find(c => c.id === q.category)?.icon ?? 'sparkles'} size={10} color={catClr} />
                    <Text style={[styles.quoteCatText, { color: catClr }]}>{q.category}</Text>
                  </View>
                </View>
                <Text style={styles.quoteText}>"{q.text}"</Text>
                {q.author ? <Text style={styles.quoteAuthor}>— {q.author}</Text> : null}
                <View style={styles.quoteActions}>
                  <TouchableOpacity style={styles.quoteActionBtn} onPress={() => toggleFav(qKey)} activeOpacity={0.7}>
                    <Ionicons name={isQFav ? 'heart' : 'heart-outline'} size={16} color={isQFav ? '#FF6B6B' : theme.colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quoteActionBtn}
                    onPress={async () => {
                      const msg = q.author
                        ? `"${q.text}"\n\n— ${q.author}\n\nShared from Thinkora`
                        : `"${q.text}"\n\nShared from Thinkora`;
                      await Share.share({ message: msg });
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-social-outline" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {!showAll && moreQuotes.length > 0 && moreQuotes.length < filteredQuotes.length && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAll(true)} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={18} color={theme.colors.primary} />
              <Text style={styles.showMoreText}>Show more</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
