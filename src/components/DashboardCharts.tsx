import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { TaskCategory } from '../types';

// ─── Donut Chart (horizontal stacked bar + legend) ───

interface DonutProps {
  data: { category: TaskCategory; count: number }[];
  uncategorizedCount: number;
}

export function CategoryDonut({ data, uncategorizedCount }: DonutProps) {
  const { theme } = useTheme();
  const total = data.reduce((s, d) => s + d.count, 0) + uncategorizedCount;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    barContainer: {
      width: '100%',
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.inputBg,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    segment: {
      height: '100%',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.md,
      justifyContent: 'center',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    legendCount: {
      ...theme.typography.caption,
      fontWeight: '700',
      color: theme.colors.text,
    },
    totalText: {
      ...theme.typography.title,
      color: theme.colors.text,
      fontWeight: '700',
    },
    totalLabel: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    totalRow: {
      alignItems: 'center',
    },
  }), [theme]);

  if (total === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>0</Text>
          <Text style={styles.totalLabel}>Open Tasks</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.totalRow}>
        <Text style={styles.totalText}>{total}</Text>
        <Text style={styles.totalLabel}>Open Tasks</Text>
      </View>

      <View style={styles.barContainer}>
        {data.map((d) => (
          d.count > 0 ? (
            <View
              key={d.category.id}
              style={[styles.segment, { flex: d.count, backgroundColor: d.category.color }]}
            />
          ) : null
        ))}
        {uncategorizedCount > 0 && (
          <View style={[styles.segment, { flex: uncategorizedCount, backgroundColor: theme.colors.textMuted }]} />
        )}
      </View>

      <View style={styles.legend}>
        {data.map((d) => (
          <View key={d.category.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: d.category.color }]} />
            <Text style={styles.legendText}>{d.category.name}</Text>
            <Text style={styles.legendCount}>{d.count}</Text>
          </View>
        ))}
        {uncategorizedCount > 0 && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.colors.textMuted }]} />
            <Text style={styles.legendText}>Other</Text>
            <Text style={styles.legendCount}>{uncategorizedCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Weekly Bar Chart ────────────────────────────────

interface BarChartProps {
  data: number[]; // 7 values for each day
  labels: string[]; // 7 day labels
}

export function WeeklyBarChart({ data, labels }: BarChartProps) {
  const { theme } = useTheme();
  const max = Math.max(...data, 1);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: theme.spacing.sm,
      height: 120,
      paddingTop: theme.spacing.md,
    },
    barWrapper: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      height: '100%',
    },
    bar: {
      width: '70%',
      borderRadius: 6,
      backgroundColor: theme.colors.primary,
      minHeight: 4,
    },
    barEmpty: {
      backgroundColor: theme.colors.inputBg,
    },
    label: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xs,
      textAlign: 'center',
      fontSize: 11,
    },
    count: {
      ...theme.typography.caption,
      color: theme.colors.text,
      fontWeight: '600',
      marginBottom: 4,
      fontSize: 11,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      {data.map((val, i) => {
        const height = max > 0 ? (val / max) * 80 : 4;
        return (
          <View key={i} style={styles.barWrapper}>
            {val > 0 && <Text style={styles.count}>{val}</Text>}
            <View style={[styles.bar, { height }, val === 0 && styles.barEmpty]} />
            <Text style={styles.label}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}
