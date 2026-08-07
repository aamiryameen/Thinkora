import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Switch, Alert, TextInput, Modal, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  formatCity,
  getCurrentWeather,
  getSavedPlace,
  fetchCityPreviews,
  searchCities,
  setSavedPlace,
  WEATHER_THEMES,
  type CityPreview,
  type CityResult,
  type WeatherSnapshot,
} from '../services/weatherService';
import {
  isWeatherAlertsEnabled,
  setWeatherAlertsEnabled,
} from '../services/weatherAlertService';
import { WeatherDecor, WeatherGradient } from '../components/WeatherDecor';

function dayLabel(ts: number, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short' });
}

function dateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function timeLabel(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function hourLabel(ts: number, isFirst: boolean): string {
  if (isFirst) return 'Now';
  const d = new Date(ts);
  const h = d.getHours();
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

export function WeatherDetailScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [snap, setSnap] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seeded true to match the on-by-default setting: starting at false would
  // flash the switch off and then on as the stored value loads.
  const [alertsOn, setAlertsOn] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  /** Index of the expanded forecast day, or null when all are collapsed. */
  const [openDay, setOpenDay] = useState<number | null>(null);

  // ── City search ───────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [previews, setPreviews] = useState<Map<number, CityPreview>>(new Map());
  const [isPinned, setIsPinned] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    getSavedPlace().then((p) => setIsPinned(p !== null));
  }, []);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      searchAbort.current?.abort();
      const ctrl = new AbortController();
      searchAbort.current = ctrl;
      const found = await searchCities(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResults(found);
      setPreviews(new Map());
      setSearching(false);
      // Live temperatures for every result in one batched request, so the cards
      // can lead with a reading instead of just a place name.
      if (found.length > 0) {
        const p = await fetchCityPreviews(found, ctrl.signal);
        if (!ctrl.signal.aborted) setPreviews(p);
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [query, searchOpen]);

  useEffect(() => () => searchAbort.current?.abort(), []);

  const load = useCallback(async (force: boolean) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const next = await getCurrentWeather({ forceRefresh: force, signal: ctrl.signal });
      if (!ctrl.signal.aborted) {
        setSnap(next);
        setError(next ? null : 'Weather unavailable');
      }
    } catch {
      if (!ctrl.signal.aborted) setError('Weather unavailable');
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load(false);
    isWeatherAlertsEnabled().then(async (on) => {
      setAlertsOn(on);
      // Alerts default to on, but app start never prompts for permission (a
      // cold-open prompt gets reflexively denied). This screen is the right
      // place to ask: the user is looking at the weather, so the request has
      // obvious context. Re-running setup is idempotent.
      // Only reflect the outcome in the UI — deliberately not persisted as an
      // opt-out, so a denial now doesn't permanently disable the default. The
      // user can still flip the switch to be asked again.
      if (on) {
        const ok = await setWeatherAlertsEnabled(true);
        if (!ok) setAlertsOn(false);
      }
    });
    return () => abortRef.current?.abort();
  }, [load]);

  const onToggleAlerts = useCallback(async (value: boolean) => {
    // Optimistic so the switch feels instant; reverted if setup fails.
    setAlertsOn(value);
    const ok = await setWeatherAlertsEnabled(value);
    if (!ok) {
      setAlertsOn(false);
      Alert.alert(
        'Notifications blocked',
        'Enable notifications for Thinkora in your device settings to get weather alerts.',
      );
    }
  }, []);

  const pickCity = useCallback(
    async (city: CityResult) => {
      setSearchOpen(false);
      setQuery('');
      setResults([]);
      await setSavedPlace({
        name: formatCity(city),
        latitude: city.latitude,
        longitude: city.longitude,
      });
      setIsPinned(true);
      setLoading(true);
      // Force, because setSavedPlace cleared the cache but a stale in-memory
      // snapshot would otherwise still be shown.
      load(true);
    },
    [load],
  );

  const useMyLocation = useCallback(async () => {
    setSearchOpen(false);
    await setSavedPlace(null);
    setIsPinned(false);
    setLoading(true);
    load(true);
  }, [load]);

  const wx = snap ? WEATHER_THEMES[snap.theme] : null;

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0B1220' },
    heroWrap: {
      paddingTop: insets.top,
      overflow: 'hidden',
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 8,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#FFFFFF1F',
    },
    place: { flex: 1 },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    placeText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: -0.2, flexShrink: 1 },
    dateText: { fontSize: 12, color: '#FFFFFFA8', marginTop: 1 },

    heroSearch: {
      flexDirection: 'row', alignItems: 'center', gap: 9,
      marginHorizontal: 14, marginTop: 10,
      paddingHorizontal: 15, paddingVertical: 12,
      // Full-radius pill with a bright hairline, matching the reference.
      borderRadius: 999,
      borderWidth: 1, borderColor: '#FFFFFF4A',
      backgroundColor: '#FFFFFF14',
    },
    heroSearchPressed: { backgroundColor: '#FFFFFF26' },
    heroSearchText: { flex: 1, fontSize: 14.5, color: '#FFFFFFB8', fontWeight: '500' },
    pinnedChip: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: 7, paddingVertical: 3,
      borderRadius: 999, backgroundColor: '#FFD36E',
    },
    pinnedChipText: { fontSize: 9, fontWeight: '800', color: '#0B1220', letterSpacing: 0.3 },

    hero: { alignItems: 'center', paddingTop: 6, paddingBottom: 22 },
    heroEmojiWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
    heroHalo: {
      position: 'absolute',
      width: 104, height: 104, borderRadius: 52,
      opacity: 0.18,
    },
    heroEmoji: { fontSize: 88, lineHeight: 100 },
    heroTempRow: { flexDirection: 'row', alignItems: 'flex-start' },
    heroTemp: {
      fontSize: 84,
      fontWeight: '200',
      color: '#FFF',
      letterSpacing: -4,
      lineHeight: 90,
      includeFontPadding: false,
    },
    heroDegree: {
      fontSize: 32, fontWeight: '300', color: '#FFFFFFDD',
      lineHeight: 44, includeFontPadding: false,
    },
    heroCond: { fontSize: 17, fontWeight: '700', color: '#FFF', marginTop: 2 },
    heroFeels: { fontSize: 13, color: '#FFFFFFB0', marginTop: 3 },
    heroRange: { fontSize: 13, color: '#FFFFFFC8', marginTop: 6, fontWeight: '600' },
    heroStats: {
      flexDirection: 'row',
      marginTop: 18,
      paddingHorizontal: 6,
      alignSelf: 'stretch',
    },
    heroStat: { flex: 1, alignItems: 'center', gap: 3 },
    heroStatVal: { fontSize: 15, fontWeight: '700', color: '#FFF', marginTop: 2 },
    heroStatLbl: { fontSize: 10.5, color: '#FFFFFF9C', fontWeight: '500' },

    body: { padding: 14, gap: 14, paddingBottom: insets.bottom + 28 },

    section: {
      backgroundColor: '#141C2E',
      borderRadius: 20,
      padding: 14,
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#FFFFFF12',
    },
    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: '#FFFFFF8C',
      letterSpacing: 0.6, textTransform: 'uppercase',
    },
    sectionHead: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    sectionHint: { fontSize: 10, fontWeight: '600', color: '#FFFFFF5C' },
    hourScroll: { marginHorizontal: -14 },
    hourScrollContent: { paddingHorizontal: 14 },
    hourDay: {
      fontSize: 8.5, fontWeight: '700', color: '#FFD36E',
      letterSpacing: 0.3, marginTop: 1,
    },

    hourRow: { flexDirection: 'row', gap: 6 },
    hourPill: {
      alignItems: 'center', gap: 4,
      paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: '#FFFFFF0E',
      minWidth: 62,
    },
    hourPillNow: {
      backgroundColor: '#1E4E7A',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#5AA9F0',
    },
    hourLabel: { fontSize: 11, fontWeight: '700', color: '#FFFFFFB8' },
    hourEmoji: { fontSize: 22 },
    hourTemp: { fontSize: 13, fontWeight: '700', color: '#FFF' },

    dayCard: {
      backgroundColor: '#FFFFFF0A',
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#FFFFFF14',
      marginBottom: 8,
      overflow: 'hidden',
    },
    dayCardOpen: {
      backgroundColor: '#FFFFFF14',
      borderColor: '#FFFFFF2E',
    },
    dayDetail: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    dayTile: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: '#FFFFFF0E',
    },
    dayTileVal: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    dayTileLbl: {
      fontSize: 9, fontWeight: '600', color: '#FFFFFF8C',
      letterSpacing: 0.3, textTransform: 'uppercase',
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 10,
    },
    dayName: { width: 74 },
    dayNameText: { fontSize: 13, fontWeight: '700', color: '#FFFFFFE0' },
    dayDateText: { fontSize: 10, color: '#FFFFFF7A', marginTop: 1 },
    dayEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
    dayCondCol: { flex: 1, minWidth: 0 },
    dayCondText: {
      fontSize: 12, fontWeight: '600', color: '#FFFFFFC8', letterSpacing: -0.1,
    },
    dayPrecip: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
    dayPrecipText: { fontSize: 10.5, fontWeight: '600', color: '#8FC4F0' },
    dayTemps: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, width: 76 },
    dayHigh: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    dayLow: { fontSize: 14, fontWeight: '600', color: '#FFFFFF88' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    gridCell: {
      // Three per row like the reference. flexBasis (not width) so a trailing
      // odd cell grows to fill instead of leaving a gap.
      flexBasis: '30%',
      flexGrow: 1,
      backgroundColor: '#FFFFFF0E',
      borderRadius: 14,
      padding: 11,
      gap: 3,
    },
    gridHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    gridLabel: {
      fontSize: 9.5, fontWeight: '700', color: '#FFFFFF8C',
      letterSpacing: 0.3, textTransform: 'uppercase',
      flexShrink: 1,
    },
    gridValue: { fontSize: 15, fontWeight: '700', color: '#FFF', marginTop: 1 },

    alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    alertBody: { flex: 1 },
    alertTitle: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    alertHint: { fontSize: 11, color: '#FFFFFF9C', marginTop: 2, lineHeight: 16 },

    /* ── City search (reference layout) ── */
    searchRoot: { flex: 1, backgroundColor: '#0B1220', paddingTop: insets.top },
    searchHead: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14,
    },
    searchBack: {
      width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    },
    searchTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', letterSpacing: -0.2 },
    searchField: {
      flexDirection: 'row', alignItems: 'center', gap: 9,
      marginHorizontal: 14, marginBottom: 14,
      paddingHorizontal: 15,
      // Full-radius pill, as in the reference.
      borderRadius: 999,
      borderWidth: 1, borderColor: '#FFFFFF52',
      backgroundColor: '#FFFFFF14',
    },
    searchInput: {
      flex: 1, fontSize: 15, color: '#FFF',
      paddingVertical: 13,
      // Android pads TextInput internally, which would make the pill uneven.
      padding: 0,
    },
    resultList: { paddingHorizontal: 14, paddingBottom: insets.bottom + 24, gap: 12 },
    myLocCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, borderRadius: 18,
      backgroundColor: '#141C2E',
      borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF14',
    },
    myLocLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
    myLocTitle: { fontSize: 14, fontWeight: '700', color: '#FFF' },
    myLocHint: { fontSize: 11, color: '#FFFFFF8C', marginTop: 2 },

    cityCard: {
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#FFFFFF1F',
      minHeight: 104,
    },
    cityScrim: {
      ...StyleSheet.absoluteFillObject,
      // Cards carry live per-city skies, some of which are light, so white text
      // needs the same protection the main card's scrim provides.
      backgroundColor: 'rgba(5,11,22,0.30)',
    },
    cityInner: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      gap: 10,
    },
    cityLeft: { flex: 1, minWidth: 0 },
    cityTemp: {
      fontSize: 28, fontWeight: '700', color: '#FFF',
      letterSpacing: -0.8, includeFontPadding: false,
    },
    cityCond: { fontSize: 12.5, color: '#FFFFFFC8', fontWeight: '500', marginTop: 1 },
    cityNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
    cityName: {
      fontSize: 15, fontWeight: '700', color: '#FFF', flexShrink: 1, letterSpacing: -0.2,
    },
    cityRegion: { fontSize: 10.5, color: '#FFFFFF8C', fontWeight: '500', marginTop: 1 },
    cityEmoji: { fontSize: 50, lineHeight: 58 },

    searchEmpty: { alignItems: 'center', paddingTop: 50, gap: 10 },
    searchEmptyText: {
      fontSize: 13, color: '#FFFFFF8C', textAlign: 'center',
      paddingHorizontal: 40, lineHeight: 19,
    },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 },
    errorText: { fontSize: 14, color: '#FFFFFFB0', textAlign: 'center' },
    retryBtn: {
      paddingHorizontal: 18, paddingVertical: 10,
      borderRadius: 999, backgroundColor: '#2E6FD9',
    },
    retryText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  });

  if (loading && !snap) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator color="#FFF" />
        </View>
      </View>
    );
  }

  if (!snap) {
    return (
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color="#FFFFFF66" />
          <Text style={styles.errorText}>
            {error ?? "Couldn't load the forecast."}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(true); }}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const today = snap.daily[0];

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor="#FFF"
          />
        }
      >
        {/* Hero uses the same themed sky as the card, so tapping through feels
            like the card expanding rather than a different screen. */}
        <View style={styles.heroWrap}>
          {wx ? (
            <>
              <WeatherGradient colors={wx.gradient} />
              <WeatherDecor theme={wx} />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(5,11,22,0.26)' }]} />
            </>
          ) : null}

          <View style={styles.topBar}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <View style={styles.place}>
              <View style={styles.placeRow}>
                <Ionicons name="navigate-circle" size={13} color="#FFFFFFCC" />
                <Text style={styles.placeText} numberOfLines={1}>{snap.locationLabel}</Text>
              </View>
              {/* Locality only when the geocoder resolved something finer than
                  the city, so we never print "Lahore · Lahore". */}
              <Text style={styles.dateText} numberOfLines={1}>
                {snap.localityLabel
                  ? `${snap.localityLabel} · ${new Date(snap.fetchedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`
                  : new Date(snap.fetchedAt).toLocaleDateString(undefined, {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
              </Text>
            </View>
          </View>

          {/* Search pill on the hero itself, as in the reference. Not a real
              TextInput: tapping opens the search screen, so focus and the
              keyboard live in one place rather than fighting this screen's
              scroll. It reads as a field because that's what invites the tap. */}
          <Pressable
            style={({ pressed }) => [styles.heroSearch, pressed && styles.heroSearchPressed]}
            onPress={() => setSearchOpen(true)}
          >
            <Ionicons name="search" size={17} color="#FFFFFFB0" />
            <Text style={styles.heroSearchText}>Search for a city</Text>
            {isPinned ? (
              <View style={styles.pinnedChip}>
                <Ionicons name="pin" size={9} color="#0B1220" />
                <Text style={styles.pinnedChipText}>Pinned</Text>
              </View>
            ) : null}
          </Pressable>

          <View style={styles.hero}>
            <View style={styles.heroEmojiWrap}>
              <View style={[styles.heroHalo, { backgroundColor: wx?.glowColor ?? '#FFD36E' }]} />
              <Text style={styles.heroEmoji}>{snap.emoji}</Text>
            </View>
            <View style={styles.heroTempRow}>
              <Text style={styles.heroTemp}>{snap.temperature}</Text>
              <Text style={styles.heroDegree}>°</Text>
            </View>
            <Text style={styles.heroCond}>{snap.condition}</Text>
            {snap.feelsLabel ? (
              <Text style={styles.heroFeels}>
                {snap.feelsLabel} · feels like {snap.feelsLike}°
              </Text>
            ) : (
              <Text style={styles.heroFeels}>Feels like {snap.feelsLike}°</Text>
            )}
            {today ? (
              <Text style={styles.heroRange}>
                H {today.high}°  ·  L {today.low}°
              </Text>
            ) : null}

            {/* Three labelled stats under the hero, as in the reference. */}
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Ionicons name="navigate-outline" size={17} color="#FFFFFFD8" />
                <Text style={styles.heroStatVal}>{snap.windKph}km/h</Text>
                <Text style={styles.heroStatLbl}>Wind speed</Text>
              </View>
              <View style={styles.heroStat}>
                <Ionicons name="rainy-outline" size={17} color="#FFFFFFD8" />
                <Text style={styles.heroStatVal}>{snap.precipChance}%</Text>
                <Text style={styles.heroStatLbl}>Chance of rain</Text>
              </View>
              <View style={styles.heroStat}>
                <Ionicons name="water-outline" size={17} color="#FFFFFFD8" />
                <Text style={styles.heroStatVal}>{snap.humidity}%</Text>
                <Text style={styles.heroStatLbl}>Humidity</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* Hourly */}
          {snap.hourly.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Next 24 hours</Text>
                <Text style={styles.sectionHint}>Scroll →</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                // Negative margin + matching padding lets the strip bleed to the
                // card edge, so the last pill isn't clipped mid-scroll.
                style={styles.hourScroll}
                contentContainerStyle={styles.hourScrollContent}
              >
                <View style={styles.hourRow}>
                  {snap.hourly.map((slot, i) => (
                    <View
                      key={slot.ts}
                      style={[styles.hourPill, i === 0 && styles.hourPillNow]}
                    >
                      <Text style={styles.hourLabel}>{hourLabel(slot.ts, i === 0)}</Text>
                      <Text style={styles.hourEmoji}>{slot.emoji}</Text>
                      <Text style={styles.hourTemp}>{Math.round(slot.temperature)}°</Text>
                      {/* A day-marker under midnight, so 24 hours of pills don't
                          read as all belonging to today. */}
                      {new Date(slot.ts).getHours() === 0 ? (
                        <Text style={styles.hourDay}>
                          {new Date(slot.ts).toLocaleDateString(undefined, { weekday: 'short' })}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          {/* 10-day forecast.
              Each day is its own card; the inner row is what actually lays the
              content out horizontally. An earlier edit dropped that inner row,
              which made every field stack vertically. */}
          {snap.daily.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>
                  {snap.daily.length}-day forecast
                </Text>
                <Text style={styles.sectionHint}>Tap a day</Text>
              </View>

              {snap.daily.map((day, i) => {
                const isOpen = openDay === i;
                return (
                  <Pressable
                    key={day.ts}
                    style={[styles.dayCard, isOpen && styles.dayCardOpen]}
                    onPress={() => setOpenDay(isOpen ? null : i)}
                  >
                    <View style={styles.dayRow}>
                      <View style={styles.dayName}>
                        <Text style={styles.dayNameText}>{dayLabel(day.ts, i)}</Text>
                        <Text style={styles.dayDateText}>{dateLabel(day.ts)}</Text>
                      </View>

                      <Text style={styles.dayEmoji}>{day.emoji}</Text>

                      {/* Named condition, not just the glyph. A cloud with a
                          bolt could read as rain, and thunderstorm vs drizzle
                          changes whether you'd go out. */}
                      <View style={styles.dayCondCol}>
                        <Text style={styles.dayCondText} numberOfLines={1}>
                          {day.condition}
                        </Text>
                        {day.precipChance > 0 ? (
                          <View style={styles.dayPrecip}>
                            <Ionicons name="water" size={9} color="#8FC4F0" />
                            <Text style={styles.dayPrecipText}>{day.precipChance}%</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.dayTemps}>
                        <Text style={styles.dayHigh}>{day.high}°</Text>
                        <Text style={styles.dayLow}>{day.low}°</Text>
                      </View>
                    </View>

                    {/* Expanded detail, from the reference's tile grid. Only the
                        tapped day renders it, so the list stays scannable. */}
                    {isOpen ? (
                      <View style={styles.dayDetail}>
                        <View style={styles.dayTile}>
                          <Ionicons name="thermometer-outline" size={15} color="#FFD36E" />
                          <Text style={styles.dayTileVal}>{day.high}°</Text>
                          <Text style={styles.dayTileLbl}>High</Text>
                        </View>
                        <View style={styles.dayTile}>
                          <Ionicons name="snow-outline" size={15} color="#8FC4F0" />
                          <Text style={styles.dayTileVal}>{day.low}°</Text>
                          <Text style={styles.dayTileLbl}>Low</Text>
                        </View>
                        <View style={styles.dayTile}>
                          <Ionicons name="rainy-outline" size={15} color="#5AA9F0" />
                          <Text style={styles.dayTileVal}>{day.precipChance}%</Text>
                          <Text style={styles.dayTileLbl}>Rain</Text>
                        </View>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Details grid. Cells are only rendered when the provider actually
              returned the value — ECMWF omits UV, and showing "0" would be a
              lie rather than a gap. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.grid}>
              <View style={styles.gridCell}>
                <View style={styles.gridHead}>
                    <Ionicons name="water-outline" size={12} color="#8FC4F0" />
                    <Text style={styles.gridLabel}>Humidity</Text>
                  </View>
                <Text style={styles.gridValue}>{snap.humidity}%</Text>
              </View>
              <View style={styles.gridCell}>
                <View style={styles.gridHead}>
                    <Ionicons name="navigate-outline" size={12} color="#A7D8B4" />
                    <Text style={styles.gridLabel}>Wind</Text>
                  </View>
                <Text style={styles.gridValue}>{snap.windKph} km/h</Text>
              </View>
              <View style={styles.gridCell}>
                <View style={styles.gridHead}>
                    <Ionicons name="flag-outline" size={12} color="#C3D4E2" />
                    <Text style={styles.gridLabel}>Gusts</Text>
                  </View>
                <Text style={styles.gridValue}>{snap.windGustKph} km/h</Text>
              </View>
              <View style={styles.gridCell}>
                <View style={styles.gridHead}>
                    <Ionicons name="rainy-outline" size={12} color="#5AA9F0" />
                    <Text style={styles.gridLabel}>Rain chance</Text>
                  </View>
                <Text style={styles.gridValue}>{snap.precipChance}%</Text>
              </View>
              {snap.sunrise ? (
                <View style={styles.gridCell}>
                  <View style={styles.gridHead}>
                    <Ionicons name="sunny-outline" size={12} color="#FFD36E" />
                    <Text style={styles.gridLabel}>Sunrise</Text>
                  </View>
                  <Text style={styles.gridValue}>{timeLabel(snap.sunrise)}</Text>
                </View>
              ) : null}
              {snap.sunset ? (
                <View style={styles.gridCell}>
                  <View style={styles.gridHead}>
                    <Ionicons name="moon-outline" size={12} color="#C6A8FF" />
                    <Text style={styles.gridLabel}>Sunset</Text>
                  </View>
                  <Text style={styles.gridValue}>{timeLabel(snap.sunset)}</Text>
                </View>
              ) : null}
              {snap.uvIndex !== null ? (
                <View style={styles.gridCell}>
                  <View style={styles.gridHead}>
                    <Ionicons name="sunny" size={12} color="#FF9E5E" />
                    <Text style={styles.gridLabel}>UV index</Text>
                  </View>
                  <Text style={styles.gridValue}>{snap.uvIndex}</Text>
                </View>
              ) : null}
              {snap.roadLabel ? (
                <View style={styles.gridCell}>
                  <View style={styles.gridHead}>
                    <Ionicons name="navigate-circle-outline" size={12} color="#8FC4F0" />
                    <Text style={styles.gridLabel}>Near</Text>
                  </View>
                  <Text style={[styles.gridValue, { fontSize: 13 }]} numberOfLines={2}>
                    {snap.roadLabel}
                  </Text>
                </View>
              ) : null}
              {snap.latitude !== null && snap.longitude !== null ? (
                <View style={styles.gridCell}>
                  <View style={styles.gridHead}>
                    <Ionicons name="locate-outline" size={12} color="#9EA9B4" />
                    <Text style={styles.gridLabel}>Coordinates</Text>
                  </View>
                  <Text style={[styles.gridValue, { fontSize: 13 }]}>
                    {snap.latitude.toFixed(3)}, {snap.longitude.toFixed(3)}
                  </Text>
                </View>
              ) : null}
              {snap.precipMm > 0 ? (
                <View style={styles.gridCell}>
                  <View style={styles.gridHead}>
                    <Ionicons name="umbrella-outline" size={12} color="#5AA9F0" />
                    <Text style={styles.gridLabel}>Precipitation</Text>
                  </View>
                  <Text style={styles.gridValue}>{snap.precipMm} mm</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Alerts */}
          <View style={styles.section}>
            <View style={styles.alertRow}>
              <Ionicons name="notifications-outline" size={20} color="#FFD36E" />
              <View style={styles.alertBody}>
                <Text style={styles.alertTitle}>Weather alerts</Text>
                <Text style={styles.alertHint}>
                  A morning summary, plus a heads-up when rain, storms or extreme
                  heat are expected today.
                </Text>
              </View>
              <Switch
                value={alertsOn}
                onValueChange={onToggleAlerts}
                trackColor={{ false: '#3A4256', true: '#2E6FD9' }}
                thumbColor="#FFF"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* City search — reference layout: a rounded pill field, then results as
          temperature-forward cards (big reading left, large glyph right) rather
          than a plain text list. */}
      <Modal
        visible={searchOpen}
        animationType="slide"
        onRequestClose={() => setSearchOpen(false)}
      >
        <View style={styles.searchRoot}>
          <View style={styles.searchHead}>
            <Pressable
              onPress={() => setSearchOpen(false)}
              hitSlop={10}
              style={styles.searchBack}
            >
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <Text style={styles.searchTitle}>Weather in other cities</Text>
          </View>

          <View style={styles.searchField}>
            <Ionicons name="search" size={17} color="#FFFFFF9C" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search for a city"
              placeholderTextColor="#FFFFFF7A"
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={17} color="#FFFFFF9C" />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.resultList}
            ListHeaderComponent={
              <Pressable style={styles.myLocCard} onPress={useMyLocation}>
                <View style={styles.myLocLeft}>
                  <Ionicons name="navigate-circle" size={22} color="#FFF" />
                  <View>
                    <Text style={styles.myLocTitle}>Use my location</Text>
                    <Text style={styles.myLocHint}>
                      {isPinned ? 'A city is pinned right now' : 'Currently in use'}
                    </Text>
                  </View>
                </View>
                {!isPinned ? (
                  <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF8C" />
                )}
              </Pressable>
            }
            renderItem={({ item, index }) => {
              const preview = previews.get(index);
              const theme = preview ? WEATHER_THEMES[preview.theme] : null;
              return (
                <Pressable style={styles.cityCard} onPress={() => pickCity(item)}>
                  {/* Each card wears its city's own sky, so the list doubles as
                      a glance at conditions worldwide. */}
                  {theme ? <WeatherGradient colors={theme.gradient} /> : null}
                  <View style={styles.cityScrim} />
                  <View style={styles.cityInner}>
                    <View style={styles.cityLeft}>
                      {preview ? (
                        <Text style={styles.cityTemp}>{preview.temperature}°C</Text>
                      ) : (
                        <ActivityIndicator size="small" color="#FFFFFF9C" />
                      )}
                      <Text style={styles.cityCond} numberOfLines={1}>
                        {preview?.condition ?? 'Loading…'}
                      </Text>
                      <View style={styles.cityNameRow}>
                        <Text style={styles.cityName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Ionicons name="location" size={11} color="#FFFFFFCC" />
                      </View>
                      <Text style={styles.cityRegion} numberOfLines={1}>
                        {[item.admin1, item.country].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                    <Text style={styles.cityEmoji}>{preview?.emoji ?? '🌡️'}</Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.searchEmpty}>
                {searching ? (
                  <ActivityIndicator color="#FFFFFF8C" />
                ) : query.trim().length >= 2 ? (
                  <>
                    <Ionicons name="search-outline" size={30} color="#FFFFFF3C" />
                    <Text style={styles.searchEmptyText}>
                      No places match “{query.trim()}”.
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="earth-outline" size={30} color="#FFFFFF3C" />
                    <Text style={styles.searchEmptyText}>
                      Type at least two letters to search worldwide.
                    </Text>
                  </>
                )}
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}
