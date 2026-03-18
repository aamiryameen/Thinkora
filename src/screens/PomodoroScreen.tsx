import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useFeatures } from '../context/FeaturesContext';

type TimerState = 'idle' | 'running' | 'paused';
type SessionType = 'work' | 'break';

export function PomodoroScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useApp();
  const { addPomodoroSession, pomodoroSessions } = useFeatures();
  const pom = settings.pomodoroSettings;

  const [sessionType, setSessionType] = useState<SessionType>('work');
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [secondsLeft, setSecondsLeft] = useState(pom.workMinutes * 60);
  const [sessionCount, setSessionCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = sessionType === 'work' ? pom.workMinutes * 60 : (sessionCount > 0 && sessionCount % pom.sessionsBeforeLongBreak === 0 ? pom.longBreakMinutes : pom.shortBreakMinutes) * 60;

  const clearTimer = () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (timerState === 'running') {
      clearTimer();
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearTimer();
            Vibration.vibrate(500);
            // Session completed
            if (sessionType === 'work') {
              addPomodoroSession({ taskId: null, duration: pom.workMinutes, completedAt: Date.now(), type: 'work' });
              setSessionCount((c) => c + 1);
            }
            const nextType: SessionType = sessionType === 'work' ? 'break' : 'work';
            setSessionType(nextType);
            setTimerState('idle');
            const nextDuration = nextType === 'work' ? pom.workMinutes * 60 : (sessionCount > 0 && (sessionCount + 1) % pom.sessionsBeforeLongBreak === 0 ? pom.longBreakMinutes : pom.shortBreakMinutes) * 60;
            return nextDuration;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return clearTimer;
  }, [timerState, sessionType]);

  const startTimer = () => {
    if (timerState === 'idle') setSecondsLeft(totalSeconds);
    setTimerState('running');
  };
  const pauseTimer = () => setTimerState('paused');
  const resetTimer = () => { clearTimer(); setTimerState('idle'); setSecondsLeft(totalSeconds); };

  const progress = 1 - secondsLeft / totalSeconds;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const todaySessions = useMemo(() => {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    return pomodoroSessions.filter((s) => s.completedAt >= dayStart.getTime() && s.type === 'work').length;
  }, [pomodoroSessions]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    title: { ...theme.typography.title, color: theme.colors.text, fontSize: 26, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
    timerRing: { width: 260, height: 260, borderRadius: 130, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
    timerText: { fontSize: 56, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] },
    sessionLabel: { ...theme.typography.titleSmall, color: theme.colors.textSecondary, marginTop: theme.spacing.xs, textTransform: 'uppercase', letterSpacing: 2 },
    btnRow: { flexDirection: 'row', gap: theme.spacing.lg, marginTop: theme.spacing.xxl },
    btn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    statsRow: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xxl },
    statCard: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, alignItems: 'center', flex: 1, ...theme.shadows.card },
    statNum: { ...theme.typography.title, color: theme.colors.text, fontWeight: '800' },
    statLabel: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  }), [theme, insets]);

  const ringColor = sessionType === 'work' ? theme.colors.primary : theme.colors.success;
  const ringBg = sessionType === 'work' ? theme.colors.primaryLight : theme.colors.successLight;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Focus Timer</Text>
        </View>
      </View>
      <View style={styles.center}>
        <View style={[styles.timerRing, { borderColor: ringColor, backgroundColor: ringBg }]}>
          <Text style={styles.timerText}>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</Text>
          <Text style={styles.sessionLabel}>{sessionType === 'work' ? 'Focus' : 'Break'}</Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: theme.colors.inputBg }]} onPress={resetTimer}>
            <Ionicons name="refresh-outline" size={28} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          {timerState === 'running' ? (
            <TouchableOpacity style={[styles.btn, { backgroundColor: theme.colors.accent }]} onPress={pauseTimer}>
              <Ionicons name="pause" size={32} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, { backgroundColor: ringColor }]} onPress={startTimer}>
              <Ionicons name="play" size={32} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, { backgroundColor: theme.colors.inputBg }]} onPress={() => { resetTimer(); setSessionType(sessionType === 'work' ? 'break' : 'work'); }}>
            <Ionicons name="swap-horizontal-outline" size={28} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{sessionCount}</Text>
            <Text style={styles.statLabel}>This Session</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{todaySessions}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{pomodoroSessions.filter((s) => s.type === 'work').length}</Text>
            <Text style={styles.statLabel}>All Time</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
