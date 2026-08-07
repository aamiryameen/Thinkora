/**
 * Animated weather decorations for the WeatherCard background.
 *
 * Built from plain Views and the Animated API rather than SVG or a gradient
 * library, so this adds no native dependency. Every layer is absolutely
 * positioned, non-interactive, and low-opacity — the card's text must stay
 * readable, so decorations sit behind content and never compete with it.
 *
 * All animations use `useNativeDriver` and run on transform/opacity only, which
 * keeps them off the JS thread. Each decoration stops itself on unmount.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { WeatherThemeStyle } from '../services/weatherService';

/** Deterministic pseudo-random so drop/star layout is stable across renders. */
function seeded(index: number, salt: number): number {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ─── Gradient ─────────────────────────────────────────────────────────────────

/** Number of interpolated bands. 24 is smooth at this card height. */
const GRADIENT_BANDS = 24;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Renders a vertical gradient as a stack of opaque bands.
 *
 * React Native has no native gradient and the project has no gradient library,
 * so colours are interpolated in JS across N flex-weighted rows. At 24 bands
 * over a ~150px card each band is ~6px, which the eye reads as continuous.
 * Bands are opaque, so the host surface never bleeds through and muddies the
 * palette — the flaw in the previous translucent-overlay approach.
 */
export function WeatherGradient({ colors }: { colors: string[] }) {
  const bands = useMemo(() => {
    if (colors.length < 2) return [colors[0] ?? '#000'];
    const stops = colors.map(hexToRgb);
    const out: string[] = [];
    for (let i = 0; i < GRADIENT_BANDS; i++) {
      // Position across the whole ramp, then which pair of stops it falls between.
      const t = (i / (GRADIENT_BANDS - 1)) * (stops.length - 1);
      const idx = Math.min(Math.floor(t), stops.length - 2);
      const frac = t - idx;
      const [r1, g1, b1] = stops[idx];
      const [r2, g2, b2] = stops[idx + 1];
      const r = Math.round(r1 + (r2 - r1) * frac);
      const g = Math.round(g1 + (g2 - g1) * frac);
      const b = Math.round(b1 + (b2 - b1) * frac);
      out.push(`rgb(${r},${g},${b})`);
    }
    return out;
  }, [colors]);

  return (
    <View style={styles.fill} pointerEvents="none">
      {bands.map((color, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: color }} />
      ))}
    </View>
  );
}

// ─── Rain ─────────────────────────────────────────────────────────────────────

const RAIN_DROPS = 22;

function Rain({ heavy }: { heavy?: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: heavy ? 750 : 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, heavy]);

  // Precompute each drop's lane and phase once; re-randomising per frame would
  // make the rain jitter sideways instead of falling.
  const drops = useMemo(
    () =>
      Array.from({ length: RAIN_DROPS }, (_, i) => ({
        left: `${seeded(i, 1) * 100}%`,
        delay: seeded(i, 2),
        length: 14 + seeded(i, 3) * 16,
        opacity: 0.30 + seeded(i, 4) * 0.38,
      })),
    [],
  );

  return (
    <View style={styles.fill} pointerEvents="none">
      {drops.map((drop, i) => {
        // Offset each drop's phase so they don't fall in lockstep.
        const shifted = Animated.add(progress, new Animated.Value(drop.delay));
        const translateY = shifted.interpolate({
          inputRange: [0, 2],
          outputRange: [-24, 200],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.drop,
              {
                left: drop.left as any,
                height: drop.length,
                opacity: drop.opacity,
                transform: [{ translateY }, { rotate: '12deg' }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ─── Snow ─────────────────────────────────────────────────────────────────────

const SNOW_FLAKES = 16;

function Snow() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const flakes = useMemo(
    () =>
      Array.from({ length: SNOW_FLAKES }, (_, i) => ({
        left: `${seeded(i, 5) * 100}%`,
        delay: seeded(i, 6),
        size: 3 + seeded(i, 7) * 3,
        drift: (seeded(i, 8) - 0.5) * 26,
        opacity: 0.35 + seeded(i, 9) * 0.4,
      })),
    [],
  );

  return (
    <View style={styles.fill} pointerEvents="none">
      {flakes.map((flake, i) => {
        const shifted = Animated.add(progress, new Animated.Value(flake.delay));
        const translateY = shifted.interpolate({
          inputRange: [0, 2],
          outputRange: [-14, 190],
        });
        // Gentle side-to-side sway so flakes drift rather than drop straight.
        const translateX = shifted.interpolate({
          inputRange: [0, 0.5, 1, 1.5, 2],
          outputRange: [0, flake.drift, 0, -flake.drift, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.flake,
              {
                left: flake.left as any,
                width: flake.size,
                height: flake.size,
                borderRadius: flake.size / 2,
                opacity: flake.opacity,
                transform: [{ translateY }, { translateX }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ─── Drifting clouds ──────────────────────────────────────────────────────────

function Clouds({ tint }: { tint: string }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 26000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const puffs = useMemo(
    () => [
      { top: 2, size: 96, opacity: 0.26, offset: 0 },
      { top: 30, size: 68, opacity: 0.20, offset: 0.35 },
      { top: -6, size: 118, opacity: 0.15, offset: 0.7 },
      { top: 44, size: 82, opacity: 0.13, offset: 1.15 },
    ],
    [],
  );

  return (
    <View style={styles.fill} pointerEvents="none">
      {puffs.map((puff, i) => {
        const shifted = Animated.add(drift, new Animated.Value(puff.offset));
        // Travel well past both edges so clouds enter and leave off-screen.
        const translateX = shifted.interpolate({
          inputRange: [0, 2],
          outputRange: [-110, 420],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: puff.top,
              width: puff.size,
              height: puff.size * 0.52,
              borderRadius: puff.size,
              backgroundColor: tint,
              opacity: puff.opacity,
              transform: [{ translateX }],
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────

const STAR_COUNT = 22;

function Stars() {
  const twinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [twinkle]);

  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        left: `${seeded(i, 11) * 100}%`,
        top: `${seeded(i, 12) * 78}%`,
        size: 1.5 + seeded(i, 13) * 2,
        base: 0.25 + seeded(i, 14) * 0.5,
        // Alternate phase so half the field brightens as the other half dims.
        phase: i % 2 === 0,
      })),
    [],
  );

  return (
    <View style={styles.fill} pointerEvents="none">
      {stars.map((star, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: star.left as any,
            top: star.top as any,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#FFFFFF',
            opacity: twinkle.interpolate({
              inputRange: [0, 1],
              outputRange: star.phase
                ? [star.base, star.base + 0.4]
                : [star.base + 0.4, star.base],
            }),
          }}
        />
      ))}
    </View>
  );
}

// ─── Sun beams ────────────────────────────────────────────────────────────────

/**
 * Concentric soft rings radiating from a corner — the signature decoration in
 * the reference cards' sunny/clear variants. Reads as a light source at a short
 * card height, where a small centred glow would just look like a smudge.
 */
function Rings({ tint, corner }: { tint: string; corner: 'top-right' | 'bottom-right' }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Three nested discs, largest at the back — the layered falloff is what
  // creates the banded look rather than a plain radial blur.
  // Opacities raised from 0.10/0.13/0.20: at those values the outer rings
  // shifted the scrimmed background by only ~12/255, which is below the
  // threshold where the eye registers a shape at all.
  const rings = [
    { size: 240, opacity: 0.20 },
    { size: 170, opacity: 0.26 },
    { size: 106, opacity: 0.34 },
  ];
  const anchor =
    corner === 'top-right'
      ? { top: -96, right: -74 }
      : { bottom: -104, right: -66 };

  return (
    <View style={styles.fill} pointerEvents="none">
      {rings.map((ring, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            ...anchor,
            // Centre each disc on the same anchor point.
            marginTop: corner === 'top-right' ? (230 - ring.size) / 2 : undefined,
            marginBottom: corner === 'bottom-right' ? (230 - ring.size) / 2 : undefined,
            marginRight: (230 - ring.size) / 2,
            width: ring.size,
            height: ring.size,
            borderRadius: ring.size / 2,
            backgroundColor: tint,
            opacity: ring.opacity,
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  // Stagger so the rings breathe out of phase.
                  outputRange: [1, 1.06 + i * 0.02],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

/**
 * Soft overlapping waves along the bottom — the reference's cloudy/snow
 * treatment. Drifts slowly so the card feels alive without drawing the eye.
 */
function Waves({ tint }: { tint: string }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const bands = [
    { bottom: -58, size: 300, opacity: 0.12, phase: 0 },
    { bottom: -74, size: 340, opacity: 0.09, phase: 0.5 },
  ];

  return (
    <View style={styles.fill} pointerEvents="none">
      {bands.map((band, i) => {
        const shifted = Animated.add(drift, new Animated.Value(band.phase));
        const translateX = shifted.interpolate({
          inputRange: [0, 2],
          outputRange: [-60, 60],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              bottom: band.bottom,
              left: -40,
              width: band.size,
              height: band.size * 0.55,
              // A very large border radius on a wide, short box gives a soft
              // wave crest without needing SVG paths.
              borderTopLeftRadius: band.size,
              borderTopRightRadius: band.size,
              backgroundColor: tint,
              opacity: band.opacity,
              transform: [{ translateX }],
            }}
          />
        );
      })}
    </View>
  );
}

function Sunbeam({ tint }: { tint: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.5] });

  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          top: -46, right: -34,
          width: 140, height: 140,
          borderRadius: 70,
          backgroundColor: tint,
          opacity,
          transform: [{ scale }],
        }}
      />
    </View>
  );
}

// ─── Lightning ────────────────────────────────────────────────────────────────

function Lightning({ tint }: { tint: string }) {
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // A double-blink then a long pause reads as a distant storm; a steady
    // pulse would look like a UI glitch.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.1, duration: 130, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.75, duration: 70, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flash]);

  return (
    <View style={styles.fill} pointerEvents="none">
      {/* Rain behind the flash — a storm without rain looks unfinished. */}
      <Rain heavy />

      {/* Two layers per strike: a bright localised bloom at the top-left where
          the bolt would be, plus a weaker full-card wash. A single flat wash
          reads as the screen blinking rather than lightning somewhere. */}
      <Animated.View
        style={{
          position: 'absolute',
          top: -70, left: -50,
          width: 210, height: 210,
          borderRadius: 105,
          backgroundColor: tint,
          opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
        }}
      />
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: tint,
            opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }),
          },
        ]}
      />
    </View>
  );
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Renders the decoration layer for a theme. Returns null for `none` so the
 * card pays no render cost when there is nothing to draw.
 */
export function WeatherDecor({ theme }: { theme: WeatherThemeStyle }) {
  switch (theme.decoration) {
    case 'rain':
      // Rings behind the rain give the depth the reference's heavy-rain card
      // has — streaks alone on a flat colour look sparse.
      return (
        <>
          <Rings tint={theme.glowColorAlt} corner="top-right" />
          <Rain />
        </>
      );
    case 'snow':
      return (
        <>
          <Waves tint={theme.glowColorAlt} />
          <Snow />
        </>
      );
    case 'clouds':
      return (
        <>
          <Waves tint={theme.glowColor} />
          <Clouds tint={theme.glowColor} />
        </>
      );
    case 'night-clouds':
      // Stars behind, cloud in front — the cloud passing over the starfield is
      // what makes it read as night rather than a dim afternoon.
      return (
        <>
          <Stars />
          <Clouds tint={theme.glowColorAlt} />
        </>
      );
    case 'stars':
      return (
        <>
          <Rings tint={theme.glowColorAlt} corner="top-right" />
          <Stars />
        </>
      );
    case 'sunbeam':
      return (
        <>
          <Rings tint={theme.glowColor} corner="top-right" />
          <Sunbeam tint={theme.glowColorAlt} />
        </>
      );
    case 'lightning':
      return (
        <>
          <Rings tint={theme.glowColorAlt} corner="top-right" />
          <Lightning tint={theme.glowColor} />
        </>
      );
    case 'none':
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  drop: {
    position: 'absolute',
    width: 1.8,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  flake: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});
