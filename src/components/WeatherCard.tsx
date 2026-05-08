import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getCurrentWeather, type WeatherSnapshot, type HourlySlot } from '../services/weatherService';

interface Props {
  onPrimary?: boolean;
}

function useBobLoop() {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

function formatHourLabel(ts: number, isFirst: boolean): string {
  if (isFirst) return 'Now';
  const d = new Date(ts);
  const h = d.getHours();
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${suffix}`;
}

interface HourPillProps {
  slot: HourlySlot;
  isFirst: boolean;
}
function HourPill({ slot, isFirst }: HourPillProps) {
  return (
    <View style={[hourStyles.pill, isFirst && hourStyles.pillNow]}>
      <Text style={[hourStyles.label, isFirst && hourStyles.labelNow]} numberOfLines={1}>
        {formatHourLabel(slot.ts, isFirst)}
      </Text>
      <Text style={hourStyles.emoji}>{slot.emoji}</Text>
      <Text style={[hourStyles.temp, isFirst && hourStyles.tempNow]}>{slot.temperature}°</Text>
    </View>
  );
}
const hourStyles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 1,
    minWidth: 50,
  },
  pillNow: {
    backgroundColor: '#FFFFFF26',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF40',
  },
  label: { fontSize: 9.5, fontWeight: '700', color: '#FFFFFFA8', letterSpacing: 0.2 },
  labelNow: { color: '#FFF' },
  emoji: { fontSize: 14, lineHeight: 18 },
  temp: { fontSize: 11, fontWeight: '700', color: '#FFFFFFD0' },
  tempNow: { color: '#FFF' },
});

export function WeatherCard({ onPrimary = true }: Props) {
  const [snap, setSnap] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bob = useBobLoop();

  const load = useCallback(async (force: boolean) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const result = await getCurrentWeather({ forceRefresh: force, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      if (!result) {
        setError('Enable location to see weather');
        setSnap(null);
      } else {
        setSnap(result);
      }
    } catch {
      if (!ctrl.signal.aborted) setError('Weather unavailable');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    return () => abortRef.current?.abort();
  }, [load]);

  const surfaceTint = onPrimary ? '#FFFFFF14' : 'rgba(15,23,41,0.04)';
  const surfaceTop = onPrimary ? '#FFFFFF22' : 'rgba(255,255,255,0.6)';
  const borderTint = onPrimary ? '#FFFFFF33' : 'rgba(15,23,41,0.08)';
  const accent = snap?.accent ?? '#F59E0B';

  const styles = StyleSheet.create({
    card: {
      borderRadius: 22,
      backgroundColor: surfaceTint,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: borderTint,
      overflow: 'hidden',
    },
    sheen: {
      position: 'absolute',
      left: 0, right: 0, top: 0,
      height: '60%',
      backgroundColor: surfaceTop,
      opacity: 0.25,
    },
    accentBlob: {
      position: 'absolute',
      top: -40, right: -40,
      width: 110, height: 110,
      borderRadius: 55,
      backgroundColor: accent,
      opacity: 0.34,
    },
    inner: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 10,
      gap: 8,
    },
    /* Single hero row: emoji | temp | meta-stack | location pill on top-right */
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    emojiWrap: {
      width: 52, height: 52,
      alignItems: 'center', justifyContent: 'center',
    },
    emoji: { fontSize: 38, lineHeight: 42 },
    midCol: { flex: 1, justifyContent: 'center', paddingTop: 2 },
    tempRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    temp: {
      fontSize: 40,
      fontWeight: '300',
      color: '#FFF',
      letterSpacing: -1.6,
      lineHeight: 42,
      includeFontPadding: false,
    },
    condition: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFFEE',
      letterSpacing: -0.1,
      paddingBottom: 6,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 1,
    },
    metaText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#FFFFFFAE',
      letterSpacing: 0.1,
    },
    metaDot: {
      width: 2, height: 2, borderRadius: 1,
      backgroundColor: '#FFFFFF60',
      marginHorizontal: 6,
    },
    rightCol: {
      alignItems: 'flex-end',
      gap: 6,
    },
    locPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: '#FFFFFF1F',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#FFFFFF30',
      maxWidth: 130,
    },
    locText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: '#FFFFFFEE',
      letterSpacing: 0.3,
      flexShrink: 1,
    },
    refreshChip: {
      width: 28, height: 28, borderRadius: 10,
      backgroundColor: '#FFFFFF1F',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#FFFFFF30',
      alignItems: 'center', justifyContent: 'center',
    },
    refreshChipPressed: {
      backgroundColor: '#FFFFFF35',
      transform: [{ scale: 0.92 }],
    },
    /* Hourly strip: horizontal scroll, slim */
    hourlyScroll: {
      marginHorizontal: -4,
    },
    hourlyContent: {
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 4,
      alignItems: 'center',
    },

    placeholderCard: {
      borderRadius: 22,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 64,
      backgroundColor: surfaceTint,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: borderTint,
    },
    placeholderIconWrap: {
      width: 40, height: 40, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#FFFFFF22',
    },
    placeholderText: { fontSize: 12, color: '#FFFFFFCC', flex: 1, fontWeight: '600' },
  });

  if (loading && !snap) {
    return (
      <View style={styles.placeholderCard}>
        <View style={styles.placeholderIconWrap}>
          <ActivityIndicator size="small" color="#FFF" />
        </View>
        <Text style={styles.placeholderText}>Checking weather…</Text>
      </View>
    );
  }

  if (!snap) {
    return (
      <Pressable style={styles.placeholderCard} onPress={() => load(true)}>
        <View style={styles.placeholderIconWrap}>
          <Ionicons name="location-outline" size={20} color="#FFF" />
        </View>
        <Text style={styles.placeholderText}>{error ?? 'Weather unavailable'}</Text>
        <View style={styles.refreshChip}>
          <Ionicons name="refresh" size={13} color="#FFF" />
        </View>
      </Pressable>
    );
  }

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] });
  const scale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const hourly = snap.hourly?.length ? snap.hourly.slice(0, 8) : [];

  return (
    <Pressable onPress={() => load(true)} style={styles.card}>
      <View style={styles.sheen} />
      <View style={styles.accentBlob} />

      <View style={styles.inner}>
        {/* Hero — single tight row */}
        <View style={styles.heroRow}>
          <Animated.View style={[styles.emojiWrap, { transform: [{ translateY }, { scale }] }]}>
            <Text style={styles.emoji}>{snap.emoji}</Text>
          </Animated.View>

          <View style={styles.midCol}>
            <View style={styles.tempRow}>
              <Text style={styles.temp}>{snap.temperature}°</Text>
              <Text style={styles.condition} numberOfLines={1}>
                {snap.condition}
                {snap.isWindy ? ' · Windy' : ''}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>H {snap.highToday}°</Text>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>L {snap.lowToday}°</Text>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>💧 {snap.humidity}%</Text>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{snap.windKph} km/h</Text>
            </View>
          </View>

          <View style={styles.rightCol}>
            <View style={styles.locPill}>
              <Ionicons name="location-sharp" size={10} color="#FFFFFFEE" />
              <Text style={styles.locText} numberOfLines={1}>{snap.locationLabel}</Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                load(true);
              }}
              hitSlop={10}
              style={({ pressed }) => [styles.refreshChip, pressed && styles.refreshChipPressed]}
            >
              {loading ? (
                <ActivityIndicator size={11} color="#FFF" />
              ) : (
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
                      },
                    ],
                  }}
                >
                  <Ionicons name="refresh" size={12} color="#FFF" />
                </Animated.View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Hourly strip — horizontal scroll */}
        {hourly.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hourlyScroll}
            contentContainerStyle={styles.hourlyContent}
          >
            {hourly.map((slot, i) => (
              <HourPill key={slot.ts} slot={slot} isFirst={i === 0} />
            ))}
          </ScrollView>
        )}
      </View>
    </Pressable>
  );
}
