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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_WIDTH = SCREEN_WIDTH - 40;
const FAVORITES_KEY = '@thinkora/fav_quotes';

interface Quote {
  text: string;
  author: string;
  category: string;
}

type Category = 'all' | 'productivity' | 'motivation' | 'mindfulness' | 'wisdom' | 'discipline';

const QUOTES: Quote[] = [
  // ── Productivity (25) ──
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain', category: 'productivity' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss', category: 'productivity' },
  { text: 'Do the hard jobs first. The easy jobs will take care of themselves.', author: 'Dale Carnegie', category: 'productivity' },
  { text: 'Amateurs sit and wait for inspiration, the rest of us just get up and go to work.', author: 'Stephen King', category: 'productivity' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney', category: 'productivity' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso', category: 'productivity' },
  { text: 'Either you run the day or the day runs you.', author: 'Jim Rohn', category: 'productivity' },
  { text: 'Wake up with determination. Go to bed with satisfaction.', author: '', category: 'productivity' },
  { text: 'Don\'t count the days, make the days count.', author: 'Muhammad Ali', category: 'productivity' },
  { text: 'You don\'t need more time, you need more focus.', author: '', category: 'productivity' },
  { text: 'Productivity is never an accident. It is always the result of commitment to excellence.', author: 'Paul J. Meyer', category: 'productivity' },
  { text: 'Until we can manage time, we can manage nothing else.', author: 'Peter Drucker', category: 'productivity' },
  { text: 'Efficiency is doing things right; effectiveness is doing the right things.', author: 'Peter Drucker', category: 'productivity' },
  { text: 'The key is not to prioritize your schedule, but to schedule your priorities.', author: 'Stephen Covey', category: 'productivity' },
  { text: 'Plans are nothing; planning is everything.', author: 'Dwight D. Eisenhower', category: 'productivity' },
  { text: 'Time is what we want most, but what we use worst.', author: 'William Penn', category: 'productivity' },
  { text: 'Ordinary people think merely of spending time. Great people think of using it.', author: 'Arthur Schopenhauer', category: 'productivity' },
  { text: 'If you spend too much time thinking about a thing, you\'ll never get it done.', author: 'Bruce Lee', category: 'productivity' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe', category: 'productivity' },
  { text: 'Your work is going to fill a large part of your life. Make it great.', author: 'Steve Jobs', category: 'productivity' },
  { text: 'Work hard in silence, let your success be your noise.', author: 'Frank Ocean', category: 'productivity' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', category: 'productivity' },
  { text: 'Don\'t wish it were easier, wish you were better.', author: 'Jim Rohn', category: 'productivity' },
  { text: 'There are no shortcuts to any place worth going.', author: 'Beverly Sills', category: 'productivity' },
  { text: 'The difference between ordinary and extraordinary is that little extra.', author: 'Jimmy Johnson', category: 'productivity' },

  // ── Motivation (25) ──
  { text: 'You don\'t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar', category: 'motivation' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu', category: 'motivation' },
  { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt', category: 'motivation' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill', category: 'motivation' },
  { text: 'What you get by achieving your goals is not as important as what you become.', author: 'Zig Ziglar', category: 'motivation' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt', category: 'motivation' },
  { text: 'You didn\'t come this far to only come this far.', author: '', category: 'motivation' },
  { text: 'The harder you work for something, the greater you\'ll feel when you achieve it.', author: '', category: 'motivation' },
  { text: 'Don\'t stop when you\'re tired. Stop when you\'re done.', author: '', category: 'motivation' },
  { text: 'Dream bigger. Do bigger.', author: '', category: 'motivation' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius', category: 'motivation' },
  { text: 'Everything you\'ve ever wanted is on the other side of fear.', author: 'George Addair', category: 'motivation' },
  { text: 'Hardships often prepare ordinary people for an extraordinary destiny.', author: 'C.S. Lewis', category: 'motivation' },
  { text: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins', category: 'motivation' },
  { text: 'Keep your face always toward the sunshine and shadows will fall behind you.', author: 'Walt Whitman', category: 'motivation' },
  { text: 'In the middle of every difficulty lies opportunity.', author: 'Albert Einstein', category: 'motivation' },
  { text: 'Life is 10% what happens to you and 90% how you react to it.', author: 'Charles R. Swindoll', category: 'motivation' },
  { text: 'Go confidently in the direction of your dreams.', author: 'Henry David Thoreau', category: 'motivation' },
  { text: 'You are braver than you believe, stronger than you seem, and smarter than you think.', author: 'A.A. Milne', category: 'motivation' },
  { text: 'Challenges are what make life interesting. Overcoming them is what makes life meaningful.', author: 'Joshua J. Marine', category: 'motivation' },
  { text: 'The best revenge is massive success.', author: 'Frank Sinatra', category: 'motivation' },
  { text: 'If opportunity doesn\'t knock, build a door.', author: 'Milton Berle', category: 'motivation' },
  { text: 'Nothing is impossible. The word itself says "I\'m possible!"', author: 'Audrey Hepburn', category: 'motivation' },
  { text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson', category: 'motivation' },
  { text: 'Turn your wounds into wisdom.', author: 'Oprah Winfrey', category: 'motivation' },

  // ── Mindfulness (25) ──
  { text: 'Small daily improvements are the key to staggering long-term results.', author: '', category: 'mindfulness' },
  { text: 'Progress, not perfection.', author: '', category: 'mindfulness' },
  { text: 'Every day is a fresh start.', author: '', category: 'mindfulness' },
  { text: 'Done is better than perfect.', author: '', category: 'mindfulness' },
  { text: 'It\'s not about having time, it\'s about making time.', author: '', category: 'mindfulness' },
  { text: 'Be where you are, not where you think you should be.', author: '', category: 'mindfulness' },
  { text: 'Almost everything will work again if you unplug it for a few minutes, including you.', author: 'Anne Lamott', category: 'mindfulness' },
  { text: 'Today is a good day to try.', author: '', category: 'mindfulness' },
  { text: 'Strive for progress, not perfection.', author: '', category: 'mindfulness' },
  { text: 'Breathe. It\'s just a bad day, not a bad life.', author: '', category: 'mindfulness' },
  { text: 'The present moment is the only moment available to us, and it is the door to all moments.', author: 'Thich Nhat Hanh', category: 'mindfulness' },
  { text: 'Happiness is not something ready-made. It comes from your own actions.', author: 'Dalai Lama', category: 'mindfulness' },
  { text: 'You yourself, as much as anybody in the universe, deserve your love and affection.', author: 'Buddha', category: 'mindfulness' },
  { text: 'Peace comes from within. Do not seek it without.', author: 'Buddha', category: 'mindfulness' },
  { text: 'The mind is everything. What you think you become.', author: 'Buddha', category: 'mindfulness' },
  { text: 'Be kind whenever possible. It is always possible.', author: 'Dalai Lama', category: 'mindfulness' },
  { text: 'Quiet the mind, and the soul will speak.', author: 'Ma Jaya Sati Bhagavati', category: 'mindfulness' },
  { text: 'Nature does not hurry, yet everything is accomplished.', author: 'Lao Tzu', category: 'mindfulness' },
  { text: 'Let go of what you can\'t control. Focus on what you can.', author: '', category: 'mindfulness' },
  { text: 'Your calm mind is the ultimate weapon against your challenges.', author: 'Bryant McGill', category: 'mindfulness' },
  { text: 'Inhale confidence, exhale doubt.', author: '', category: 'mindfulness' },
  { text: 'You don\'t have to control your thoughts. You just have to stop letting them control you.', author: 'Dan Millman', category: 'mindfulness' },
  { text: 'The greatest weapon against stress is our ability to choose one thought over another.', author: 'William James', category: 'mindfulness' },
  { text: 'Slow down and everything you are chasing will come around and catch you.', author: 'John De Paola', category: 'mindfulness' },
  { text: 'Rest when you\'re weary. Refresh and renew yourself, your body, your mind, your spirit.', author: 'Ralph Marston', category: 'mindfulness' },

  // ── Wisdom (25) ──
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb', category: 'wisdom' },
  { text: 'Your limitation — it\'s only your imagination.', author: '', category: 'wisdom' },
  { text: 'Dream it. Wish it. Do it.', author: '', category: 'wisdom' },
  { text: 'Great things never come from comfort zones.', author: '', category: 'wisdom' },
  { text: 'Don\'t watch the clock; do what it does. Keep going.', author: 'Sam Levenson', category: 'wisdom' },
  { text: 'You are never too old to set another goal or to dream a new dream.', author: 'C.S. Lewis', category: 'wisdom' },
  { text: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela', category: 'wisdom' },
  { text: 'Knowledge speaks, but wisdom listens.', author: 'Jimi Hendrix', category: 'wisdom' },
  { text: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates', category: 'wisdom' },
  { text: 'In three words I can sum up everything I\'ve learned about life: it goes on.', author: 'Robert Frost', category: 'wisdom' },
  { text: 'Not everything that is faced can be changed, but nothing can be changed until it is faced.', author: 'James Baldwin', category: 'wisdom' },
  { text: 'The mind is not a vessel to be filled but a fire to be kindled.', author: 'Plutarch', category: 'wisdom' },
  { text: 'We don\'t see things as they are, we see them as we are.', author: 'Anais Nin', category: 'wisdom' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin', category: 'wisdom' },
  { text: 'The only person you are destined to become is the person you decide to be.', author: 'Ralph Waldo Emerson', category: 'wisdom' },
  { text: 'Life isn\'t about finding yourself. Life is about creating yourself.', author: 'George Bernard Shaw', category: 'wisdom' },
  { text: 'The unexamined life is not worth living.', author: 'Socrates', category: 'wisdom' },
  { text: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle', category: 'wisdom' },
  { text: 'Be the change that you wish to see in the world.', author: 'Mahatma Gandhi', category: 'wisdom' },
  { text: 'Education is the most powerful weapon which you can use to change the world.', author: 'Nelson Mandela', category: 'wisdom' },
  { text: 'A smooth sea never made a skilled sailor.', author: 'Franklin D. Roosevelt', category: 'wisdom' },
  { text: 'The roots of education are bitter, but the fruit is sweet.', author: 'Aristotle', category: 'wisdom' },
  { text: 'Judge a man by his questions rather than by his answers.', author: 'Voltaire', category: 'wisdom' },
  { text: 'The journey of a thousand miles begins with one step.', author: 'Lao Tzu', category: 'wisdom' },
  { text: 'What we know is a drop, what we don\'t know is an ocean.', author: 'Isaac Newton', category: 'wisdom' },

  // ── Discipline (20) ──
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn', category: 'discipline' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle', category: 'discipline' },
  { text: 'The pain of discipline is nothing like the pain of disappointment.', author: 'Justin Langer', category: 'discipline' },
  { text: 'Motivation gets you going, but discipline keeps you growing.', author: 'John C. Maxwell', category: 'discipline' },
  { text: 'Success isn\'t always about greatness. It\'s about consistency.', author: 'Dwayne Johnson', category: 'discipline' },
  { text: 'Push yourself, because no one else is going to do it for you.', author: '', category: 'discipline' },
  { text: 'Champions keep playing until they get it right.', author: 'Billie Jean King', category: 'discipline' },
  { text: 'There\'s no talent here, this is hard work. This is an obsession.', author: 'Conor McGregor', category: 'discipline' },
  { text: 'The successful warrior is the average man, with laser-like focus.', author: 'Bruce Lee', category: 'discipline' },
  { text: 'I fear not the man who has practiced 10,000 kicks once, but the man who has practiced one kick 10,000 times.', author: 'Bruce Lee', category: 'discipline' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese Proverb', category: 'discipline' },
  { text: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot', category: 'discipline' },
  { text: 'It\'s not whether you get knocked down, it\'s whether you get up.', author: 'Vince Lombardi', category: 'discipline' },
  { text: 'A river cuts through rock not because of its power, but because of its persistence.', author: 'Jim Watkins', category: 'discipline' },
  { text: 'The only way to guarantee failure is to quit.', author: '', category: 'discipline' },
  { text: 'Hard choices, easy life. Easy choices, hard life.', author: 'Jerzy Gregorek', category: 'discipline' },
  { text: 'No pressure, no diamonds.', author: 'Thomas Carlyle', category: 'discipline' },
  { text: 'Suffer the pain of discipline or suffer the pain of regret.', author: '', category: 'discipline' },
  { text: 'The only limit to our realization of tomorrow is our doubts of today.', author: 'Franklin D. Roosevelt', category: 'discipline' },
  { text: 'Strength does not come from winning. Your struggles develop your strengths.', author: 'Arnold Schwarzenegger', category: 'discipline' },
];

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
