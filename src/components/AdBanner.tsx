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

  const handleFailedToLoad = useCallback((error: any) => {
    if (__DEV__) console.warn('[Ads] Banner failed:', error);
    setLoaded(false);
    // In debug builds, retry forever with a fixed 10s delay so you always see
    // ads while iterating. Production: cap at 5 retries with backoff.
    const maxRetries = __DEV__ ? Infinity : 5;
    if (retryCount.current < maxRetries) {
      const delay = __DEV__ ? 10000 : Math.min(30000, (retryCount.current + 1) * 10000);
      retryTimer.current = setTimeout(() => {
        retryCount.current += 1;
        setRetryKey(k => k + 1); // remount BannerAd to retry
      }, delay);
    }
  }, []);

  const handleLoaded = useCallback(() => {
    setLoaded(true);
    retryCount.current = 0;
    if (__DEV__) console.log('[Ads] Banner loaded');
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  // In debug, reserve a fixed height so the banner is always visible while
  // the ad fetches — makes it obvious whether ads are wired correctly. In
  // release, keep the original "hide until loaded" behaviour so users never
  // see an empty bar if a request fails.
  const reserveSpace = __DEV__ || loaded;

  return (
    <View
      style={[
        styles.container,
        { bottom: insets.bottom },
        !reserveSpace && styles.hidden,
        style,
      ]}
    >
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
    minHeight: 50,
    backgroundColor: 'transparent',
  },
  hidden: {
    height: 0,
    minHeight: 0,
    overflow: 'hidden',
  },
});
