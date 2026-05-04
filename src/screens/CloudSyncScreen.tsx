import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import {
  signIn, signUp, signOut, getCurrentUser, backupToCloud,
  restoreFromCloud, getLastBackupInfo, resetPassword,
  EmailConfirmationRequired,
  type SyncUser,
} from '../services/syncService';

type Screen = 'main' | 'login' | 'signup' | 'forgot';

export function CloudSyncScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { restoreData } = useApp();

  const [user, setUser] = useState<SyncUser | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [screen, setScreen] = useState<Screen>('main');
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const u = await getCurrentUser();
        setUser(u);
        if (u) {
          const info = await getLastBackupInfo();
          if (info) setLastBackup(info.backedUpAt);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSignIn = useCallback(async () => {
    if (!email.trim() || !password) { setAuthError('Please fill in all fields'); return; }
    setAuthError('');
    setAuthLoading(true);
    try {
      const u = await signIn(email.trim(), password);
      setUser(u);
      setScreen('main');
      const info = await getLastBackupInfo();
      if (info) setLastBackup(info.backedUpAt);
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }, [email, password]);

  const handleSignUp = useCallback(async () => {
    if (!email.trim() || !password || !confirmPassword) { setAuthError('Please fill in all fields'); return; }
    if (password !== confirmPassword) { setAuthError('Passwords do not match'); return; }
    if (password.length < 6) { setAuthError('Password must be at least 6 characters'); return; }
    setAuthError('');
    setAuthLoading(true);
    try {
      const u = await signUp(email.trim(), password);
      setUser(u);
      setScreen('main');
    } catch (e: any) {
      if (e instanceof EmailConfirmationRequired) {
        setConfirmEmailSent(true);
      } else {
        setAuthError(e.message);
      }
    } finally {
      setAuthLoading(false);
    }
  }, [email, password, confirmPassword]);

  const handleForgotPassword = useCallback(async () => {
    if (!email.trim()) { setAuthError('Enter your email address'); return; }
    setAuthError('');
    setAuthLoading(true);
    try {
      await resetPassword(email.trim());
      setForgotSent(true);
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  }, [email]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Sign out of cloud sync?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await signOut();
          setUser(null);
          setLastBackup(null);
        },
      },
    ]);
  }, []);

  const handleBackup = useCallback(async () => {
    setSyncing(true);
    try {
      await backupToCloud();
      const info = await getLastBackupInfo();
      if (info) setLastBackup(info.backedUpAt);
      Alert.alert('Backup Complete', 'Your data has been backed up to the cloud.');
    } catch (e: any) {
      Alert.alert('Backup Failed', e.message);
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleRestore = useCallback(() => {
    Alert.alert(
      'Restore from Cloud',
      'This will replace all local data with your cloud backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore', style: 'destructive', onPress: async () => {
            setRestoring(true);
            try {
              const payload = await restoreFromCloud();
              restoreData({
                notes: payload.notes,
                tasks: payload.tasks,
                folders: payload.folders,
                tags: payload.tags,
                reminders: payload.reminders,
                taskCategories: payload.taskCategories,
                settings: payload.settings,
              });
              Alert.alert('Restore Complete', 'Your data has been restored from the cloud backup.');
            } catch (e: any) {
              Alert.alert('Restore Failed', e.message);
            } finally {
              setRestoring(false);
            }
          },
        },
      ],
    );
  }, [restoreData]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: insets.top + theme.spacing.md,
      paddingBottom: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: { ...theme.typography.title, fontSize: 22, fontWeight: '700', color: theme.colors.text, flex: 1 },
    scroll: { flex: 1 },
    content: { padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 60 },
    heroCard: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
    heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 18 },
    card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, ...theme.shadows.card, overflow: 'hidden' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { ...theme.typography.body, color: theme.colors.text, flex: 1, fontWeight: '600' },
    rowSub: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 1 },
    sectionLabel: { ...theme.typography.overline, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.xs },
    // Auth form
    formCard: { backgroundColor: theme.colors.cardBg, borderRadius: theme.borderRadius.xl, ...theme.shadows.card, padding: theme.spacing.lg, gap: theme.spacing.md },
    formTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
    formSub: { ...theme.typography.bodySmall, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1.5, borderColor: 'transparent',
    },
    inputWrapFocused: { borderColor: theme.colors.primary },
    input: { flex: 1, ...theme.typography.body, color: theme.colors.text, paddingVertical: 13 },
    errorText: { fontSize: 13, color: theme.colors.error, fontWeight: '500' },
    primaryBtn: {
      backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center',
    },
    primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
    secondaryBtn: { alignItems: 'center', paddingVertical: theme.spacing.sm },
    secondaryBtnText: { fontSize: 13, color: theme.colors.primary, fontWeight: '600' },
    userBadge: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
      backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md, paddingVertical: 10,
    },
    userEmail: { fontSize: 14, fontWeight: '600', color: theme.colors.primary, flex: 1 },
    dangerBtn: {
      backgroundColor: theme.colors.error + '15', borderRadius: theme.borderRadius.lg,
      paddingVertical: 15, alignItems: 'center', borderWidth: 1.5, borderColor: theme.colors.error + '40',
    },
    dangerBtnText: { fontSize: 15, fontWeight: '700', color: theme.colors.error },
  }), [theme, insets]);

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  const renderAuth = () => {
    if (screen === 'forgot') {
      return (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Reset Password</Text>
          <Text style={styles.formSub}>We'll send a reset link to your email.</Text>
          {forgotSent ? (
            <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
              <Ionicons name="mail-outline" size={36} color={theme.colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>Check your email</Text>
              <Text style={{ fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' }}>A reset link has been sent to {email}</Text>
              <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 8 }]} onPress={() => { setScreen('login'); setForgotSent(false); }}>
                <Text style={styles.secondaryBtnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input} value={email} onChangeText={setEmail}
                  placeholder="Email address" placeholderTextColor={theme.colors.textMuted}
                  keyboardType="email-address" autoCapitalize="none"
                />
              </View>
              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              <TouchableOpacity style={styles.primaryBtn} onPress={handleForgotPassword} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Send Reset Link</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setScreen('login'); setAuthError(''); }}>
                <Text style={styles.secondaryBtnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      );
    }

    const isLogin = screen === 'login';

    // Email confirmation sent — show success state instead of form
    if (!isLogin && confirmEmailSent) {
      return (
        <View style={styles.formCard}>
          <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="mail-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={[styles.formTitle, { textAlign: 'center' }]}>Check Your Email</Text>
            <Text style={[styles.formSub, { textAlign: 'center' }]}>
              We sent a confirmation link to{'\n'}<Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{email}</Text>{'\n\n'}Click the link in the email, then sign in below.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { width: '100%', marginTop: 8 }]}
              onPress={() => { setConfirmEmailSent(false); setScreen('login'); setAuthError(''); }}
            >
              <Text style={styles.primaryBtnText}>Go to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
        <Text style={styles.formSub}>{isLogin ? 'Sign in to sync your data across devices.' : 'Create a free account to start syncing.'}</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input} value={email} onChangeText={setEmail}
            placeholder="Email address" placeholderTextColor={theme.colors.textMuted}
            keyboardType="email-address" autoCapitalize="none"
          />
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input} value={password} onChangeText={setPassword}
            placeholder="Password" placeholderTextColor={theme.colors.textMuted}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
        {!isLogin && (
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Confirm password" placeholderTextColor={theme.colors.textMuted}
              secureTextEntry={!showPassword}
            />
          </View>
        )}
        {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
        <TouchableOpacity style={styles.primaryBtn} onPress={isLogin ? handleSignIn : handleSignUp} disabled={authLoading}>
          {authLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>}
        </TouchableOpacity>
        {isLogin && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setScreen('forgot'); setAuthError(''); }}>
            <Text style={styles.secondaryBtnText}>Forgot password?</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setScreen(isLogin ? 'signup' : 'login'); setAuthError(''); }}>
          <Text style={styles.secondaryBtnText}>
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cloud Sync & Backup</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="cloud" size={32} color="#FFF" />
          </View>
          <Text style={styles.heroTitle}>Your Data, Everywhere</Text>
          <Text style={styles.heroSub}>
            Back up notes, tasks, and settings to the cloud.{'\n'}Restore on any device, anytime.
          </Text>
        </View>

        {user ? (
          <>
            {/* Signed in state */}
            <View style={styles.userBadge}>
              <Ionicons name="person-circle-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.primary} />
            </View>

            <View>
              <Text style={styles.sectionLabel}>Backup & Restore</Text>
              <View style={styles.card}>
                <TouchableOpacity style={styles.row} onPress={handleBackup} disabled={syncing || restoring}>
                  <View style={[styles.rowIcon, { backgroundColor: '#10B98120' }]}>
                    {syncing ? <ActivityIndicator color="#10B981" size="small" /> : <Ionicons name="cloud-upload-outline" size={22} color="#10B981" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Back Up Now</Text>
                    {lastBackup && <Text style={styles.rowSub}>Last backup: {formatDate(lastBackup)}</Text>}
                  </View>
                  {!syncing && <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={handleRestore} disabled={syncing || restoring}>
                  <View style={[styles.rowIcon, { backgroundColor: '#6366F120' }]}>
                    {restoring ? <ActivityIndicator color="#6366F1" size="small" /> : <Ionicons name="cloud-download-outline" size={22} color="#6366F1" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>Restore from Cloud</Text>
                    <Text style={styles.rowSub}>Replace local data with cloud backup</Text>
                  </View>
                  {!restoring && <Ionicons name="chevron-forward" size={18} color={theme.colors.textDisabled} />}
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={styles.sectionLabel}>What's Included</Text>
              <View style={styles.card}>
                {[
                  { icon: 'document-text-outline', label: 'All Notes & Content', color: '#6366F1' },
                  { icon: 'checkbox-outline', label: 'Tasks & Subtasks', color: '#10B981' },
                  { icon: 'folder-outline', label: 'Folders & Tags', color: '#F59E0B' },
                  { icon: 'alarm-outline', label: 'Reminders', color: '#EF4444' },
                  { icon: 'settings-outline', label: 'App Settings', color: '#8B5CF6' },
                ].map((item, i, arr) => (
                  <View key={item.label} style={[styles.row, i === arr.length - 1 && styles.rowLast]}>
                    <View style={[styles.rowIcon, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut}>
              <Text style={styles.dangerBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Not signed in */}
            <View>
              <Text style={styles.sectionLabel}>{screen === 'main' ? 'Get Started' : screen === 'login' ? 'Sign In' : screen === 'signup' ? 'Sign Up' : 'Reset Password'}</Text>
              {screen === 'main' ? (
                <View style={{ gap: theme.spacing.md }}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('login')}>
                    <Text style={styles.primaryBtnText}>Sign In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.colors.cardBg, borderWidth: 2, borderColor: theme.colors.primary }]} onPress={() => setScreen('signup')}>
                    <Text style={[styles.primaryBtnText, { color: theme.colors.primary }]}>Create Free Account</Text>
                  </TouchableOpacity>
                </View>
              ) : renderAuth()}
            </View>

            <View>
              <Text style={styles.sectionLabel}>Why Cloud Sync?</Text>
              <View style={styles.card}>
                {[
                  { icon: 'phone-portrait-outline', label: 'Access on any device', color: '#3B82F6' },
                  { icon: 'shield-checkmark-outline', label: 'Encrypted & secure', color: '#10B981' },
                  { icon: 'refresh-outline', label: 'Automatic backups', color: '#8B5CF6' },
                  { icon: 'heart-outline', label: 'Never lose your data', color: '#EF4444' },
                ].map((item, i, arr) => (
                  <View key={item.label} style={[styles.row, i === arr.length - 1 && styles.rowLast]}>
                    <View style={[styles.rowIcon, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
