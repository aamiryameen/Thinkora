import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import {
  getTimeRecord, startTimer, stopTimer, deleteEntry, formatDuration,
  type TaskTimeRecord,
} from '../services/timeTrackingService';
import { getPersonalRecord, recordRun, type PersonalRecord, type BattleResult } from '../services/timeBoxBattleService';

interface Props {
  taskId: string;
}

export function TaskTimer({ taskId }: Props) {
  const { theme } = useTheme();
  const [record, setRecord] = useState<TaskTimeRecord | null>(null);
  const [pr, setPr] = useState<PersonalRecord | null>(null);
  const [lastBattle, setLastBattle] = useState<BattleResult | null>(null);
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getTimeRecord(taskId).then(setRecord);
    getPersonalRecord(taskId).then(setPr);
  }, [taskId]);

  // Tick every second when timer is running
  useEffect(() => {
    if (record?.activeStartedAt) {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => { if (tickRef.current) clearInterval(tickRef.current); };
    } else {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
  }, [record?.activeStartedAt]);

  const isRunning = !!record?.activeStartedAt;
  const liveSeconds = isRunning && record?.activeStartedAt
    ? Math.max(0, Math.round((now - record.activeStartedAt) / 1000))
    : 0;
  const totalLive = (record?.totalSeconds ?? 0) + liveSeconds;

  const handleStartStop = async () => {
    if (!record) return;
    if (isRunning) {
      const updated = await stopTimer(taskId);
      setRecord(updated);
      // Record run vs personal best
      const battle = await recordRun(taskId);
      if (battle) {
        setLastBattle(battle);
        const updatedPr = await getPersonalRecord(taskId);
        setPr(updatedPr);
      }
    } else {
      setLastBattle(null); // clear last battle result on new run
      const updated = await startTimer(taskId);
      setRecord(updated);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    Alert.alert('Delete entry?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updated = await deleteEntry(taskId, entryId);
          setRecord(updated);
        },
      },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    wrap: {
      backgroundColor: theme.colors.cardBg,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    headerTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    timerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    timerDisplay: {
      flex: 1, fontSize: 32, fontWeight: '900', color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    timerSub: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },
    btn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingHorizontal: theme.spacing.lg, paddingVertical: 12,
      borderRadius: theme.borderRadius.full,
    },
    btnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
    entry: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      paddingVertical: 8, paddingHorizontal: 4,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border,
    },
    entryDate: { fontSize: 12, color: theme.colors.textMuted, flex: 1 },
    entryDur: { fontSize: 13, fontWeight: '700', color: theme.colors.text, fontVariant: ['tabular-nums'] },
  }), [theme]);

  if (!record) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.headerTitle}>Time Tracking</Text>
      </View>

      <View style={styles.timerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.timerDisplay}>{formatDuration(totalLive)}</Text>
          <Text style={styles.timerSub}>
            {isRunning ? `Running · started ${new Date(record.activeStartedAt!).toLocaleTimeString()}` : `${record.entries.length} session${record.entries.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isRunning ? theme.colors.error : theme.colors.primary }]}
          onPress={handleStartStop}
          activeOpacity={0.85}
        >
          <Ionicons name={isRunning ? 'stop' : 'play'} size={16} color="#FFF" />
          <Text style={styles.btnText}>{isRunning ? 'Stop' : 'Start'}</Text>
        </TouchableOpacity>
      </View>

      {/* Time Box Battle — personal record + last result */}
      {pr && pr.attempts > 0 && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: theme.colors.primary + '12',
          borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
        }}>
          <Ionicons name="trophy" size={16} color={theme.colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text, flex: 1 }}>
            Best: {formatDuration(pr.bestSeconds)} · {pr.attempts} attempt{pr.attempts === 1 ? '' : 's'}
          </Text>
          {isRunning && (
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.primary }}>
              {liveSeconds < pr.bestSeconds ? '🔥 Beating it!' : 'Beat it!'}
            </Text>
          )}
        </View>
      )}

      {lastBattle && (
        <View style={{
          backgroundColor: lastBattle.newRecord ? '#10B98115' : theme.colors.inputBg,
          borderRadius: 10, padding: 10,
          borderWidth: 1.5, borderColor: lastBattle.newRecord ? '#10B981' : 'transparent',
        }}>
          {lastBattle.newRecord ? (
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#10B981' }}>
              🎉 NEW RECORD! {formatDuration(Math.abs(lastBattle.deltaSeconds))} faster!
            </Text>
          ) : lastBattle.previousBest ? (
            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textMuted }}>
              {formatDuration(lastBattle.deltaSeconds)} slower than best · keep at it!
            </Text>
          ) : (
            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textMuted }}>
              First run logged · {formatDuration(lastBattle.runSeconds)}
            </Text>
          )}
        </View>
      )}

      {record.entries.slice(0, 5).map(e => (
        <View key={e.id} style={styles.entry}>
          <Text style={styles.entryDate}>
            {new Date(e.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.entryDur}>{formatDuration(e.durationSeconds)}</Text>
          <TouchableOpacity onPress={() => handleDeleteEntry(e.id)} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
