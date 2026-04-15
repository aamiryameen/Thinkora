import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingPage {
  id: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  features: { icon: string; text: string; color: string }[];
  gradient: [string, string];
}

const PAGES: OnboardingPage[] = [
  {
    id: 'welcome',
    icon: 'sparkles',
    iconBg: '#7C3AED',
    iconColor: '#FFF',
    title: 'Welcome to\nThinkora',
    subtitle: 'Your all-in-one productivity companion.\nOrganize, focus, and grow every day.',
    features: [
      { icon: 'checkmark-circle', text: 'Tasks & Notes', color: '#7C3AED' },
      { icon: 'flame', text: 'Habit Tracking', color: '#F59E0B' },
      { icon: 'happy', text: 'Mood Journal', color: '#EC4899' },
      { icon: 'chatbubble-ellipses', text: 'Daily Quotes', color: '#10B981' },
    ],
    gradient: ['#1a1035', '#0f0a1e'],
  },
  {
    id: 'tasks',
    icon: 'checkbox-outline',
    iconBg: '#4A90D9',
    iconColor: '#FFF',
    title: 'Smart Task\nManagement',
    subtitle: 'Create tasks with reminders, priorities,\ndue dates, subtasks, and Gantt chart view.',
    features: [
      { icon: 'alarm', text: 'Alarm-style reminders', color: '#EF4444' },
      { icon: 'flag', text: 'Priority levels', color: '#F59E0B' },
      { icon: 'git-branch', text: 'Gantt chart timeline', color: '#0EA5E9' },
      { icon: 'list', text: 'Subtasks & categories', color: '#10B981' },
    ],
    gradient: ['#0f1a2e', '#0a1220'],
  },
  {
    id: 'habits',
    icon: 'flame',
    iconBg: '#F59E0B',
    iconColor: '#FFF',
    title: 'Build Better\nHabits',
    subtitle: 'Track daily habits, build streaks,\nand see your progress grow over time.',
    features: [
      { icon: 'trending-up', text: 'Streak tracking', color: '#F59E0B' },
      { icon: 'calendar', text: 'Daily & weekly habits', color: '#7C3AED' },
      { icon: 'trophy', text: 'Achievement badges', color: '#EC4899' },
      { icon: 'analytics', text: 'Progress reports', color: '#4A90D9' },
    ],
    gradient: ['#1a1508', '#14100a'],
  },
  {
    id: 'notes',
    icon: 'document-text',
    iconBg: '#10B981',
    iconColor: '#FFF',
    title: 'Rich Notes\n& Journal',
    subtitle: 'Take beautiful notes with rich editor,\nvoice input, and track your daily mood.',
    features: [
      { icon: 'create', text: 'Rich text editor', color: '#10B981' },
      { icon: 'mic', text: 'Voice input', color: '#0EA5E9' },
      { icon: 'happy', text: 'Mood journal', color: '#EC4899' },
      { icon: 'attach', text: 'Attachments & sketches', color: '#F59E0B' },
    ],
    gradient: ['#081a14', '#0a1410'],
  },
  {
    id: 'ready',
    icon: 'rocket',
    iconBg: '#EC4899',
    iconColor: '#FFF',
    title: 'You\'re All\nSet!',
    subtitle: 'Start your productivity journey today.\nThinkora adapts to your style.',
    features: [
      { icon: 'notifications', text: 'Smart reminders', color: '#EF4444' },
      { icon: 'apps', text: 'Home screen widgets', color: '#7C3AED' },
      { icon: 'shield-checkmark', text: 'Data stays on device', color: '#10B981' },
      { icon: 'color-palette', text: '11 beautiful themes', color: '#F59E0B' },
    ],
    gradient: ['#1a0818', '#140a12'],
  },
];

interface Props {
  onComplete: () => void;
}

function FeatureItem({
  icon,
  text,
  color,
  delay,
}: {
  icon: string;
  text: string;
  color: string;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 500,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        featureStyles.row,
        {
          opacity: anim,
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [40, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[featureStyles.iconCircle, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={featureStyles.text}>{text}</Text>
    </Animated.View>
  );
}

const featureStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFFDD',
    letterSpacing: 0.2,
  },
});

function PageDots({
  total,
  activeIndex,
}: {
  total: number;
  activeIndex: number;
}) {
  return (
    <View style={dotStyles.container}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === activeIndex;
        return (
          <View
            key={i}
            style={[
              dotStyles.dot,
              isActive && dotStyles.dotActive,
            ]}
          />
        );
      })}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF30',
  },
  dotActive: {
    width: 28,
    borderRadius: 4,
    backgroundColor: '#FFFFFFCC',
  },
});

export function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isLastPage = currentIndex === PAGES.length - 1;

  const handleNext = useCallback(() => {
    if (isLastPage) {
      onComplete();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  }, [currentIndex, isLastPage, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderPage = useCallback(({ item, index }: { item: OnboardingPage; index: number }) => {
    return (
      <View style={[styles.page, { backgroundColor: item.gradient[0] }]}>
        {/* Decorative circles */}
        <View style={[styles.decorCircle1, { backgroundColor: item.iconBg + '12' }]} />
        <View style={[styles.decorCircle2, { backgroundColor: item.iconBg + '08' }]} />
        <View style={[styles.decorCircle3, { backgroundColor: item.iconBg + '15' }]} />

        <View style={styles.pageContent}>
          {/* Icon */}
          <View style={[styles.heroIcon, { backgroundColor: item.iconBg }]}>
            <Ionicons name={item.icon} size={40} color={item.iconColor} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{item.title}</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>{item.subtitle}</Text>

          {/* Feature list */}
          <View style={styles.featureList}>
            {item.features.map((f, i) => (
              <FeatureItem
                key={f.text}
                icon={f.icon}
                text={f.text}
                color={f.color}
                delay={i * 120}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0f0a1e',
    },
    page: {
      width: SCREEN_WIDTH,
      flex: 1,
      position: 'relative',
      overflow: 'hidden',
    },
    pageContent: {
      flex: 1,
      paddingHorizontal: 32,
      paddingTop: insets.top + 60,
      justifyContent: 'center',
    },
    decorCircle1: {
      position: 'absolute',
      width: 300,
      height: 300,
      borderRadius: 150,
      top: -80,
      right: -60,
    },
    decorCircle2: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      bottom: 100,
      left: -60,
    },
    decorCircle3: {
      position: 'absolute',
      width: 150,
      height: 150,
      borderRadius: 75,
      top: SCREEN_HEIGHT * 0.35,
      right: -30,
    },
    heroIcon: {
      width: 80,
      height: 80,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
    },
    title: {
      fontSize: 36,
      fontWeight: '800',
      color: '#FFFFFF',
      lineHeight: 44,
      letterSpacing: -0.5,
      marginBottom: 14,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '400',
      color: '#FFFFFF99',
      lineHeight: 24,
      marginBottom: 32,
    },
    featureList: {
      gap: 2,
    },
    footer: {
      paddingHorizontal: 32,
      paddingBottom: insets.bottom + 24,
      paddingTop: 16,
      gap: 20,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    skipBtn: {
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    skipText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF55',
    },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#FFFFFF',
      paddingVertical: 14,
      paddingHorizontal: 28,
      borderRadius: 16,
      shadowColor: '#FFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    nextBtnLast: {
      backgroundColor: '#7C3AED',
      paddingHorizontal: 36,
    },
    nextText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0f0a1e',
    },
    nextTextLast: {
      color: '#FFFFFF',
    },
    getStartedBtn: {
      backgroundColor: '#7C3AED',
      paddingVertical: 18,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#7C3AED',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
    },
    getStartedText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
  }), [insets]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      <View style={styles.footer}>
        <PageDots total={PAGES.length} activeIndex={currentIndex} />

        {isLastPage ? (
          <TouchableOpacity
            style={styles.getStartedBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#0f0a1e" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
