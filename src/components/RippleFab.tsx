import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated, Easing, StyleSheet, TouchableOpacity, View, type ViewStyle,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
  /**
   * Where the button sits. Only position keys are read — passing width or
   * background here would fight the slot's own sizing and clip the ripple.
   */
  position?: Pick<ViewStyle, 'right' | 'left' | 'bottom' | 'top'>;
  size?: number;
  /** Defaults to the theme primary. */
  color?: string;
  iconSize?: number;
  /** Set false to hold the ripple still, e.g. while a sheet is open. */
  animate?: boolean;
}

const GLOW_PAD = 34;
/**
 * Extra room reserved so the ripple's full 1.35x expansion stays on screen.
 * Without it the ring is visibly clipped against the right edge.
 */
const RIPPLE_HEADROOM = 14;

/**
 * Floating action button with a Material-style attention ripple: a
 * semi-transparent ring that expands outward and fades, looping every ~2s.
 *
 * Shared rather than copied per screen so the timing and colours stay
 * consistent, and so there is one place to tune them.
 */
export function RippleFab({
  icon, onPress, accessibilityLabel, position, size = 58,
  color, iconSize = 28, animate = true,
}: Props) {
  const { theme } = useTheme();
  const accent = color ?? theme.colors.primary;
  const glowSize = size + GLOW_PAD;

  const ripple = useRef(new Animated.Value(0)).current;

  // Tab screens stay mounted when you switch away, so without this every
  // screen's ripple keeps looping off-screen — several ring animations
  // compositing forever for something nobody can see.
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!animate || !isFocused) {
      ripple.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ripple, {
          toValue: 1,
          duration: 1600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // A beat between pulses reads as a heartbeat rather than a churn.
        Animated.delay(400),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      ripple.setValue(0);
    };
  }, [animate, isFocused, ripple]);

  const rippleScale = ripple.interpolate({
    // Capped so the ring never reaches the screen edge and gets clipped.
    inputRange: [0, 1], outputRange: [0.62, 1.35],
  });
  const rippleOpacity = ripple.interpolate({
    // Fades in briefly then out; appearing at full strength looks like a glitch.
    inputRange: [0, 0.15, 1], outputRange: [0, 0.32, 0],
  });

  const styles = useMemo(() => StyleSheet.create({
    slot: {
      position: 'absolute',
      width: glowSize, height: glowSize,
      alignItems: 'center', justifyContent: 'center',
    },
    ripple: {
      position: 'absolute',
      width: glowSize, height: glowSize, borderRadius: glowSize / 2,
      backgroundColor: accent,
    },
    glow: {
      position: 'absolute',
      width: size + 16, height: size + 16, borderRadius: (size + 16) / 2,
      backgroundColor: accent,
      opacity: 0.18,
    },
    button: {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: accent,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.fab,
    },
  }), [accent, glowSize, size, theme.shadows.fab]);

  // Shift the slot so the button centre — not the slot edge — sits at the
  // requested offset, while keeping the ripple clear of the screen edge.
  const overhang = GLOW_PAD / 2 - RIPPLE_HEADROOM;
  const placement: ViewStyle = {};
  if (position?.right !== undefined && typeof position.right === 'number') {
    placement.right = position.right - overhang;
  }
  if (position?.left !== undefined && typeof position.left === 'number') {
    placement.left = position.left - overhang;
  }
  if (position?.bottom !== undefined && typeof position.bottom === 'number') {
    placement.bottom = position.bottom - overhang;
  }
  if (position?.top !== undefined && typeof position.top === 'number') {
    placement.top = position.top - overhang;
  }

  return (
    <View style={[styles.slot, placement]} pointerEvents="box-none">
      <Animated.View
        style={[styles.ripple, {
          opacity: rippleOpacity,
          transform: [{ scale: rippleScale }],
        }]}
        pointerEvents="none"
      />
      <View style={styles.glow} pointerEvents="none" />
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name={icon} size={iconSize} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}
