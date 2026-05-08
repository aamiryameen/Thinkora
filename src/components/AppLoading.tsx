import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { ThinkoraLogo } from './ThinkoraLogo';

const { width, height } = Dimensions.get('window');

/**
 * Full-screen branded splash / loading screen for Thinkora.
 */
export function AppLoading() {
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Logo entrance
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Tagline fade in
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });

    // Loading dots pulse loop
    const pulseDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        ]),
      );

    Animated.parallel([
      pulseDot(dot1, 0),
      pulseDot(dot2, 200),
      pulseDot(dot3, 400),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Background decoration circles */}
      <View style={[styles.bgCircle, styles.bgCircle1]} />
      <View style={[styles.bgCircle, styles.bgCircle2]} />
      <View style={[styles.bgCircle, styles.bgCircle3]} />

      {/* Center content */}
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity }}>
          <ThinkoraLogo size={96} showName />
        </Animated.View>

        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Where your thoughts come alive
        </Animated.Text>

        {/* Loading dots */}
        <View style={styles.dotsRow}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: dot, transform: [{ scale: dot }] }]}
            />
          ))}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E1A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Background decorative circles */
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  bgCircle1: {
    width: width * 0.9,
    height: width * 0.9,
    backgroundColor: '#6366F108',
    top: -width * 0.3,
    right: -width * 0.25,
  },
  bgCircle2: {
    width: width * 0.7,
    height: width * 0.7,
    backgroundColor: '#8B5CF608',
    bottom: -width * 0.2,
    left: -width * 0.2,
  },
  bgCircle3: {
    width: 200,
    height: 200,
    backgroundColor: '#6366F110',
    top: height * 0.35,
    right: -60,
  },

  center: {
    alignItems: 'center',
    gap: 20,
  },

  tagline: {
    fontSize: 15,
    color: '#A5B4FC',
    fontWeight: '400',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 4,
  },

  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },

  version: {
    position: 'absolute',
    bottom: 32,
    fontSize: 12,
    color: '#4C4B6B',
    letterSpacing: 1,
  },
});
