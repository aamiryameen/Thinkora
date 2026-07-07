import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface DayActivity {
  date: string;     // 'YYYY-MM-DD'
  count: number;    // total activity for the day
}

interface Props {
  data: DayActivity[];
  onDayPress?: (date: string, count: number) => void;
  /** Number of weeks to show. Default: 26 (~6 months). */
  weeks?: number;
  /** Hex color used at max intensity. Lower intensities are alpha-blended. */
  color?: string;
}

const DAY_LABELS = ['', 'M', '', 'W', '', 'F', ''];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL_SIZE = 14;
const CELL_GAP = 3;

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function HeatMapCalendarImpl({ data, onDayPress, weeks = 26, color }: Props) {
  const { theme } = useTheme();
  const cellColor = color ?? theme.colors.primary;

  // Build a map of YYYY-MM-DD → count
  const dataMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of data) m[d.date] = (m[d.date] ?? 0) + d.count;
    return m;
  }, [data]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const v of Object.values(dataMap)) if (v > max) max = v;
    return max;
  }, [dataMap]);

  // Build grid: each column is a week (7 days).
  // Start from N weeks ago and end with the current week (right side).
  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Roll back to Sunday of current week so the grid aligns
    const dow = today.getDay();
    const startToday = new Date(today);
    startToday.setDate(startToday.getDate() - (weeks - 1) * 7 - dow);

    const cols: { date: string; count: number; isFuture: boolean; month: number }[][] = [];
    const cursor = new Date(startToday);
    for (let w = 0; w < weeks; w++) {
      const week: { date: string; count: number; isFuture: boolean; month: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const ds = formatDate(cursor);
        const isFuture = cursor.getTime() > today.getTime();
        week.push({ date: ds, count: dataMap[ds] ?? 0, isFuture, month: cursor.getMonth() });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(week);
    }
    return cols;
  }, [dataMap, weeks]);

  function intensity(count: number): number {
    if (count === 0) return 0;
    if (maxCount === 0) return 0;
    const ratio = count / maxCount;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  function cellBg(level: number): string {
    if (level === 0) return theme.colors.inputBg;
    const alpha = 0.25 + level * 0.18; // 0.25..0.97
    // Build rgba from hex
    const m = cellColor.match(/^#([0-9a-f]{6})$/i);
    if (!m) return cellColor;
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }

  // Month label per column (only when month changes)
  const monthLabels = useMemo(() => {
    const labels: (string | null)[] = grid.map((week, i) => {
      const monthChanges = i === 0 || week[0].month !== grid[i - 1][0].month;
      return monthChanges ? MONTH_LABELS[week[0].month] : null;
    });
    return labels;
  }, [grid]);

  const styles = StyleSheet.create({
    wrap: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    title: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
    sub: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 14 },
    monthRow: { flexDirection: 'row', marginLeft: 14, marginBottom: 4 },
    monthLabel: { fontSize: 9, fontWeight: '700', color: theme.colors.textMuted, width: CELL_SIZE + CELL_GAP, textAlign: 'left' },
    body: { flexDirection: 'row' },
    dayLabels: { width: 14, justifyContent: 'space-between', marginRight: 4 },
    dayLabel: { fontSize: 9, color: theme.colors.textMuted, height: CELL_SIZE, lineHeight: CELL_SIZE },
    grid: { flexDirection: 'row' },
    column: { marginRight: CELL_GAP },
    cell: {
      width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, marginBottom: CELL_GAP,
    },
    legend: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      marginTop: 12, justifyContent: 'flex-end',
    },
    legendText: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '600' },
    legendCell: { width: 10, height: 10, borderRadius: 2 },
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Activity Heat Map</Text>
      <Text style={styles.sub}>Last {weeks} weeks · {Object.values(dataMap).filter(v => v > 0).length} active days</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Month labels */}
          <View style={styles.monthRow}>
            {monthLabels.map((label, i) => (
              <Text key={i} style={[styles.monthLabel, { width: CELL_SIZE + CELL_GAP }]}>{label ?? ''}</Text>
            ))}
          </View>

          <View style={styles.body}>
            <View style={styles.dayLabels}>
              {DAY_LABELS.map((l, i) => (
                <Text key={i} style={styles.dayLabel}>{l}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {grid.map((week, w) => (
                <View key={w} style={styles.column}>
                  {week.map((day) => {
                    const level = intensity(day.count);
                    return (
                      <TouchableOpacity
                        key={day.date}
                        activeOpacity={0.7}
                        onPress={() => !day.isFuture && onDayPress?.(day.date, day.count)}
                      >
                        <View
                          style={[
                            styles.cell,
                            { backgroundColor: day.isFuture ? 'transparent' : cellBg(level) },
                            day.isFuture && { borderWidth: 0 },
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        {[0, 1, 2, 3, 4].map(l => (
          <View key={l} style={[styles.legendCell, { backgroundColor: cellBg(l) }]} />
        ))}
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

export const HeatMapCalendar = React.memo(HeatMapCalendarImpl);
