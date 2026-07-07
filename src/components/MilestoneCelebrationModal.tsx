import React, { useEffect, useMemo, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  milestone: number;
  onClose: () => void;
}

interface Confetti {
  left: string;
  delay: number;
  duration: number;
  color: string;
  rotate: string;
}

const CONFETTI_COLORS = ['#FF9500', '#3B82F6', '#10B981', '#EC4899', '#F59E0B', '#8B5CF6'];

function buildConfetti(count: number): Confetti[] {
  const out: Confetti[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 600,
      duration: 1800 + Math.random() * 1200,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: `${Math.floor(Math.random() * 360)}deg`,
    });
  }
  return out;
}

function milestoneCopy(days: number): { title: string; sub: string; emoji: string } {
  if (days >= 365) return { title: 'Legendary!', sub: 'A full year of showing up.', emoji: '🏆' };
  if (days >= 200) return { title: 'Unstoppable!', sub: '200 days. You are built different.', emoji: '🚀' };
  if (days >= 150) return { title: 'Powerhouse!', sub: '150 days strong.', emoji: '💎' };
  if (days >= 100) return { title: 'Centurion!', sub: '100 days. A real habit now.', emoji: '💯' };
  if (days >= 75)  return { title: 'On Fire!', sub: 'Three quarters to 100.', emoji: '🔥' };
  if (days >= 50)  return { title: 'Half a hundred!', sub: '50 days of progress.', emoji: '⭐' };
  if (days >= 30)  return { title: 'A full month!', sub: 'You did it 30 days in a row.', emoji: '🌟' };
  if (days >= 21)  return { title: '21 days!', sub: "They say that's how habits form.", emoji: '✨' };
  if (days >= 14)  return { title: 'Two weeks!', sub: 'Consistency is showing.', emoji: '💪' };
  if (days >= 7)   return { title: 'One week!', sub: 'A streak is born.', emoji: '🎉' };
  if (days >= 3)   return { title: 'Three in a row!', sub: 'The hard part is starting.', emoji: '🌱' };
  return { title: `${days} days!`, sub: 'Keep going.', emoji: '🎉' };
}

export function MilestoneCelebrationModal({ visible, milestone, onClose }: Props) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const confetti = useMemo(() => buildConfetti(28), []);

  useEffect(() => {
    if (!visible) {
      scale.setValue(0.6);
      opacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible, scale, opacity]);

  const copy = milestoneCopy(milestone);

  const styles = useMemo(() => StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      overflow: 'hidden',
    },
    confettiLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
    confettiPiece: {
      position: 'absolute',
      top: -20,
      width: 10,
      height: 14,
      borderRadius: 2,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.colors.cardBg,
      borderRadius: 24,
      padding: 28,
      alignItems: 'center',
      ...theme.shadows.fab,
    },
    emoji: { fontSize: 64, marginBottom: 8 },
    daysCircle: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: '#FF950018',
      borderWidth: 3,
      borderColor: '#FF9500',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 16,
    },
    daysNumber: { fontSize: 36, fontWeight: '900', color: '#FF9500', lineHeight: 40 },
    daysLabel: { fontSize: 11, fontWeight: '700', color: '#FF9500', letterSpacing: 1 },
    title: { fontSize: 26, fontWeight: '900', color: theme.colors.text, textAlign: 'center', marginBottom: 6 },
    sub: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    cta: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ctaText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
    closeIcon: {
      position: 'absolute',
      top: 12, right: 12,
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.inputBg,
    },
  }), [theme]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        {/* Confetti rain */}
        <View style={styles.confettiLayer} pointerEvents="none">
          {confetti.map((c, i) => (
            <ConfettiPiece key={i} cfg={c} active={visible} style={styles.confettiPiece} />
          ))}
        </View>

        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeIcon} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.emoji}>{copy.emoji}</Text>
          <View style={styles.daysCircle}>
            <Text style={styles.daysNumber}>{milestone}</Text>
            <Text style={styles.daysLabel}>DAYS</Text>
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.sub}>{copy.sub}</Text>

          <TouchableOpacity style={styles.cta} onPress={onClose} activeOpacity={0.85}>
            <Ionicons name="flame" size={18} color="#FFF" />
            <Text style={styles.ctaText}>Keep Going</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface ConfettiPieceProps {
  cfg: Confetti;
  active: boolean;
  style: any;
}

function ConfettiPiece({ cfg, active, style }: ConfettiPieceProps) {
  const fall = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      fall.setValue(0);
      return;
    }
    Animated.loop(
      Animated.timing(fall, {
        toValue: 1,
        duration: cfg.duration,
        delay: cfg.delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [active, fall, cfg.duration, cfg.delay]);

  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [0, 800] });
  const translateX = fall.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 20, -20] });

  return (
    <Animated.View
      style={[
        style,
        {
          left: cfg.left as any,
          backgroundColor: cfg.color,
          transform: [{ translateY }, { translateX }, { rotate: cfg.rotate }],
        },
      ]}
    />
  );
}
