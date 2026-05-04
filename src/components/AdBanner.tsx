import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AD_UNITS } from '../services/ads';

interface Props {
  size?: BannerAdSize;
  style?: object;
}

export function AdBanner({ size = BannerAdSize.ADAPTIVE_BANNER, style }: Props) {
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Retry loading ad on failure (up to 5 times with increasing delay)
  const handleFailedToLoad = useCallback((error: any) => {
    if (__DEV__) console.warn('[Ads] Banner failed:', error);
    setLoaded(false);
    if (retryCount.current < 5) {
      const delay = Math.min(30000, (retryCount.current + 1) * 10000); // 10s, 20s, 30s...
      retryTimer.current = setTimeout(() => {
        retryCount.current += 1;
        setRetryKey(k => k + 1); // remount BannerAd to retry
      }, delay);
    }
  }, []);

  const handleLoaded = useCallback(() => {
    setLoaded(true);
    retryCount.current = 0; // reset on success
    if (__DEV__) console.log('[Ads] Banner loaded');
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  return (
    <View style={[styles.container, { bottom: insets.bottom }, !loaded && styles.hidden, style]}>
      <BannerAd
        key={`ad-${retryKey}`}
        unitId={AD_UNITS.banner}
        size={size}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={handleLoaded}
        onAdFailedToLoad={handleFailedToLoad}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'transparent',
  },
  hidden: {
    height: 0,
    overflow: 'hidden',
  },
});
