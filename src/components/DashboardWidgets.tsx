import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { WATER_GOAL_GLASSES, type MoodValue } from '../services/dashboardService';

interface CardProps {
  title: string;
  icon: string;
  accent: string;
  onPress?: () => void;
  action?: string;
  children?: React.ReactNode;
}

export function WidgetCard({ title, icon, accent, onPress, action, children }: CardProps) {
  const { theme } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      ...theme.shadows.card,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    iconWrap: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: accent + '20',
      flexShrink: 0,
    },
    title: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      flex: 1,
    },
    action: {
      ...theme.typography.caption,
      fontSize: 11, color: accent, fontWeight: '700',
      flexShrink: 0,
    },
  }), [accent, theme]);

  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={17} color={accent} />
        </View>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {action ? <Text style={styles.action}>{action}</Text> : null}
      </View>
      {children}
    </Wrapper>
  );
}

export function GreetingWidget({ greeting, name, subtitle }: {
  greeting: string;
  name?: string;
  subtitle: string;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    wrap: { gap: 4, paddingHorizontal: theme.spacing.xs },
    greeting: {
      ...theme.typography.title,
      fontSize: 26, fontWeight: '800',
      color: theme.colors.text,
    },
    subtitle: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
  }), [theme]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>{greeting}{name ? `, ${name}` : ''} 👋</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const { theme } = useTheme();
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const styles = useMemo(() => StyleSheet.create({
    track: {
      height: 6, borderRadius: 3,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    fill: { height: 6, borderRadius: 3, backgroundColor: color, width: `${pct}%` },
  }), [color, pct, theme]);

  return <View style={styles.track}><View style={styles.fill} /></View>;
}

export function StatLine({ value, unit, hint }: { value: string; unit?: string; hint?: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    value: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
    // flexShrink so a long unit wraps inside the card instead of pushing past it.
    unit: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      fontWeight: '600',
      flexShrink: 1,
    },
    hint: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
  }), [theme]);

  return (
    <View style={{ gap: 2 }}>
      <View style={styles.row}>
        <Text style={styles.value} numberOfLines={1}>{value}</Text>
        {unit ? <Text style={styles.unit} numberOfLines={1}>{unit}</Text> : null}
      </View>
      {hint ? <Text style={styles.hint} numberOfLines={2}>{hint}</Text> : null}
    </View>
  );
}

export function WaterWidget({ glasses, onAdd, onRemove }: {
  glasses: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const accent = '#0EA5E9';
  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    btn: {
      width: 30, height: 30, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: accent + '18',
    },
    dots: { flexDirection: 'row', gap: 3, flex: 1, flexWrap: 'wrap' },
    dot: { width: 8, height: 14, borderRadius: 3, backgroundColor: theme.colors.border },
    dotFull: { backgroundColor: accent },
  }), [theme]);

  return (
    <WidgetCard title="Water" icon="water-outline" accent={accent}>
      <StatLine value={`${glasses}`} unit={`/ ${WATER_GOAL_GLASSES} glasses`} />
      <View style={styles.dots}>
        {Array.from({ length: WATER_GOAL_GLASSES }).map((_, i) => (
          <View key={i} style={[styles.dot, i < glasses && styles.dotFull]} />
        ))}
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={onRemove} activeOpacity={0.7}>
          <Ionicons name="remove" size={17} color={accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onAdd} activeOpacity={0.7}>
          <Ionicons name="add" size={17} color={accent} />
        </TouchableOpacity>
      </View>
    </WidgetCard>
  );
}

const MOODS: { value: MoodValue; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export function MoodWidget({ mood, onSelect }: {
  mood: MoodValue | null;
  onSelect: (m: MoodValue) => void;
}) {
  const { theme } = useTheme();
  const accent = '#EC4899';
  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', gap: 2 },
    // Each pick flexes so five always fit the card, however narrow it is.
    pick: {
      flex: 1,
      aspectRatio: 1,
      maxHeight: 36,
      borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    picked: { borderColor: accent, backgroundColor: accent + '15' },
    emoji: { fontSize: 17 },
    label: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
  }), [theme]);

  const current = MOODS.find(m => m.value === mood);

  return (
    <WidgetCard title="Mood" icon="happy-outline" accent={accent}>
      <Text style={styles.label}>{current ? current.label : 'How are you feeling?'}</Text>
      <View style={styles.row}>
        {MOODS.map(m => (
          <TouchableOpacity
            key={m.value}
            style={[styles.pick, mood === m.value && styles.picked]}
            onPress={() => onSelect(m.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{m.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </WidgetCard>
  );
}

export function EmptyHint({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text style={{
      ...theme.typography.caption,
      fontSize: 12,
      color: theme.colors.textMuted,
    }}>{text}</Text>
  );
}
