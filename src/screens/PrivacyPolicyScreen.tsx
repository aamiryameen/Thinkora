import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const LAST_UPDATED = 'March 19, 2026';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: `Thinkora is designed with your privacy in mind. We collect only the minimum information necessary to provide our services:\n\n• **Account Data:** If you create an account, we collect your email address and a hashed password.\n• **App Content:** Notes, tasks, habits, and other content you create are stored locally on your device. We do not upload your personal content to our servers unless you explicitly enable cloud sync.\n• **Usage Analytics:** We may collect anonymised, aggregated usage statistics (e.g. feature usage counts) to help us improve the app. This data cannot be used to identify you personally.\n• **Crash Reports:** If the app crashes, a crash report (device model, OS version, stack trace) may be sent automatically to help us fix bugs. No personal content is included.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `We use the information we collect to:\n\n• Provide, maintain, and improve Thinkora's features\n• Diagnose and fix technical issues\n• Respond to your support requests and feedback\n• Send important service announcements (e.g. security updates)\n\nWe do not sell, rent, or share your personal information with third parties for marketing purposes.`,
  },
  {
    title: '3. Data Storage & Security',
    body: `Your app data (notes, tasks, habits, etc.) is stored locally on your device using encrypted storage. We implement industry-standard security measures including:\n\n• AES-256 encryption for locally stored data\n• TLS/HTTPS for all network communication\n• Regular security audits of our infrastructure\n\nWhile we take reasonable precautions, no method of transmission or storage is 100% secure. We encourage you to use a strong device passcode.`,
  },
  {
    title: '4. Third-Party Services',
    body: `Thinkora may integrate with the following third-party services. Each has its own privacy policy:\n\n• **Google Sign-In** – for optional account authentication\n• **Firebase** – for optional cloud backup and crash reporting\n• **RevenueCat** – for in-app purchase management\n\nWe only share the minimum data required for these integrations to function.`,
  },
  {
    title: '5. Data Retention',
    body: `We retain your data for as long as your account is active or as needed to provide services. If you delete your account:\n\n• Local data is removed immediately when you uninstall the app\n• Server-side data (if cloud sync was enabled) is permanently deleted within 30 days\n• Anonymised analytics data may be retained indefinitely as it cannot identify you`,
  },
  {
    title: '6. Your Rights',
    body: `Depending on your location, you may have the following rights regarding your personal data:\n\n• **Access:** Request a copy of your personal data\n• **Correction:** Update inaccurate or incomplete data\n• **Deletion:** Request deletion of your personal data ("right to be forgotten")\n• **Portability:** Receive your data in a machine-readable format\n• **Objection:** Object to certain processing activities\n\nTo exercise any of these rights, contact us at privacy@thinkora.app.`,
  },
  {
    title: '7. Children\'s Privacy',
    body: `Thinkora is not directed at children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately and we will delete it promptly.`,
  },
  {
    title: '8. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time. When we make significant changes, we will notify you via an in-app notification or email. The "Last Updated" date at the top of this page reflects the most recent revision. Continued use of the app after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: '9. Contact Us',
    body: `If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:\n\n📧 privacy@thinkora.app\n🌐 thinkora.app/privacy\n\nWe aim to respond to all inquiries within 5 business days.`,
  },
];

export function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const s = styles(theme, insets);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name="shield-checkmark" size={36} color="#6366F1" />
          </View>
          <Text style={s.heroTitle}>Your Privacy Matters</Text>
          <Text style={s.heroSub}>Last updated: {LAST_UPDATED}</Text>
          <Text style={s.heroBody}>
            Thinkora is built on a foundation of trust. This policy explains what data we collect, why we collect it, and how we protect it. We believe in full transparency — no hidden tracking, no selling your data.
          </Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={s.footer}>
          <Ionicons name="lock-closed" size={16} color={theme.colors.textMuted} />
          <Text style={s.footerText}> Thinkora · privacy@thinkora.app</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (theme: any, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    backBtn: {
      width: 36,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: 0.2,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: insets.bottom + 32,
    },
    hero: {
      alignItems: 'center',
      paddingVertical: 28,
    },
    heroIcon: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: '#6366F115',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 4,
    },
    heroSub: {
      fontSize: 13,
      color: theme.colors.textMuted,
      marginBottom: 14,
    },
    heroBody: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    section: {
      marginBottom: 24,
      backgroundColor: theme.colors.card,
      borderRadius: 14,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 10,
    },
    sectionBody: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 8,
      paddingBottom: 4,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
  });
