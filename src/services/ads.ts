import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

// Always use test IDs in dev to guarantee ad delivery during development
const IS_DEV = __DEV__;

export const AD_UNITS = {
  banner:       IS_DEV ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-7724552016512949/1078833867',
  interstitial: IS_DEV ? TestIds.INTERSTITIAL    : 'ca-app-pub-7724552016512949/8913910092',
  rewarded:     IS_DEV ? TestIds.REWARDED        : 'ca-app-pub-7724552016512949/1848990053',
  appOpen:      IS_DEV ? TestIds.APP_OPEN        : 'ca-app-pub-7724552016512949/5564873784',
};

let interstitial: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
let interstitialLoaded = false;

export function loadInterstitial() {
  interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    if (__DEV__) console.log('[Ads] Interstitial loaded');
  });

  interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
    interstitialLoaded = false;
    if (__DEV__) console.warn('[Ads] Interstitial error:', error);
    // Retry after 30s on error
    setTimeout(loadInterstitial, 30000);
  });

  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    loadInterstitial();
  });

  interstitial.load();
}

export function showInterstitial() {
  if (interstitial && interstitialLoaded) {
    interstitial.show();
  } else if (__DEV__) {
    console.log('[Ads] Interstitial not ready yet');
  }
}
