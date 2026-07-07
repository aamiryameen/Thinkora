import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  taskDots: Map<string, string[]>; // "YYYY-MM-DD" -> array of category colors
  firstDayOfWeek?: 0 | 1;
}

const DAY_LABELS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function CalendarGridImpl({ selectedDate, onSelectDate, onMonthChange, taskDots, firstDayOfWeek = 0 }: Props) {
  const { theme } = useTheme();
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const dayLabels = firstDayOfWeek === 1 ? DAY_LABELS_MON : DAY_LABELS_SUN;

  const { cells, monthLabel } = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDay = new Date(year, month, 1).getDay();
    if (firstDayOfWeek === 1) startDay = (startDay + 6) % 7;

    const cells: { day: number; inMonth: boolean; date: Date }[] = [];

    // Previous month fill
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      cells.push({ day: d, inMonth: false, date: new Date(year, month - 1, d) });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
    }
    // Next month fill
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, inMonth: false, date: new Date(year, month + 1, d) });
    }

    const monthLabel = new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    return { cells, monthLabel };
  }, [year, month, firstDayOfWeek]);

  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedKey = dateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());

  const goMonth = (dir: -1 | 1) => {
    const next = new Date(year, month + dir, 1);
    onMonthChange(next);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    monthLabel: {
      ...theme.typography.titleSmall,
      color: theme.colors.text,
    },
    navBtn: {
      padding: theme.spacing.xs,
    },
    navRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    dayLabelRow: {
      flexDirection: 'row',
      marginBottom: theme.spacing.sm,
    },
    dayLabel: {
      flex: 1,
      textAlign: 'center',
      ...theme.typography.caption,
      color: theme.colors.textMuted,
      fontWeight: '600',
    },
    weekRow: {
      flexDirection: 'row',
    },
    dayCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: theme.spacing.xs,
      marginVertical: 1,
    },
    dayNum: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayText: {
      ...theme.typography.bodySmall,
      color: theme.colors.text,
      fontWeight: '500',
    },
    dayTextOutside: {
      color: theme.colors.textDisabled,
    },
    dayToday: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    daySelected: {
      backgroundColor: theme.colors.primary,
    },
    dayTextSelected: {
      color: '#FFF',
      fontWeight: '700',
    },
    dotsRow: {
      flexDirection: 'row',
      marginTop: 2,
      gap: 2,
      height: 6,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
  }), [theme]);

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navBtn} onPress={() => goMonth(-1)}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={() => goMonth(1)}>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dayLabelRow}>
        {dayLabels.map((l) => (
          <Text key={l} style={styles.dayLabel}>{l}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell, ci) => {
            const key = dateKey(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate());
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const dots = taskDots.get(key) ?? [];

            return (
              <TouchableOpacity
                key={ci}
                style={styles.dayCell}
                onPress={() => onSelectDate(cell.date)}
                activeOpacity={0.6}
              >
                <View style={[
                  styles.dayNum,
                  isToday && !isSelected && styles.dayToday,
                  isSelected && styles.daySelected,
                ]}>
                  <Text style={[
                    styles.dayText,
                    !cell.inMonth && styles.dayTextOutside,
                    isSelected && styles.dayTextSelected,
                  ]}>
                    {cell.day}
                  </Text>
                </View>
                <View style={styles.dotsRow}>
                  {dots.slice(0, 3).map((color, di) => (
                    <View key={di} style={[styles.dot, { backgroundColor: color }]} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export const CalendarGrid = React.memo(CalendarGridImpl);
