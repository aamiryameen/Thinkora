import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { AD_BANNER_HEIGHT } from './AdBanner';
import type { HomeTabParamList, RootStackParamList } from '../navigation/types';

type StackNav = NativeStackNavigationProp<RootStackParamList>;

const TAB_ICONS: Record<keyof HomeTabParamList, { focused: string; default: string; label: string }> = {
  MyDay:    { focused: 'home',          default: 'home-outline',          label: 'Home' },
  Tasks:    { focused: 'checkbox',      default: 'checkbox-outline',      label: 'Tasks' },
  ScanTab:  { focused: 'scan',          default: 'scan-outline',          label: 'Scan' },
  Notes:    { focused: 'document-text', default: 'document-text-outline', label: 'Notes' },
  Dashboard:{ focused: 'apps',          default: 'apps-outline',          label: 'More' },
};


/**
 * Custom bottom tab bar — floating pill in Thinkora purple with a raised
 * circular Capture button in the centre.
 *
 * Active tab gets a soft white pill behind it for unmistakable feedback;
 * inactive tabs use a slightly transparent white tint.
 */
export function ThinkoraTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const stackNav = useNavigation<StackNav>();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // The bar is full-width and flush to the bottom, so it needs no
        // separate backdrop behind it.
        wrap: {
          position: 'absolute',
          left: 0,
          right: 0,
          // Sits directly on top of the system nav bar.
          bottom: insets.bottom + AD_BANNER_HEIGHT,
          alignItems: 'center',
        },
        bar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.primary,
          paddingHorizontal: 10,
          paddingVertical: 8,
          minHeight: 68,
          width: '100%',
          shadowColor: theme.colors.primary,
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 16,
          elevation: 16,
        },
        tabBtn: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 6,
          paddingHorizontal: 4,
          minHeight: 52,
        },
        label: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 3,
          letterSpacing: 0.2,
        },

        // Centre Capture button — raised above the bar
        captureSlot: {
          width: 72,
          alignItems: 'center',
          justifyContent: 'center',
        },
        captureBtn: {
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#FFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 10,
          elevation: 12,
          marginTop: -32,
          borderWidth: 4,
          borderColor: theme.colors.primary,
        },
        captureLabel: {
          fontSize: 10,
          fontWeight: '700',
          color: '#FFF',
          marginTop: 4,
          letterSpacing: 0.2,
        },
      }),
    [theme, insets.bottom],
  );

  const renderRegularTab = (
    routeName: keyof HomeTabParamList,
    routeKey: string,
    isFocused: boolean,
  ) => {
    const meta = TAB_ICONS[routeName];
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: routeKey,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    };
    const tint = isFocused ? '#FFF' : 'rgba(255,255,255,0.7)';
    return (
      <Pressable
        key={routeKey}
        onPress={onPress}
        style={styles.tabBtn}
        hitSlop={6}
        android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 28 }}
      >
        <Ionicons
          name={isFocused ? meta.focused : meta.default}
          size={22}
          color={tint}
        />
        <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
      </Pressable>
    );
  };

  const renderCaptureButton = () => {
    const onPress = () => stackNav.navigate('Scan');
    return (
      <View key="capture-slot" style={styles.captureSlot}>
        <Pressable
          onPress={onPress}
          style={styles.captureBtn}
          hitSlop={10}
          android_ripple={{ color: theme.colors.primaryLight, borderless: true, radius: 36 }}
        >
          <Ionicons name="scan" size={28} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.captureLabel}>{TAB_ICONS.ScanTab.label}</Text>
      </View>
    );
  };

  return (
    <>
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.bar}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            if (route.name === 'ScanTab') {
              return renderCaptureButton();
            }
            return renderRegularTab(route.name as keyof HomeTabParamList, route.key, isFocused);
          })}
        </View>
      </View>
    </>
  );
}
