import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, FlatList, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { THEME_PRESETS } from '../core/theme';
import { Icon } from '../components/Icons';
import DeviceInfo from 'react-native-device-info';
import { exportTasksToHtml, exportNotesToHtml } from '../services/pdfExportService';
import {
  showQuickCaptureNotification,
  hideQuickCaptureNotification,
  isQuickCaptureEnabled,
} from '../services/quickCaptureService';
import { checkForUpdate, startUpdate } from '../services/updateService';
import {
  REMINDER_TUNES,
  getSelectedReminderTune,
  setSelectedReminderTune,
  previewReminderTune,
  stopPreviewTune,
  getCustomTunes,
  deleteCustomTune,
  type ReminderTune,
  type CustomTune,
} from '../services/soundService';
import { pickAndAddCustomTune } from '../services/customTuneService';
import { SUPPORTED_COUNTRIES, countryName } from '../services/holidayService';
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
  const [persistentTray, setPersistentTray] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [selectedTune, setSelectedTuneState] = useState<ReminderTune>(REMINDER_TUNES[0]);
  const [showTunePicker, setShowTunePicker] = useState(false);
  const [playingTuneId, setPlayingTuneId] = useState<string | null>(null);
  const [customTunes, setCustomTunes] = useState<CustomTune[]>([]);
  const [uploadingTune, setUploadingTune] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return SUPPORTED_COUNTRIES;
    return SUPPORTED_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countrySearch]);

  useEffect(() => {
    isQuickCaptureEnabled().then(setQuickCapture);
    getSelectedReminderTune().then(setSelectedTuneState);
    getCustomTunes().then(setCustomTunes);
    try {
      const { isPersistentTrayEnabled } = require('../services/persistentTrayService');
      isPersistentTrayEnabled().then(setPersistentTray);
    } catch {}
  }, []);

  const handleTogglePersistentTray = async () => {
    try {
      const { setPersistentTrayEnabled, showPersistentTray, hidePersistentTray } = require('../services/persistentTrayService');
      const next = !persistentTray;
      await setPersistentTrayEnabled(next);
      setPersistentTray(next);
      if (next) {
        await showPersistentTray({
          topTask: undefined,
          streakDays: 0,
          pendingCount: tasks.filter(t => !t.completed).length,
        });
      } else {
        await hidePersistentTray();
      }
    } catch (e: any) {
      Alert.alert('Could not toggle', e?.message ?? 'Try again');
    }
  };

  const handleUploadCustomTune = async () => {
    setUploadingTune(true);
    try {
      const tune = await pickAndAddCustomTune();
      if (tune) {
        const list = await getCustomTunes();
        setCustomTunes(list);
      }
    } catch (err: any) {
      if (err?.message && !/cancel/i.test(String(err.message))) {
        Alert.alert('Upload Failed', err.message);
      }
    } finally {
      setUploadingTune(false);
    }
  };

  const handleDeleteCustomTune = (tune: CustomTune) => {
    Alert.alert('Delete custom sound?', tune.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCustomTune(tune.id);
          setCustomTunes(await getCustomTunes());
          // If the deleted tune was selected, fall back to default
          if (selectedTune.id === tune.id) {
            await setSelectedReminderTune(REMINDER_TUNES[0].id);
            setSelectedTuneState(REMINDER_TUNES[0]);
          }
        },
      },
    ]);
  };

  // Stop preview when modal closes
  useEffect(() => {
    if (!showTunePicker) {
      stopPreviewTune();
      setPlayingTuneId(null);
    }
  }, [showTunePicker]);

  const handleSelectTune = async (tune: ReminderTune) => {
    await setSelectedReminderTune(tune.id);
    setSelectedTuneState(tune);
    // Play preview for newly-selected tune
    if (playingTuneId === tune.id) {
      stopPreviewTune();
      setPlayingTuneId(null);
    } else {
      previewReminderTune(tune);
      setPlayingTuneId(tune.id);
      setTimeout(() => {
        setPlayingTuneId((curr) => (curr === tune.id ? null : curr));
      }, 30500);
    }
  };

  const togglePreview = (tune: ReminderTune) => {
    if (playingTuneId === tune.id) {
      stopPreviewTune();
      setPlayingTuneId(null);
    } else {
      previewReminderTune(tune);
      setPlayingTuneId(tune.id);
      setTimeout(() => {
        setPlayingTuneId((curr) => (curr === tune.id ? null : curr));
      }, 30500);
    }
  };

  const handleCheckForUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const status = await checkForUpdate();
      if (status.available) {
        Alert.alert(
          'Update Available',
          'A new version is available. Would you like to update now?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update', onPress: () => startUpdate('flexible').catch(() => {}) },
          ],
        );
      } else {
        Alert.alert('Up to Date', 'You are using the latest version.');
      }
    } catch {
      Alert.alert('Error', 'Could not check for updates. Please try again later.');
    } finally {
      setCheckingUpdate(false);
    }
  };

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

  if (showPinSetup) {
    return <PinSetupScreen onComplete={handlePinComplete} />;
  }

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
            <TouchableOpacity style={styles.row} onPress={handleToggleQuickCapture}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#14B8A620' }]}>
                <Ionicons name="flash-outline" size={20} color="#14B8A6" />
              </View>
              <Text style={styles.rowLabel}>Quick Capture</Text>
              <Text style={styles.rowValue}>{quickCapture ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={handleTogglePersistentTray}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#6366F120' }]}>
                <Ionicons name="layers-outline" size={20} color="#6366F1" />
              </View>
              <Text style={styles.rowLabel}>Persistent Tray</Text>
              <Text style={styles.rowValue}>{persistentTray ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => setShowTunePicker(true)}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#EC489920' }]}>
                <Ionicons name="musical-notes-outline" size={20} color="#EC4899" />
              </View>
              <Text style={styles.rowLabel}>Reminder Sound</Text>
              <Text style={styles.rowValue}>{selectedTune.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendar */}
        <View>
          <Text style={styles.sectionTitle}>Calendar</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Calendar')}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="calendar-outline" size={20} color="#EF4444" />
              </View>
              <Text style={styles.rowLabel}>Open Calendar</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={() => setShowCountryPicker(true)}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="flag-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.rowLabel}>Holiday Country</Text>
              <Text style={styles.rowValue}>
                {settings.holidayCountry ? countryName(settings.holidayCountry) : 'Auto'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.row, styles.rowLast]}
              onPress={() => updateSettings({
                holidayNotificationsEnabled: !settings.holidayNotificationsEnabled,
              })}
            >
              <View style={[styles.rowIconWrap, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="notifications-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.rowLabel}>Holiday Notifications</Text>
              <Text style={styles.rowValue}>
                {settings.holidayNotificationsEnabled ? 'On (1 day before)' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cloud Sync */}
        <View>
          <Text style={styles.sectionTitle}>Sync & Backup</Text>
          <View style={styles.card}>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => navigation.navigate('CloudSync')}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="cloud-outline" size={20} color="#3B82F6" />
              </View>
              <Text style={styles.rowLabel}>Cloud Sync & Backup</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Archive & Trash */}
        <View>
          <Text style={styles.sectionTitle}>Storage</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.row, styles.rowLast]}
              onPress={() => navigation.navigate('ArchiveTrash')}
            >
              <View style={[styles.rowIconWrap, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="archive-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.rowLabel}>Archive & Trash</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* AI */}
        <View>
          <Text style={styles.sectionTitle}>AI</Text>
          <View style={styles.card}>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => navigation.navigate('AISettings')}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#7C3AED20' }]}>
                <Ionicons name="sparkles-outline" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.rowLabel}>AI Assistant</Text>
              <Text style={styles.rowValue}>{settings.geminiApiKey ? 'Your key' : 'Thinkora AI'}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
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
            <TouchableOpacity style={styles.row} onPress={handleCheckForUpdate} disabled={checkingUpdate}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="cloud-download-outline" size={20} color="#10B981" />
              </View>
              <Text style={styles.rowLabel}>{checkingUpdate ? 'Checking...' : 'Check for Updates'}</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />
            </TouchableOpacity>
            <View style={[styles.row, styles.rowLast]}>
              <View style={[styles.rowIconWrap, { backgroundColor: '#4A90D920' }]}>
                <Ionicons name="information-circle-outline" size={20} color="#4A90D9" />
              </View>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>{DeviceInfo.getVersion()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Reminder Tune Picker Modal */}
      <Modal visible={showTunePicker} animationType="slide" onRequestClose={() => setShowTunePicker(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
            <TouchableOpacity
              onPress={() => setShowTunePicker(false)}
              style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.inputBg, marginRight: 12 }}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, flex: 1 }}>Reminder Sound</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}>
            <Text style={{ fontSize: 13, color: theme.colors.textMuted, marginBottom: 12, paddingHorizontal: 4 }}>
              Tap any sound to preview and select.
            </Text>

            {/* Upload Custom Sound Button */}
            <TouchableOpacity
              onPress={handleUploadCustomTune}
              disabled={uploadingTune}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 14, marginBottom: 16, borderRadius: 14,
                backgroundColor: theme.colors.primary + '15',
                borderWidth: 2, borderColor: theme.colors.primary,
                borderStyle: 'dashed',
              }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 10,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: theme.colors.primary,
              }}>
                <Ionicons name={uploadingTune ? 'hourglass-outline' : 'cloud-upload-outline'} size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.primary }}>
                  {uploadingTune ? 'Uploading...' : 'Upload Custom Sound'}
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.textMuted, marginTop: 2 }}>
                  Pick an audio file from your phone (MP3, M4A, WAV)
                </Text>
              </View>
            </TouchableOpacity>

            {/* Custom uploaded tunes */}
            {customTunes.length > 0 && (
              <>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginBottom: 8, paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                  My Sounds
                </Text>
                {customTunes.map((custom) => {
                  const tune: ReminderTune = { id: custom.id, name: custom.name, resource: custom.uri };
                  const isSelected = selectedTune.id === tune.id;
                  const isPlaying = playingTuneId === tune.id;
                  return (
                    <View
                      key={tune.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        padding: 14, marginBottom: 8, borderRadius: 14,
                        backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.cardBg,
                        borderWidth: 2,
                        borderColor: isSelected ? theme.colors.primary : 'transparent',
                      }}
                    >
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                        onPress={() => handleSelectTune(tune)}
                        activeOpacity={0.7}
                      >
                        <View style={{
                          width: 40, height: 40, borderRadius: 10,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isSelected ? theme.colors.primary : '#A855F7' + '20',
                        }}>
                          <Ionicons name="cloud" size={20} color={isSelected ? '#FFF' : '#A855F7'} />
                        </View>
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text }}>
                          {tune.name}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => togglePreview(tune)}
                      >
                        <Ionicons
                          name={isPlaying ? 'stop-circle' : 'play-circle-outline'}
                          size={26}
                          color={isPlaying ? theme.colors.error : theme.colors.textMuted}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => handleDeleteCustomTune(custom)}
                      >
                        <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginTop: 8, marginBottom: 8, paddingHorizontal: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Built-In
                </Text>
              </>
            )}

            {REMINDER_TUNES.map((tune) => {
              const isSelected = selectedTune.id === tune.id;
              const isPlaying = playingTuneId === tune.id;
              return (
                <View
                  key={tune.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14, marginBottom: 8, borderRadius: 14,
                    backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.cardBg,
                    borderWidth: 2,
                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                  }}
                >
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                    onPress={() => handleSelectTune(tune)}
                    activeOpacity={0.7}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 10,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isSelected ? theme.colors.primary : theme.colors.inputBg,
                    }}>
                      <Ionicons name="musical-note" size={20} color={isSelected ? '#FFF' : theme.colors.textMuted} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.text }}>{tune.name}</Text>
                  </TouchableOpacity>
                  {isSelected && !isPlaying ? (
                    <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                  ) : (
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => togglePreview(tune)}
                    >
                      <Ionicons
                        name={isPlaying ? 'stop-circle' : 'play-circle-outline'}
                        size={28}
                        color={isPlaying ? theme.colors.error : theme.colors.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Holiday Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
            <TouchableOpacity
              onPress={() => { setShowCountryPicker(false); setCountrySearch(''); }}
              style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.inputBg, marginRight: 12 }}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, flex: 1 }}>
              Holiday Country
            </Text>
          </View>
          <TextInput
            value={countrySearch}
            onChangeText={setCountrySearch}
            placeholder="Search country..."
            placeholderTextColor={theme.colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              backgroundColor: theme.colors.inputBg,
              borderRadius: theme.borderRadius.lg,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 10,
              margin: theme.spacing.lg,
              color: theme.colors.text,
            }}
          />
          <FlatList
            data={filteredCountries}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.code === settings.holidayCountry;
              return (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
                    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
                  }}
                  onPress={() => {
                    updateSettings({ holidayCountry: item.code });
                    setShowCountryPicker(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={{ ...theme.typography.body, color: theme.colors.text, flex: 1 }}>
                    {item.name}
                  </Text>
                  <Text style={{ ...theme.typography.caption, color: theme.colors.textMuted, marginRight: theme.spacing.sm }}>
                    {item.code}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
