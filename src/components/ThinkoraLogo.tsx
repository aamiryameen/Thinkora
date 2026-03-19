import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ThinkoraLogoProps {
  size?: number;
  showName?: boolean;
  dark?: boolean;
}

export function ThinkoraLogo({ size = 72, showName = false, dark = false }: ThinkoraLogoProps) {
  const iconBg = size;
  const iconRadius = iconBg * 0.28;
  const iconSize = size * 0.52;

  return (
    <View style={styles.wrap}>
      {/* Outer glow ring */}
      <View style={[styles.glowRing, {
        width: iconBg + 20,
        height: iconBg + 20,
        borderRadius: iconRadius + 8,
        backgroundColor: '#6366F120',
      }]}>
        {/* Inner gradient-like layered background */}
        <View style={[styles.iconBg, {
          width: iconBg,
          height: iconBg,
          borderRadius: iconRadius,
          backgroundColor: '#6366F1',
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 20,
          elevation: 16,
        }]}>
          {/* Top-left shimmer overlay */}
          <View style={[styles.shimmer, { borderRadius: iconRadius }]} />
          <Ionicons name="bulb-outline" size={iconSize} color="#FFFFFF" />
        </View>
      </View>

      {showName && (
        <View style={styles.nameRow}>
          <Text style={[styles.nameThink, { fontSize: size * 0.38, color: dark ? '#1E1B4B' : '#6366F1' }]}>
            Think
          </Text>
          <Text style={[styles.nameOra, { fontSize: size * 0.38, color: dark ? '#4C1D95' : '#8B5CF6' }]}>
            ora
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 14,
  },
  glowRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBg: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  nameThink: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  nameOra: {
    fontWeight: '400',
    letterSpacing: -0.5,
  },
});
