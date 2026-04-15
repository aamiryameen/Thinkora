/**
 * NotioX – Note-taking app (Android)
 * @format
 */

import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds from 'react-native-google-mobile-ads';
import { loadInterstitial } from './src/services/ads';
import { restoreQuickCaptureIfEnabled } from './src/services/quickCaptureService';
import { runMigrationIfNeeded } from './src/services/migrateFromAsyncStorage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppProvider, useApp } from './src/context/AppContext';
import { FeaturesProvider } from './src/context/FeaturesContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AppLoading } from './src/components/AppLoading';
import { AppLockScreen } from './src/screens/AppLockScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';

const ONBOARDING_KEY = '@thinkora/onboarding_complete';

function AppContent() {
  const { isHydrated, settings } = useApp();
  const { isDark } = useTheme();
  const [unlocked, setUnlocked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => {
      setOnboardingDone(v === 'true');
    });
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setOnboardingDone(true);
  }, []);

  const needsLock = settings.appLockEnabled && settings.appLockPin && !unlocked;

  // Still loading onboarding state
  if (onboardingDone === null || !isHydrated) {
    return <AppLoading />;
  }

  // Show onboarding for first-time users
  if (!onboardingDone) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />
      {needsLock ? (
        <AppLockScreen correctPin={settings.appLockPin!} onUnlock={() => setUnlocked(true)} />
      ) : (
        <View style={{ flex: 1 }}>
          <AppNavigator />
        </View>
      )}
    </>
  );
}

function App() {
  useEffect(() => {
    runMigrationIfNeeded();
    mobileAds()
      .initialize()
      .then(() => loadInterstitial());
    restoreQuickCaptureIfEnabled();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" />
        <ErrorBoundary>
          <ThemeProvider>
            <AppProvider>
              <FeaturesProvider>
                <AppContent />
              </FeaturesProvider>
            </AppProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
