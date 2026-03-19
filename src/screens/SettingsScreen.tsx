import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { THEME_PRESETS } from '../core/theme';
import { Icon } from '../components/Icons';
import { exportTasksToHtml, exportNotesToHtml } from '../services/pdfExportService';
import { showQuickCaptureNotification, hideQuickCaptureNotification } from '../services/quickCaptureService';
import { PinSetupScreen } from './AppLockScreen';
import type { RootStackParamList } from '../navigation/types';

type ThemeMode = 'light' | 'dark' | 'system';
type Nav = NativeStackNavigationProp<RootStackParamList>;

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: 'sun' | 'moon' | 'system' }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'system' },
];

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { theme, themeMode, setThemeMode, themeColorId, setThemeColorId } = useTheme();
  const { settings, updateSettings, tasks, notes } = useApp();
  const insets = useSafeAreaInsets();
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [quickCapture, setQuickCapture] = useState(false);

  const handleExportTasks = () => exportTasksToHtml(tasks, 'My Tasks');
  const handleExportNotes = () => exportNotesToHtml(notes, 'My Notes');

  const handleToggleLock = () => {
    if (settings.appLockEnabled) {
      updateSettings({ appLockEnabled: false, appLockPin: null });
    } else {
      setShowPinSetup(true);
    }
  };

  const handlePinComplete = (pin: string) => {
    updateSettings({ appLockEnabled: true, appLockPin: pin });
    setShowPinSetup(false);
    Alert.alert('PIN Set', 'App lock is now enabled.');
  };

  const handleToggleQuickCapture = async () => {
    if (quickCapture) {
      await hideQuickCaptureNotification();
      setQuickCapture(false);
    } else {
      await showQuickCaptureNotification();
      setQuickCapture(true);
    }
  };

  if (showPinSetup) {
    return <PinSetupScreen onComplete={handlePinComplete} />;
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: insets.top + theme.spacing.md, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surface },
    headerTitle: { ...theme.typography.title, fontSize: 26, fontWeight: '700', color: theme.colors.text },
    scroll: { flex: 1 },
    scrollContent: { paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 },
    sectionTitle: { ...theme.typography.overline, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.sm, marginLeft: theme.spacing.xs },
    card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, overflow: 'hidden', ...theme.shadows.card },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, gap: theme.spacing.md },
    rowLast: { borderBottomWidth: 0 },
    rowIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
    rowValue: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
    themeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    themeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.inputBg, borderWidth: 2, borderColor: 'transparent', gap: theme.spacing.xs },
    themeOptionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    themeOptionText: { ...theme.typography.bodySmall, color: theme.colors.text, fontWeight: '500' },
    themeOptionTextSelected: { color: theme.colors.primary, fontWeight: '700' },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    colorDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
    colorDotSelected: { borderColor: theme.colors.text },
  }), [theme, insets]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Theme Mode */}
        <View>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themeRow}>
            {MODE_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.value} style={[styles.themeOption, themeMode === opt.value && styles.themeOptionSelected]} onPress={() => setThemeMode(opt.value)} activeOpacity={0.7}>
                <Icon name={opt.icon} size={18} color={themeMode === opt.value ? theme.colors.primary : theme.colors.textMuted} />
                <Text style={[styles.themeOptionText, themeMode === opt.value && styles.themeOptionTextSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Theme Colors */}
        <View>
          <Text style={styles.sectionTitle}>Color Theme</Text>
          <View style={styles.colorRow}>
            {THEME_PRESETS.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.colorDot, { backgroundColor: p.primary }, themeColorId === p.id && styles.colorDotSelected]} onPress={() => setThemeColorId(p.id)}>
                {themeColorId === p.id && <Ionicons name="checkmark" size={18} color="#FFF" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Customize */}
        <View>
          <Text style={styles.sectionTitle}>Customize</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => updateSettings({ firstDayOfWeek: settings.firstDayOfWeek === 0 ? 1 : 0 })}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.rowLabel}>First Day of Week</Text>
              <Text style={styles.rowValue}>{settings.firstDayOfWeek === 0 ? 'Sunday' : 'Monday'}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="notifications-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.rowLabel}>Notifications</Text>
              <Text style={styles.rowValue}>{settings.notificationsEnabled ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={handleToggleQuickCapture}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#14B8A620' }]}>
                <Ionicons name="flash-outline" size={20} color="#14B8A6" />
              </View>
              <Text style={styles.rowLabel}>Quick Capture</Text>
              <Text style={styles.rowValue}>{quickCapture ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security */}
        <View>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.card}>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={handleToggleLock}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.rowLabel}>App Lock (PIN)</Text>
              <Text style={styles.rowValue}>{settings.appLockEnabled ? 'On' : 'Off'}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Export */}
        <View>
          <Text style={styles.sectionTitle}>Export</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={handleExportTasks}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="download-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.rowLabel}>Export Tasks</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={handleExportNotes}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#6366F120' }]}>
                <Ionicons name="download-outline" size={20} color="#6366F1" />
              </View>
              <Text style={styles.rowLabel}>Export Notes</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Manage */}
        <View>
          <Text style={styles.sectionTitle}>Manage</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('CategoryManager')}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="pricetags-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.rowLabel}>Categories</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => navigation.navigate('Reports')}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#4A90D920' }]}>
                <Ionicons name="bar-chart-outline" size={20} color="#4A90D9" />
              </View>
              <Text style={styles.rowLabel}>Reports</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('PrivacyPolicy')}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#6366F120' }]}>
                <Ionicons name="shield-outline" size={20} color="#6366F1" />
              </View>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
            <View style={[styles.row, styles.rowLast]}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#4A90D920' }]}>
                <Ionicons name="information-circle-outline" size={20} color="#4A90D9" />
              </View>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
