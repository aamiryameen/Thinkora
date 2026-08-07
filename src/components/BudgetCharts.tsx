import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import type { CategoryTotal, MonthSummary } from '../types/budget';

/** Grouped income/expense bars, one pair per month. */
export function MonthlyBarChart({ data }: { data: MonthSummary[] }) {
  const { theme } = useTheme();
  const height = 150;
  const barGroupWidth = 46;
  const barWidth = 16;
  const gap = 4;
  const width = Math.max(data.length * barGroupWidth, 1);

  const max = useMemo(
    () => Math.max(1, ...data.flatMap(d => [d.income, d.expense])),
    [data],
  );

  const styles = useMemo(() => StyleSheet.create({
    wrap: { gap: theme.spacing.sm },
    legend: { flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dot: { width: 9, height: 9, borderRadius: 3 },
    legendText: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
    labels: { flexDirection: 'row' },
    label: {
      width: barGroupWidth, textAlign: 'center',
      ...theme.typography.caption, fontSize: 10, color: theme.colors.textMuted,
    },
  }), [theme]);

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height}>
        {data.map((d, i) => {
          const x = i * barGroupWidth + (barGroupWidth - barWidth * 2 - gap) / 2;
          const incomeH = Math.round((d.income / max) * (height - 8));
          const expenseH = Math.round((d.expense / max) * (height - 8));
          return (
            <G key={d.month}>
              <Rect
                x={x} y={height - incomeH}
                width={barWidth} height={incomeH}
                rx={4} fill={theme.colors.success}
              />
              <Rect
                x={x + barWidth + gap} y={height - expenseH}
                width={barWidth} height={expenseH}
                rx={4} fill={theme.colors.error}
              />
            </G>
          );
        })}
      </Svg>

      <View style={styles.labels}>
        {data.map(d => (
          <Text key={d.month} style={styles.label}>
            {d.month.slice(5)}
          </Text>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.colors.success }]} />
          <Text style={styles.legendText}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.colors.error }]} />
          <Text style={styles.legendText}>Expense</Text>
        </View>
      </View>
    </View>
  );
}

/** Builds an SVG arc path for one donut segment. */
function arcPath(cx: number, cy: number, r: number, thickness: number, from: number, to: number) {
  const inner = r - thickness;
  const start = (from - 0.25) * 2 * Math.PI;
  const end = (to - 0.25) * 2 * Math.PI;
  const large = to - from > 0.5 ? 1 : 0;

  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const x3 = cx + inner * Math.cos(end);
  const y3 = cy + inner * Math.sin(end);
  const x4 = cx + inner * Math.cos(start);
  const y4 = cy + inner * Math.sin(start);

  return [
    `M ${x1} ${y1}`,
    `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/** Donut of category shares with the month total in the middle. */
export function CategoryDonut({
  data, total, money,
}: { data: CategoryTotal[]; total: number; money: (n: number) => string }) {
  const { theme } = useTheme();
  const size = 168;
  const r = size / 2;
  const thickness = 26;

  const segments = useMemo(() => {
    let cursor = 0;
    return data
      .filter(d => d.share > 0)
      .map(d => {
        const from = cursor;
        cursor += d.share;
        return { ...d, from, to: Math.min(cursor, 1) };
      });
  }, [data]);

  const styles = useMemo(() => StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    center: { position: 'absolute', alignItems: 'center' },
    total: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
    caption: { ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted },
  }), [theme]);

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        {segments.length === 0 ? (
          <Circle
            cx={r} cy={r} r={r - thickness / 2}
            stroke={theme.colors.border} strokeWidth={thickness} fill="none"
          />
        ) : (
          segments.map(s => (
            <Path
              key={s.categoryId ?? 'none'}
              d={arcPath(r, r, r, thickness, s.from, s.to)}
              fill={s.color}
            />
          ))
        )}
      </Svg>
      <View style={styles.center}>
        <Text style={styles.total}>{money(total)}</Text>
        <Text style={styles.caption}>spent</Text>
      </View>
    </View>
  );
}

/** Horizontal progress bar used for budgets. */
export function BudgetBar({
  ratio, over, color,
}: { ratio: number; over: boolean; color: string }) {
  const { theme } = useTheme();
  const pct = Math.round(ratio * 100);

  return (
    <View style={{
      height: 8, borderRadius: 4,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    }}>
      <View style={{
        height: 8, borderRadius: 4,
        width: `${pct}%`,
        backgroundColor: over ? theme.colors.error : color,
      }} />
    </View>
  );
}
