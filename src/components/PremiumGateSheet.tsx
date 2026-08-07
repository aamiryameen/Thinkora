import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { PurchasesPackage } from 'react-native-purchases';
import { useTheme } from '../context/ThemeContext';
import { PREMIUM_FEATURE_LABELS, refreshPremium, type PremiumFeature } from '../services/premiumService';
import {
  fetchOfferingPackages,
  getLastOfferingsError,
  purchasePackage,
  restorePurchases,
} from '../services/purchasesService';

const PLANNER_PERKS: { icon: string; title: string; detail: string }[] = [
  { icon: 'calendar-number-outline', title: 'Weekly planner', detail: 'See and plan all seven days at once' },
  { icon: 'albums-outline', title: 'Unlimited templates', detail: 'Student, Work, Fitness, Deep Work + your own' },
  { icon: 'flash-outline', title: 'Auto time blocking', detail: 'Tasks slot themselves into your free time' },
  { icon: 'sparkles-outline', title: 'Smart optimization', detail: 'Reorder the day by priority and deadline' },
  { icon: 'stats-chart-outline', title: 'Advanced analytics', detail: 'Adherence, peak hours, planning streaks' },
  { icon: 'print-outline', title: 'PDF & print export', detail: 'Share a clean copy of any day or week' },
  { icon: 'color-palette-outline', title: 'Premium themes', detail: 'Six planner looks including Midnight and Paper' },
];

function packageLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'ANNUAL': return 'Yearly';
    case 'MONTHLY': return 'Monthly';
    case 'LIFETIME': return 'Lifetime';
    case 'WEEKLY': return 'Weekly';
    case 'THREE_MONTH': return '3 months';
    case 'SIX_MONTH': return '6 months';
    default: return pkg.product.title || 'Premium';
  }
}

function packagePeriod(pkg: PurchasesPackage): string | null {
  switch (pkg.packageType) {
    case 'ANNUAL': return 'per year';
    case 'MONTHLY': return 'per month';
    case 'WEEKLY': return 'per week';
    case 'THREE_MONTH': return 'every 3 months';
    case 'SIX_MONTH': return 'every 6 months';
    default: return null;
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The feature the user just tried to use — highlighted at the top. */
  feature?: PremiumFeature;
}

export function PremiumGateSheet({ visible, onClose, feature }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Why the store returned nothing, shown under the notice. */
  const [storeError, setStoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setPackages(null);
    fetchOfferingPackages().then(list => {
      if (!alive) return;
      setPackages(list);
      // Read after the fetch resolves — the module records the reason there.
      setStoreError(list.length === 0 ? getLastOfferingsError() : null);
      const preferred = list.find(p => p.packageType === 'ANNUAL') ?? list[0];
      setSelectedId(preferred?.identifier ?? null);
    });
    return () => { alive = false; };
  }, [visible]);

  const selected = useMemo(
    () => packages?.find(p => p.identifier === selectedId) ?? null,
    [packages, selectedId],
  );

  const handlePurchase = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    const result = await purchasePackage(selected);
    setBusy(false);

    switch (result.status) {
      case 'success':
        await refreshPremium();
        onClose();
        break;
      case 'cancelled':
        break;
      case 'no_entitlement':
        Alert.alert(
          'Almost there',
          'Your purchase went through but premium could not be unlocked. Contact support and it will be sorted out.',
        );
        break;
      case 'unavailable':
        Alert.alert('Store unavailable', 'In-app purchases are not available on this device right now.');
        break;
      case 'error':
        Alert.alert('Purchase failed', result.message);
        break;
    }
  }, [busy, onClose, selected]);

  const handleRestore = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const result = await restorePurchases();
    setBusy(false);

    switch (result.status) {
      case 'restored':
        await refreshPremium();
        Alert.alert('Premium restored', 'Your purchase has been restored.');
        onClose();
        break;
      case 'nothing_to_restore':
        Alert.alert('Nothing to restore', 'No previous purchase was found for this account.');
        break;
      case 'unavailable':
        Alert.alert('Store unavailable', 'In-app purchases are not available on this device right now.');
        break;
      case 'error':
        Alert.alert('Restore failed', result.message);
        break;
    }
  }, [busy, onClose]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: theme.spacing.lg,
      // No paddingBottom here — the footer already reserves insets.bottom.
      // Everything inside scrolls, so this cap only decides how tall the sheet
      // gets; nothing can be clipped out of reach any more.
      maxHeight: '90%',
    },
    grabber: {
      alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
      backgroundColor: theme.colors.border, marginBottom: theme.spacing.md,
    },
    hero: { alignItems: 'center', paddingHorizontal: theme.spacing.xl, gap: 6 },
    crown: {
      width: 60, height: 60, borderRadius: 20,
      backgroundColor: theme.colors.accent + '20',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: theme.spacing.xs,
    },
    title: { ...theme.typography.title, fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
    subtitle: {
      ...theme.typography.bodySmall, color: theme.colors.textMuted,
      textAlign: 'center', lineHeight: 20,
    },
    featurePill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      alignSelf: 'center', marginTop: theme.spacing.sm,
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.primaryLight,
    },
    featurePillText: { ...theme.typography.caption, fontWeight: '700', color: theme.colors.primary },
    // Content of the single outer ScrollView. flexGrow keeps a short sheet
    // (few perks, plans still loading) filling the space rather than collapsing.
    scrollBody: { flexGrow: 1 },
    list: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, gap: theme.spacing.sm },
    perk: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    perkIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center', justifyContent: 'center',
    },
    perkTitle: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    perkDetail: { ...theme.typography.caption, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
    plans: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, gap: theme.spacing.sm },
    plan: {
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      paddingVertical: 14, paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 2, borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBg,
    },
    planSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
    planRadio: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 2, borderColor: theme.colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    planRadioSelected: { borderColor: theme.colors.primary },
    planRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: theme.colors.primary },
    planLabel: { ...theme.typography.bodySmall, fontWeight: '700', color: theme.colors.text },
    planPeriod: { ...theme.typography.caption, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
    planPrice: { ...theme.typography.bodySmall, fontWeight: '800', color: theme.colors.text },
    loadingBox: { paddingVertical: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.sm },
    footer: {
      paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, gap: theme.spacing.sm,
      // Clear the home-indicator / gesture bar so the CTA stays tappable.
      // Floored, because insets.bottom is 0 on devices with hardware nav keys
      // and "Maybe later" would then sit flush against the screen edge.
      paddingBottom: Math.max(insets.bottom, theme.spacing.md),
    },
    note: {
      ...theme.typography.caption, fontSize: 11, color: theme.colors.textMuted,
      textAlign: 'center', lineHeight: 16,
      backgroundColor: theme.colors.inputBg,
      padding: theme.spacing.sm, borderRadius: theme.borderRadius.md,
    },
    cta: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 16, alignItems: 'center',
      ...theme.shadows.fab,
    },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { ...theme.typography.button, fontSize: 16, fontWeight: '800', color: '#FFF' },
    dismiss: { alignItems: 'center', paddingVertical: theme.spacing.sm },
    dismissText: { ...theme.typography.bodySmall, color: theme.colors.textMuted },
    restore: { alignItems: 'center', paddingVertical: 4 },
    restoreText: { ...theme.typography.caption, color: theme.colors.primary, fontWeight: '700' },
  }), [insets.bottom, theme]);

  const loadingPlans = packages === null;
  const noPlans = packages !== null && packages.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          {/* One ScrollView around the whole sheet, rather than only the perks
              list. The hero and footer are tall enough together that on a short
              screen the last row ("Maybe later") fell outside the sheet's
              maxHeight and was clipped with no way to reach it. */}
          <ScrollView
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.hero}>
            <View style={styles.crown}>
              <Ionicons name="diamond-outline" size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.title}>Planner Premium</Text>
            <Text style={styles.subtitle}>
              Plan further ahead, let the app do the scheduling, and see what's actually working.
            </Text>
            {feature && (
              <View style={styles.featurePill}>
                <Ionicons name="lock-open-outline" size={13} color={theme.colors.primary} />
                <Text style={styles.featurePillText}>{PREMIUM_FEATURE_LABELS[feature]}</Text>
              </View>
            )}
          </View>

          <View style={styles.list}>
            {PLANNER_PERKS.map(perk => (
              <View key={perk.title} style={styles.perk}>
                <View style={styles.perkIcon}>
                  <Ionicons name={perk.icon} size={19} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perkTitle}>{perk.title}</Text>
                  <Text style={styles.perkDetail}>{perk.detail}</Text>
                </View>
              </View>
            ))}

            {loadingPlans && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={styles.perkDetail}>Loading plans…</Text>
              </View>
            )}

            {!loadingPlans && !noPlans && (
              <View style={styles.plans}>
                {packages!.map(pkg => {
                  const isSelected = pkg.identifier === selectedId;
                  const period = packagePeriod(pkg);
                  return (
                    <TouchableOpacity
                      key={pkg.identifier}
                      style={[styles.plan, isSelected && styles.planSelected]}
                      activeOpacity={0.8}
                      onPress={() => setSelectedId(pkg.identifier)}
                    >
                      <View style={[styles.planRadio, isSelected && styles.planRadioSelected]}>
                        {isSelected && <View style={styles.planRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planLabel}>{packageLabel(pkg)}</Text>
                        {period && <Text style={styles.planPeriod}>{period}</Text>}
                      </View>
                      <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.footer}>
            {noPlans && (
              <Text style={styles.note}>
                Plans aren't available right now. Check your connection and try again in a moment.
                {storeError ? `\n\n${storeError}` : ''}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.cta, (busy || !selected) && styles.ctaDisabled]}
              activeOpacity={0.85}
              disabled={busy || !selected}
              onPress={handlePurchase}
            >
              {busy
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.ctaText}>Unlock Planner Premium</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.restore} onPress={handleRestore} disabled={busy}>
              <Text style={styles.restoreText}>Restore purchases</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismiss} onPress={onClose}>
              <Text style={styles.dismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
