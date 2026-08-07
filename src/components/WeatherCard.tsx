import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  getCurrentWeather,
  WEATHER_THEMES,
  type WeatherSnapshot,
} from '../services/weatherService';
import { checkAndNotify } from '../services/weatherAlertService';
import { WeatherDecor, WeatherGradient } from './WeatherDecor';

/**
 * How often an open card re-reads the weather. Open-Meteo updates its
 * `minutely_15` data every 15 minutes, so polling faster only burns battery —
 * the service's own 2-minute cache absorbs any redundant calls.
 */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface Props {
  onPrimary?: boolean;
}

/** Compact hour label for the pills, e.g. "4PM". */
function hourText(ts: number): string {
  const h = new Date(ts).getHours();
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}

export function WeatherCard({ onPrimary = true }: Props) {
  const navigation = useNavigation<any>();
  const [snap, setSnap] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
        // Fire condition warnings off the back of a normal refresh. The service
        // dedupes per kind per day, so calling this on every load is safe and
        // means alerts work without a background task.
        checkAndNotify(result).catch(() => {});
      }
    } catch {
      if (!ctrl.signal.aborted) setError('Weather unavailable');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);

    // Weather must stay live, and a mount-only fetch does not: the card would
    // keep showing whatever it read when the screen first appeared, which on a
    // long-lived session means hours-old data.
    //
    // Two triggers cover the realistic cases:
    //  - a timer, for a screen left open
    //  - app foregrounding, which is when a backgrounded app is most stale
    //    (timers are unreliable while backgrounded, so this is the safety net)
    // Both go through the same cached fetch, so repeat calls inside the
    // service's short TTL are cheap and don't hammer the API.
    const interval = setInterval(() => load(false), REFRESH_INTERVAL_MS);

    let lastState = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if ((lastState === 'background' || lastState === 'inactive') && next === 'active') {
        load(false);
      }
      lastState = next;
    });

    return () => {
      clearInterval(interval);
      sub.remove();
      abortRef.current?.abort();
    };
  }, [load]);

  const surfaceTint = onPrimary ? '#FFFFFF14' : 'rgba(15,23,41,0.04)';
  const surfaceTop = onPrimary ? '#FFFFFF22' : 'rgba(255,255,255,0.6)';
  const borderTint = onPrimary ? '#FFFFFF33' : 'rgba(15,23,41,0.08)';
  const accent = snap?.accent ?? '#F59E0B';

  // The card takes its whole look from the current conditions. Until the first
  // fetch resolves there is no theme, so the plain translucent surface is used
  // — better than flashing a wrong sky and then correcting it.
  const wx = snap ? WEATHER_THEMES[snap.theme] : null;

  const styles = StyleSheet.create({
    card: {
      // 18 rather than 22: the reference cards are wide and short, and a large
      // radius on a ~104px-tall card starts eating the corners of the content.
      borderRadius: 18,
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
    /**
     * Text protection.
     *
     * This layout puts text across the full width (icon + condition left,
     * temperature right, pills along the bottom), so a column split no longer
     * works. Instead the scrim is weighted vertically: stronger through the
     * middle band where the largest type sits, lighter at the top where the
     * decorations originate so the animation still reads.
     */
    scrimTop: {
      position: 'absolute',
      left: 0, right: 0, top: 0,
      height: '34%',
      backgroundColor: 'rgba(5,11,22,0.14)',
    },
    scrimBody: {
      position: 'absolute',
      left: 0, right: 0, top: '34%', bottom: 0,
      // 0.32 keeps white text at 4.9:1 even on the lightest theme's horizon.
      backgroundColor: 'rgba(5,11,22,0.32)',
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
      paddingTop: 12,
      paddingBottom: 12,
      gap: 10,
    },
    topZone: { flexDirection: 'row', alignItems: 'flex-start' },
    iconCol: { flex: 1 },
    iconWrap: {
      width: 62, height: 62,
      alignItems: 'center', justifyContent: 'center',
      marginLeft: -4,
    },
    iconHalo: {
      position: 'absolute',
      width: 54, height: 54, borderRadius: 27,
      // Soft bloom behind the glyph, echoing the reference's backlit sun.
      opacity: 0.26,
    },
    bigEmoji: { fontSize: 46, lineHeight: 54 },
    condition: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFF',
      letterSpacing: -0.2,
      marginTop: 1,
    },
    rangeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    rangeGap: { marginLeft: 10 },
    rangeVal: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFFEE',
      marginLeft: 2,
      letterSpacing: -0.2,
    },
    tempCol: { alignItems: 'flex-end' },
    tempRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 2 },
    temp: {
      fontSize: 52,
      fontWeight: '300',
      color: '#FFF',
      letterSpacing: -2.4,
      lineHeight: 56,
      includeFontPadding: false,
    },
    degree: {
      fontSize: 22,
      fontWeight: '400',
      color: '#FFFFFFE0',
      lineHeight: 28,
      includeFontPadding: false,
    },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 1,
      maxWidth: 150,
    },
    metaPlace: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#FFFFFFDD',
      letterSpacing: 0.1,
      flexShrink: 1,
    },
    metaCity: {
      fontSize: 9.5,
      fontWeight: '600',
      color: '#FFFFFF8C',
      letterSpacing: 0.2,
      maxWidth: 150,
      marginTop: 1,
    },
    /* Hourly pills — tall rounded capsules, as in the reference. */
    hourRow: { flexDirection: 'row', gap: 5 },
    hourPill: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: 7,
      // Near-stadium radius is the reference's signature for these slots.
      borderRadius: 18,
    },
    hourPillNow: {
      backgroundColor: '#FFFFFF2E',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#FFFFFF45',
    },
    hourLabel: { fontSize: 9.5, fontWeight: '700', color: '#FFFFFFC0' },
    hourEmoji: { fontSize: 17, lineHeight: 21 },
    hourTemp: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFFEE' },
    refreshChip: {
      width: 24, height: 24, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#FFFFFF1A',
    },
    refreshChipPressed: { backgroundColor: '#FFFFFF33' },
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

  // Reference cards show a live clock and short date on the right. Derived from
  // fetchedAt rather than Date.now() so the text always matches the data shown.
  const stamp = new Date(snap.fetchedAt);
  const clockLabel = stamp.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // Five pills is what fits at this width without the labels truncating.
  const hourly = snap.hourly?.length ? snap.hourly.slice(0, 5) : [];

  return (
    <Pressable
      // Tapping the card opens the full forecast; the refresh chip in the top
      // bar handles reloading, so the two actions no longer collide.
      onPress={() => navigation.navigate('WeatherDetail')}
      style={styles.card}
    >
      {/* Background is layered bottom-to-top:
            1. opaque sky gradient   — the palette for these exact conditions
            2. animated decoration   — rain, snow, stars, drifting cloud…
            3. readability scrim     — guarantees text contrast over any sky
          All three are skipped until the first fetch resolves, so the card
          never flashes a wrong sky and then corrects itself. */}
      {wx ? (
        <>
          <WeatherGradient colors={wx.gradient} />
          <WeatherDecor theme={wx} />
          <View style={styles.scrimTop} />
          <View style={styles.scrimBody} />
        </>
      ) : (
        <>
          <View style={styles.sheen} />
          <View style={styles.accentBlob} />
        </>
      )}

      <View style={styles.inner}>
        {/* Top zone: big icon + condition + H/L on the left, temperature and
            location on the right — the reference's arrangement. */}
        <View style={styles.topZone}>
          <View style={styles.iconCol}>
            <View style={styles.iconWrap}>
              <View style={[styles.iconHalo, { backgroundColor: wx?.glowColor ?? accent }]} />
              <Text style={styles.bigEmoji}>{snap.emoji}</Text>
            </View>
            <Text style={styles.condition} numberOfLines={1}>{snap.condition}</Text>
            <View style={styles.rangeRow}>
              <Ionicons name="arrow-up" size={12} color="#FFC93C" />
              <Text style={styles.rangeVal}>{snap.highToday}°</Text>
              <Ionicons name="arrow-down" size={12} color="#5AA9F0" style={styles.rangeGap} />
              <Text style={styles.rangeVal}>{snap.lowToday}°</Text>
            </View>
          </View>

          <View style={styles.tempCol}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                load(true);
              }}
              hitSlop={12}
              style={({ pressed }) => [styles.refreshChip, pressed && styles.refreshChipPressed]}
            >
              {loading ? (
                <ActivityIndicator size={11} color="#FFF" />
              ) : (
                <Ionicons name="refresh" size={12} color="#FFFFFFCC" />
              )}
            </Pressable>
            <View style={styles.tempRow}>
              <Text style={styles.temp}>{snap.temperature}</Text>
              <Text style={styles.degree}>°</Text>
            </View>
            {/* Locality is the point of this line: the city alone reads as a
                region rather than where the user actually is. */}
            <View style={styles.placeRow}>
              <Ionicons name="location" size={10} color="#FFFFFFC0" />
              <Text style={styles.metaPlace} numberOfLines={1}>
                {snap.localityLabel ?? snap.locationLabel}
              </Text>
            </View>
            <Text style={styles.metaCity} numberOfLines={1}>
              {snap.localityLabel ? snap.locationLabel : clockLabel}
            </Text>
          </View>
        </View>

        {/* Hourly pills, back on the card as the reference has them. */}
        {hourly.length > 0 ? (
          <View style={styles.hourRow}>
            {hourly.map((slot, i) => (
              <View
                key={slot.ts}
                style={[
                  styles.hourPill,
                  { backgroundColor: wx?.pillColor ?? '#FFFFFF14' },
                  i === 0 && styles.hourPillNow,
                ]}
              >
                <Text style={styles.hourLabel} numberOfLines={1}>
                  {i === 0 ? 'Now' : hourText(slot.ts)}
                </Text>
                <Text style={styles.hourEmoji}>{slot.emoji}</Text>
                <Text style={styles.hourTemp}>{Math.round(slot.temperature)}°</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
