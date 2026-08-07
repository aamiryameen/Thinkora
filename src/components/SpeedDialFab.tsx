import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Pressable, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { AD_BANNER_HEIGHT } from './AdBanner';

export interface SpeedDialAction {
  key: string;
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}

interface Props {
  actions: SpeedDialAction[];
  /** Distance from the bottom, before safe-area and ad insets are added. */
  offset?: number;
}

const FAB_SIZE = 58;
/** Halo diameter — the soft ring that makes the button feel raised. */
const GLOW_SIZE = FAB_SIZE + 34;
const ITEM_HEIGHT = 52;
/**
 * Each row's slice of the 0→1 progress.
 *
 * Rows share one animated value and read a staggered sub-range of it, so they
 * arrive one after another. Doing it with one value rather than N keeps the
 * whole fan-out on a single native animation.
 */
const ROW_WINDOW = 0.55;

/**
 * Expanding FAB. Collapsed it is a single + button with a soft glow; tapped it
 * fans out labelled rows and dims the screen behind them, so every option
 * reads as text rather than a bare icon.
 *
 * Every animated value runs on the native driver, so the fan-out never touches
 * the JS thread — it stays smooth even while a screen is doing other work.
 */
export function SpeedDialFab({ actions, offset = 24 }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  /** Drives the fan-out; the rows are only mounted while non-zero. */
  const anim = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  /** Kept separate from `open` so rows stay mounted through the close animation. */
  const [mounted, setMounted] = useState(false);
  /** Guards against a double-tap firing an action twice. */
  const runningRef = useRef(false);
  /** Drives the attention ripple; loops independently of the fan-out. */
  const ripple = useRef(new Animated.Value(0)).current;

  /**
   * Continuous ripple that draws the eye to the button.
   *
   * Paused while the menu is open — the expanding ring would fight the rows
   * for attention, and it is pointless once the user has already engaged.
   */
  useEffect(() => {
    // Also paused off-focus: tab screens stay mounted, so an unfocused screen
    // would otherwise keep compositing a ring nobody can see.
    if (open || !isFocused) {
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
        // Beat between pulses so it reads as a heartbeat rather than a churn.
        Animated.delay(400),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      ripple.setValue(0);
    };
  }, [isFocused, open, ripple]);

  // Mount the rows before animating them in. Split from the animation effect
  // because calling setMounted there re-renders and would tear down the
  // in-flight animation through its own cleanup.
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    // Nothing to animate until the rows exist.
    if (open && !mounted) return;

    // Spring on open for a natural settle; timing on close because a spring
    // closing feels sluggish and can overshoot past the button.
    const animation = open
      ? Animated.spring(anim, {
        toValue: 1,
        // Low tension with high friction: rises quickly, settles without wobble.
        tension: 58,
        friction: 11,
        useNativeDriver: true,
      })
      : Animated.timing(anim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      });

    animation.start(({ finished }) => {
      // Unmount only after the collapse finishes, or the rows would vanish
      // instantly instead of animating away.
      if (finished && !open) setMounted(false);
    });

    // No stop() here: cancelling on re-render is what killed the animation
    // mid-flight. A new timing() on the same value supersedes the old one.
  }, [anim, mounted, open]);

  const toggle = useCallback(() => setOpen(o => !o), []);
  const close = useCallback(() => setOpen(false), []);

  const run = useCallback((action: SpeedDialAction) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setOpen(false);

    // Navigate immediately rather than waiting for the close animation.
    //
    // This used to go through InteractionManager.runAfterInteractions to avoid
    // dropping frames on the close, but that put the whole 160ms close plus
    // anything else queued in front of the screen transition — the tap felt
    // unresponsive, which is far more noticeable than a few dropped frames on
    // a menu that is already sliding out of view.
    try {
      action.onPress();
    } finally {
      runningRef.current = false;
    }
  }, []);

  const bottom = insets.bottom + AD_BANNER_HEIGHT + offset;

  const styles = useMemo(() => StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
    wrap: {
      position: 'absolute',
      right: theme.spacing.lg,
      bottom,
      alignItems: 'flex-end',
      gap: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 3,
    },
    labelPill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
      ...theme.shadows.card,
    },
    labelText: {
      ...theme.typography.caption,
      fontWeight: '700',
      color: theme.colors.text,
    },
    actionBtn: {
      width: 46, height: 46, borderRadius: 23,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.fab,
    },
    // Soft halo behind the button, sized larger than the FAB itself.
    fabSlot: {
      width: GLOW_SIZE, height: GLOW_SIZE,
      alignItems: 'center', justifyContent: 'center',
      // Negative margins let the halo bleed outside the slot so the button
      // itself stays exactly where it sat before the glow was added — and the
      // label rows above keep their original alignment.
      marginRight: -(GLOW_SIZE - FAB_SIZE) / 2,
      marginBottom: -(GLOW_SIZE - FAB_SIZE) / 2,
    },
    // The expanding ring. Sized to the slot so it can grow past the glow.
    ripple: {
      position: 'absolute',
      width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2,
      backgroundColor: theme.colors.primary,
    },
    glowOuter: {
      position: 'absolute',
      width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2,
      backgroundColor: theme.colors.primary,
      opacity: 0.14,
    },
    glowInner: {
      position: 'absolute',
      width: FAB_SIZE + 16, height: FAB_SIZE + 16,
      borderRadius: (FAB_SIZE + 16) / 2,
      backgroundColor: theme.colors.primary,
      opacity: 0.2,
    },
    fab: {
      width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.fab,
    },
  }), [bottom, theme]);

  // All clamped: a spring settles by crossing 1 and coming back, which would
  // otherwise over-rotate the icon and over-darken the backdrop.
  const rotate = anim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '135deg'], extrapolate: 'clamp',
  });
  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1], outputRange: [0, 0.45], extrapolate: 'clamp',
  });
  // The halo swells slightly while open, so the button reads as active.
  const glowScale = anim.interpolate({
    inputRange: [0, 1], outputRange: [1, 1.12], extrapolate: 'clamp',
  });

  // Ripple: expands outward from the button edge while fading to nothing.
  const rippleScale = ripple.interpolate({
    // Caps at 1.35: larger and the ring reaches the screen edge, where it gets
    // visually clipped on the right.
    inputRange: [0, 1], outputRange: [0.62, 1.35],
  });
  const rippleOpacity = ripple.interpolate({
    // Fades in briefly, then out — a ring that appears at full strength and
    // vanishes abruptly looks like a glitch.
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.32, 0],
  });

  return (
    <>
      {mounted && (
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel="Close quick create menu"
          />
        </Animated.View>
      )}

      <View style={styles.wrap} pointerEvents="box-none">
        {mounted && actions.map((action, i) => {
          // Bottom row leads, so the group unfurls upward from the button.
          const order = actions.length - 1 - i;
          const step = actions.length > 1
            ? (1 - ROW_WINDOW) / (actions.length - 1)
            : 0;
          const start = order * step;
          const end = Math.min(1, start + ROW_WINDOW);

          const translateY = anim.interpolate({
            inputRange: [start, end],
            outputRange: [(order + 1) * ITEM_HEIGHT * 0.5, 0],
            // Clamp so a spring overshoot past 1 can't push rows back down.
            extrapolate: 'clamp',
          });
          const opacity = anim.interpolate({
            inputRange: [start, end],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          });
          const scale = anim.interpolate({
            inputRange: [start, end],
            outputRange: [0.88, 1],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={action.key}
              style={{ opacity, transform: [{ translateY }, { scale }] }}
              // Rows never receive touches while collapsing.
              pointerEvents={open ? 'auto' : 'none'}
            >
              <TouchableOpacity
                style={styles.row}
                onPress={() => run(action)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={styles.labelPill}>
                  <Text style={styles.labelText}>{action.label}</Text>
                </View>
                <View style={[styles.actionBtn, { backgroundColor: action.color }]}>
                  <Ionicons name={action.icon} size={21} color="#FFF" />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <View style={styles.fabSlot}>
          <Animated.View
            style={[
              styles.ripple,
              { opacity: rippleOpacity, transform: [{ scale: rippleScale }] },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.glowOuter, { transform: [{ scale: glowScale }] }]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.glowInner, { transform: [{ scale: glowScale }] }]}
            pointerEvents="none"
          />
          <TouchableOpacity
            style={styles.fab}
            onPress={toggle}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={open ? 'Close quick create menu' : 'Open quick create menu'}
            accessibilityState={{ expanded: open }}
          >
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Ionicons name="add" size={30} color="#FFF" />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
