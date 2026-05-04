import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  PanResponder, Alert, Modal, TextInput, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import type { Task } from '../types';
import { generateId } from '../utils/id';

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;           // px per hour
const TIMELINE_START = 6;         // 6 AM
const TIMELINE_END = 23;          // 11 PM
const TOTAL_HOURS = TIMELINE_END - TIMELINE_START;
const SLOT_SNAP = 15;             // snap to 15-minute intervals
const PIXELS_PER_MIN = HOUR_HEIGHT / 60;
const MIN_BLOCK_MINUTES = 15;
const DEFAULT_BLOCK_MINUTES = 60;
const TIME_LABEL_WIDTH = 52;

interface TimeBlock {
  id: string;
  taskId: string | null;
  title: string;
  color: string;
  startMinutes: number;  // minutes from TIMELINE_START hour
  durationMinutes: number;
  date: string; // "YYYY-MM-DD"
}

const BLOCK_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#3B82F6', '#84CC16',
];

function minutesToTime(minutes: number): string {
  const totalMins = TIMELINE_START * 60 + minutes;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function snapMinutes(min: number): number {
  return Math.round(min / SLOT_SNAP) * SLOT_SNAP;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(str: string): string {
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Block component ─────────────────────────────────────────────────────────

interface BlockProps {
  block: TimeBlock;
  onMoveEnd: (id: string, newStart: number) => void;
  onResizeEnd: (id: string, newDuration: number) => void;
  onPress: (id: string) => void;
  scrollOffset: React.MutableRefObject<number>;
}

function TimeBlockView({ block, onMoveEnd, onResizeEnd, onPress, scrollOffset }: BlockProps) {
  const { theme } = useTheme();
  const dragY = useRef(new Animated.Value(0)).current;
  const resizeDelta = useRef(new Animated.Value(0)).current;
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const startY = useRef(0);

  const top = block.startMinutes * PIXELS_PER_MIN;
  const height = Math.max(block.durationMinutes * PIXELS_PER_MIN, MIN_BLOCK_MINUTES * PIXELS_PER_MIN);

  const movePan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
    onPanResponderGrant: (e) => {
      isDragging.current = true;
      startY.current = e.nativeEvent.pageY;
      dragY.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      if (isDragging.current) dragY.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      isDragging.current = false;
      const deltaMins = gs.dy / PIXELS_PER_MIN;
      const newStart = Math.max(0, Math.min(
        TOTAL_HOURS * 60 - block.durationMinutes,
        snapMinutes(block.startMinutes + deltaMins)
      ));
      dragY.setValue(0);
      onMoveEnd(block.id, newStart);
    },
  });

  const resizePan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      isResizing.current = true;
      resizeDelta.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      resizeDelta.setValue(gs.dy);
    },
    onPanResponderRelease: (_, gs) => {
      isResizing.current = false;
      const deltaMins = gs.dy / PIXELS_PER_MIN;
      const newDuration = Math.max(MIN_BLOCK_MINUTES, snapMinutes(block.durationMinutes + deltaMins));
      resizeDelta.setValue(0);
      onResizeEnd(block.id, newDuration);
    },
  });

  const animTop = Animated.add(new Animated.Value(top), dragY);
  const animHeight = Animated.add(new Animated.Value(height), resizeDelta);

  return (
    <Animated.View
      style={[{
        position: 'absolute',
        left: TIME_LABEL_WIDTH + 4,
        right: 8,
        top: animTop,
        height: animHeight,
        backgroundColor: block.color + 'DD',
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: block.color,
        overflow: 'hidden',
        zIndex: 2,
      }]}
    >
      {/* Drag handle — top area */}
      <TouchableOpacity
        {...movePan.panHandlers}
        onPress={() => onPress(block.id)}
        activeOpacity={0.9}
        style={{ flex: 1, padding: 8 }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }} numberOfLines={1}>
          {block.title}
        </Text>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
          {minutesToTime(block.startMinutes)} · {block.durationMinutes}m
        </Text>
      </TouchableOpacity>

      {/* Resize handle — bottom strip */}
      <Animated.View
        {...resizePan.panHandlers}
        style={{
          height: 16, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.15)',
        }}
      >
        <View style={{ width: 24, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' }} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── Add Block Modal ──────────────────────────────────────────────────────────

interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (block: Omit<TimeBlock, 'id' | 'date'>) => void;
  tasks: Task[];
  initialStart?: number;
  theme: any;
}

function AddBlockModal({ visible, onClose, onAdd, tasks, initialStart = 0, theme }: AddModalProps) {
  const [title, setTitle] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [startH, setStartH] = useState(String(TIMELINE_START + Math.floor(initialStart / 60)));
  const [startM, setStartM] = useState(String(initialStart % 60).padStart(2, '0'));
  const [duration, setDuration] = useState('60');
  const [colorIdx, setColorIdx] = useState(0);

  const handleAdd = () => {
    const label = title.trim() || tasks.find(t => t.id === selectedTaskId)?.title || '';
    if (!label) { Alert.alert('Title required', 'Enter a title or select a task.'); return; }
    const sh = Math.max(TIMELINE_START, Math.min(TIMELINE_END - 1, parseInt(startH) || TIMELINE_START));
    const sm = Math.max(0, Math.min(59, parseInt(startM) || 0));
    const startMins = (sh - TIMELINE_START) * 60 + sm;
    const dur = Math.max(MIN_BLOCK_MINUTES, parseInt(duration) || DEFAULT_BLOCK_MINUTES);
    onAdd({ taskId: selectedTaskId, title: label, color: BLOCK_COLORS[colorIdx], startMinutes: startMins, durationMinutes: dur });
    setTitle(''); setSelectedTaskId(null); setDuration('60'); onClose();
  };

  const incompleteTasks = tasks.filter(t => !t.completed).slice(0, 20);

  const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
    label: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
    input: { backgroundColor: theme.colors.inputBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.text },
    row: { flexDirection: 'row', gap: 10 },
    smallInput: { flex: 1, backgroundColor: theme.colors.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: theme.colors.text, textAlign: 'center' },
    taskChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.inputBg, marginRight: 8 },
    taskChipSelected: { backgroundColor: theme.colors.primary },
    taskChipText: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },
    taskChipTextSelected: { color: '#FFF', fontWeight: '700' },
    colorDot: { width: 28, height: 28, borderRadius: 14, marginRight: 6 },
    addBtn: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    addBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
    cancelBtn: { alignItems: 'center', paddingVertical: 10 },
    cancelBtnText: { fontSize: 14, color: theme.colors.textMuted },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add Time Block</Text>

          <View>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Block title..." placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {incompleteTasks.length > 0 && (
            <View>
              <Text style={styles.label}>Link to Task (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {incompleteTasks.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.taskChip, selectedTaskId === t.id && styles.taskChipSelected]}
                    onPress={() => {
                      setSelectedTaskId(t.id === selectedTaskId ? null : t.id);
                      if (!title) setTitle(t.title);
                    }}
                  >
                    <Text style={[styles.taskChipText, selectedTaskId === t.id && styles.taskChipTextSelected]} numberOfLines={1}>
                      {t.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Start Hour</Text>
              <TextInput style={styles.smallInput} value={startH} onChangeText={setStartH} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Start Min</Text>
              <TextInput style={styles.smallInput} value={startM} onChangeText={setStartM} keyboardType="number-pad" maxLength={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Duration (m)</Text>
              <TextInput style={styles.smallInput} value={duration} onChangeText={setDuration} keyboardType="number-pad" maxLength={3} />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {BLOCK_COLORS.map((c, i) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c, borderWidth: colorIdx === i ? 3 : 0, borderColor: '#FFF' }]}
                  onPress={() => setColorIdx(i)}
                />
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addBtnText}>Add Block</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function TimeBlockingScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks } = useApp();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [dateOffset, setDateOffset] = useState(0);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tapStartMinutes, setTapStartMinutes] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);

  const hours = useMemo(() =>
    Array.from({ length: TOTAL_HOURS }, (_, i) => TIMELINE_START + i), []);

  const dayBlocks = useMemo(() =>
    blocks.filter(b => b.date === selectedDate), [blocks, selectedDate]);

  const changeDay = (delta: number) => {
    const newOffset = dateOffset + delta;
    setDateOffset(newOffset);
    setSelectedDate(dateStr(newOffset));
  };

  const addBlock = useCallback((b: Omit<TimeBlock, 'id' | 'date'>) => {
    setBlocks(prev => [...prev, { ...b, id: generateId(), date: selectedDate }]);
  }, [selectedDate]);

  const moveBlock = useCallback((id: string, newStart: number) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, startMinutes: newStart } : b));
  }, []);

  const resizeBlock = useCallback((id: string, newDuration: number) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, durationMinutes: newDuration } : b));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    Alert.alert('Delete block?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setBlocks(prev => prev.filter(b => b.id !== id)) },
    ]);
    setSelectedBlockId(null);
  }, []);

  const handleBlockPress = useCallback((id: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;
    Alert.alert(block.title, `${minutesToTime(block.startMinutes)} · ${block.durationMinutes} minutes`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBlock(id) },
    ]);
  }, [blocks, deleteBlock]);

  const handleTimelinePress = useCallback((yOffset: number) => {
    const mins = snapMinutes(yOffset / PIXELS_PER_MIN);
    setTapStartMinutes(mins);
    setShowAddModal(true);
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: 10 },
    headerTitle: { ...theme.typography.title, fontSize: 22, fontWeight: '800', color: theme.colors.text, flex: 1 },
    dateNav: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    datePill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: 14, paddingVertical: 7,
    },
    dateText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
    navBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.inputBg, alignItems: 'center', justifyContent: 'center' },
    todayBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: theme.colors.primary },
    todayBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
    timeline: { flex: 1 },
    timelineContent: {
      height: TOTAL_HOURS * HOUR_HEIGHT + 40,
      paddingTop: 20,
    },
    hourRow: {
      position: 'absolute', left: 0, right: 0,
      height: HOUR_HEIGHT,
      flexDirection: 'row', alignItems: 'flex-start',
    },
    hourLabel: {
      width: TIME_LABEL_WIDTH, paddingTop: 0,
      fontSize: 11, fontWeight: '600', color: theme.colors.textMuted,
      textAlign: 'right', paddingRight: 10,
    },
    hourLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginTop: 7 },
    halfLine: {
      position: 'absolute', left: TIME_LABEL_WIDTH, right: 0,
      height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border + '60',
    },
    tapZone: { position: 'absolute', left: TIME_LABEL_WIDTH, right: 0, top: 20, bottom: 0 },
    addFab: {
      position: 'absolute',
      bottom: insets.bottom + 24,
      right: theme.spacing.lg,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: theme.colors.primary,
      alignItems: 'center', justifyContent: 'center',
      ...theme.shadows.fab,
      zIndex: 10,
    },
    currentTimeLine: {
      position: 'absolute', left: TIME_LABEL_WIDTH, right: 0,
      height: 2, backgroundColor: theme.colors.error, zIndex: 5,
    },
    currentTimeDot: {
      position: 'absolute', left: TIME_LABEL_WIDTH - 5,
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: theme.colors.error, zIndex: 6,
    },
    emptyHint: {
      position: 'absolute', left: TIME_LABEL_WIDTH + 16, right: 16,
      top: HOUR_HEIGHT * 2,
      alignItems: 'center', gap: 6,
    },
    emptyHintText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  }), [theme, insets]);

  // Current time indicator
  const now = new Date();
  const currentMins = (now.getHours() - TIMELINE_START) * 60 + now.getMinutes();
  const showCurrentTime = selectedDate === todayStr() && currentMins >= 0 && currentMins < TOTAL_HOURS * 60;
  const currentTimeTop = 20 + currentMins * PIXELS_PER_MIN;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Time Blocking</Text>
          {dateOffset !== 0 && (
            <TouchableOpacity style={styles.todayBtn} onPress={() => { setDateOffset(0); setSelectedDate(todayStr()); }}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.dateNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => changeDay(-1)}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.datePill}>
            <Ionicons name="calendar-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.dateText}>{formatDateLabel(selectedDate)}</Text>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={() => changeDay(1)}>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.timeline}
        contentContainerStyle={styles.timelineContent}
        scrollEventThrottle={16}
        onScroll={e => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hour grid */}
        {hours.map((hour, i) => (
          <View
            key={hour}
            style={[styles.hourRow, { top: 20 + i * HOUR_HEIGHT }]}
          >
            <Text style={styles.hourLabel}>
              {hour % 12 || 12}{hour < 12 ? 'am' : 'pm'}
            </Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        {/* Half-hour lines */}
        {hours.map((_, i) => (
          <View
            key={`half-${i}`}
            style={[styles.halfLine, { top: 20 + i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }]}
          />
        ))}

        {/* Current time indicator */}
        {showCurrentTime && (
          <>
            <View style={[styles.currentTimeLine, { top: currentTimeTop }]} />
            <View style={[styles.currentTimeDot, { top: currentTimeTop - 4 }]} />
          </>
        )}

        {/* Tap-to-add zone */}
        <TouchableOpacity
          style={styles.tapZone}
          activeOpacity={1}
          onPress={e => handleTimelinePress(e.nativeEvent.locationY)}
        />

        {/* Empty state hint */}
        {dayBlocks.length === 0 && (
          <View style={styles.emptyHint} pointerEvents="none">
            <Ionicons name="time-outline" size={40} color={theme.colors.textDisabled} />
            <Text style={styles.emptyHintText}>
              Tap anywhere on the timeline{'\n'}or press + to add a time block
            </Text>
          </View>
        )}

        {/* Time blocks */}
        {dayBlocks.map(block => (
          <TimeBlockView
            key={block.id}
            block={block}
            onMoveEnd={moveBlock}
            onResizeEnd={resizeBlock}
            onPress={handleBlockPress}
            scrollOffset={scrollOffsetRef}
          />
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.addFab} onPress={() => { setTapStartMinutes(0); setShowAddModal(true); }} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      <AddBlockModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addBlock}
        tasks={tasks}
        initialStart={tapStartMinutes}
        theme={theme}
      />
    </View>
  );
}
