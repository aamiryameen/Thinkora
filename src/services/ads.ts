import { TestIds } from 'react-native-google-mobile-ads';
// import { AppState, AppStateStatus } from 'react-native';
// import {
//   InterstitialAd,
//   RewardedAd,
//   RewardedAdEventType,
//   AppOpenAd,
//   AdEventType,
// } from 'react-native-google-mobile-ads';

const IS_DEV = __DEV__;

export const AD_UNITS = {
  banner: IS_DEV ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-7724552016512949/6264757761',
  // interstitial: IS_DEV ? TestIds.INTERSTITIAL : 'ca-app-pub-7724552016512949/4538810802',
  // rewarded:     IS_DEV ? TestIds.REWARDED     : 'ca-app-pub-7724552016512949/3854216842',
  // appOpen:      IS_DEV ? TestIds.APP_OPEN     : 'ca-app-pub-7724552016512949/5937454709',
};

// ---------------- Interstitial (disabled) ----------------
// Showing interstitials hurts retention. Keeping the code here so it can
// be re-enabled by uncommenting and wiring loadInterstitial() in App.tsx.
//
// let interstitial: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
// let interstitialLoaded = false;
//
// let lastInterstitialTime = 0;
// const MIN_INTERSTITIAL_INTERVAL = 120000; // 2 minutes between interstitials
//
// let actionCount = 0;
// const ACTIONS_BEFORE_AD = 4; // show after every 4 saves/completes
//
// export function loadInterstitial() {
//   interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
//     requestNonPersonalizedAdsOnly: false,
//   });
//
//   interstitial.addAdEventListener(AdEventType.LOADED, () => {
//     interstitialLoaded = true;
//     if (__DEV__) console.log('[Ads] Interstitial loaded');
//   });
//
//   interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
//     interstitialLoaded = false;
//     if (__DEV__) console.warn('[Ads] Interstitial error:', error);
//     setTimeout(loadInterstitial, 30000);
//   });
//
//   interstitial.addAdEventListener(AdEventType.CLOSED, () => {
//     interstitialLoaded = false;
//     loadInterstitial();
//   });
//
//   interstitial.load();
// }
//
// export function showInterstitial() {
//   if (interstitial && interstitialLoaded) {
//     const now = Date.now();
//     if (now - lastInterstitialTime >= MIN_INTERSTITIAL_INTERVAL) {
//       interstitial.show();
//       lastInterstitialTime = now;
//     }
//   }
// }
//
// export function trackActionForAd() {
//   actionCount += 1;
//   if (actionCount >= ACTIONS_BEFORE_AD) {
//     actionCount = 0;
//     showInterstitial();
//   }
// }

// ---------------- App Open (disabled) ----------------
// Re-enable by uncommenting and calling initAppOpenAds() after MobileAds init.
//
// let appOpen: ReturnType<typeof AppOpenAd.createForAdRequest> | null = null;
// let appOpenLoaded = false;
// let appOpenLoadedAt = 0;
// let lastAppOpenShownAt = 0;
// let appOpenInitialized = false;
//
// const APP_OPEN_TTL = 4 * 60 * 60 * 1000; // ad expires after 4h per AdMob guidance
// const MIN_APP_OPEN_INTERVAL = 4 * 60 * 1000; // don't show more than once per 4 min
//
// function loadAppOpen() {
//   appOpen = AppOpenAd.createForAdRequest(AD_UNITS.appOpen, {
//     requestNonPersonalizedAdsOnly: false,
//   });
//
//   appOpen.addAdEventListener(AdEventType.LOADED, () => {
//     appOpenLoaded = true;
//     appOpenLoadedAt = Date.now();
//     if (__DEV__) console.log('[Ads] AppOpen loaded');
//   });
//
//   appOpen.addAdEventListener(AdEventType.ERROR, (error) => {
//     appOpenLoaded = false;
//     if (__DEV__) console.warn('[Ads] AppOpen error:', error);
//     setTimeout(loadAppOpen, 30000);
//   });
//
//   appOpen.addAdEventListener(AdEventType.CLOSED, () => {
//     appOpenLoaded = false;
//     loadAppOpen();
//   });
//
//   appOpen.load();
// }
//
// function isAppOpenFresh() {
//   return appOpenLoaded && Date.now() - appOpenLoadedAt < APP_OPEN_TTL;
// }
//
// function showAppOpenIfReady() {
//   if (!appOpen || !isAppOpenFresh()) return;
//   const now = Date.now();
//   if (now - lastAppOpenShownAt < MIN_APP_OPEN_INTERVAL) return;
//   lastAppOpenShownAt = now;
//   appOpen.show();
// }
//
// export function initAppOpenAds() {
//   if (appOpenInitialized) return;
//   appOpenInitialized = true;
//
//   loadAppOpen();
//
//   let lastState: AppStateStatus = AppState.currentState;
//   AppState.addEventListener('change', (next) => {
//     if (
//       (lastState === 'background' || lastState === 'inactive') &&
//       next === 'active'
//     ) {
//       showAppOpenIfReady();
//     }
//     lastState = next;
//   });
// }

// ---------------- Rewarded (disabled) ----------------
// Re-enable by uncommenting; trigger from a "Watch ad to unlock X" button.
//
// export function showRewardedAd(onReward: () => void): Promise<boolean> {
//   return new Promise((resolve) => {
//     const rewarded = RewardedAd.createForAdRequest(AD_UNITS.rewarded, {
//       requestNonPersonalizedAdsOnly: false,
//     });
//
//     let earned = false;
//     let settled = false;
//     const settle = (value: boolean) => {
//       if (settled) return;
//       settled = true;
//       resolve(value);
//     };
//
//     const loadedSub = rewarded.addAdEventListener(
//       RewardedAdEventType.LOADED,
//       () => {
//         rewarded.show();
//       },
//     );
//
//     const earnedSub = rewarded.addAdEventListener(
//       RewardedAdEventType.EARNED_REWARD,
//       () => {
//         earned = true;
//         onReward();
//       },
//     );
//
//     const closedSub = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
//       loadedSub();
//       earnedSub();
//       closedSub();
//       errorSub();
//       settle(earned);
//     });
//
//     const errorSub = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
//       if (__DEV__) console.warn('[Ads] Rewarded error:', error);
//       loadedSub();
//       earnedSub();
//       closedSub();
//       errorSub();
//       settle(false);
//     });
//
//     rewarded.load();
//   });
// }
