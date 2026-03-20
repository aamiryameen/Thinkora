import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AD_UNITS } from '../services/ads';

interface Props {
  size?: BannerAdSize;
  style?: object;
}

export function AdBanner({ size = BannerAdSize.ADAPTIVE_BANNER, style }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={[styles.container, !loaded && styles.hidden, style]}>
      <BannerAd
        unitId={AD_UNITS.banner}
        size={size}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => {
          setLoaded(true);
          if (__DEV__) console.log('[Ads] Banner loaded');
        }}
        onAdFailedToLoad={(error) => {
          if (__DEV__) console.warn('[Ads] Banner failed:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  hidden: {
    height: 0,
    overflow: 'hidden',
  },
});
