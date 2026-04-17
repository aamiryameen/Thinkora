import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

const IS_DEV = __DEV__;

export const AD_UNITS = {
  banner:       IS_DEV ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-7724552016512949/6264757761',
  interstitial: IS_DEV ? TestIds.INTERSTITIAL    : 'ca-app-pub-7724552016512949/4538810802',
  rewarded:     IS_DEV ? TestIds.REWARDED        : 'ca-app-pub-7724552016512949/3854216842',
  appOpen:      IS_DEV ? TestIds.APP_OPEN        : 'ca-app-pub-7724552016512949/5937454709',
};

let interstitial: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
let interstitialLoaded = false;

// Track when last interstitial was shown to avoid spamming
let lastInterstitialTime = 0;
const MIN_INTERSTITIAL_INTERVAL = 120000; // 2 minutes between interstitials

// Count user actions to show interstitial every N actions
let actionCount = 0;
const ACTIONS_BEFORE_AD = 4; // show after every 4 saves/completes

export function loadInterstitial() {
  interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
    requestNonPersonalizedAdsOnly: false,
  });

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    if (__DEV__) console.log('[Ads] Interstitial loaded');
  });

  interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
    interstitialLoaded = false;
    if (__DEV__) console.warn('[Ads] Interstitial error:', error);
    setTimeout(loadInterstitial, 30000);
  });

  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    loadInterstitial();
  });

  interstitial.load();
}

/**
 * Show interstitial ad at natural break points.
 * Respects minimum interval (2 min) and action count (every 4 actions).
 */
export function showInterstitial() {
  if (interstitial && interstitialLoaded) {
    const now = Date.now();
    if (now - lastInterstitialTime >= MIN_INTERSTITIAL_INTERVAL) {
      interstitial.show();
      lastInterstitialTime = now;
    }
  }
}

/**
 * Call this on user actions (save task, save note, complete task, etc.)
 * Shows interstitial every N actions — non-intrusive.
 */
export function trackActionForAd() {
  actionCount += 1;
  if (actionCount >= ACTIONS_BEFORE_AD) {
    actionCount = 0;
    showInterstitial();
  }
}
