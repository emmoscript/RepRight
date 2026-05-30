import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RepRightHeader } from '@/components/RepRightHeader';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const participantId = useAuthStore((s) => s.participantId);
  const email = useAuthStore((s) => s.user?.email ?? null);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const [notifOn, setNotifOn] = React.useState(true);

  const display =
    email?.split('@')[0]?.replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? 'Athlete';

  const handleSignOut = async () => {
    await signOut();
    nav.navigate('Demo');
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <RepRightHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{display.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.ver}>
            <Ionicons name="checkmark-circle" size={26} color={colors.primary_green} />
          </View>
        </View>

        <Text style={styles.name}>{display}</Text>
        {email ? <Text style={styles.emailSub}>{email}</Text> : null}
        <View style={styles.pillId}>
          <Text style={styles.pillTxt}>Participant · {participantId}</Text>
        </View>

        <View style={styles.statRow}>
          <StatChip label="Best form %" value="—" />
          <StatChip label="Sessions" value="—" />
          <StatChip label="Streak" value="🔥 —" />
        </View>

        <View style={styles.studyCard}>
          <Ionicons
            name="document-text-outline"
            size={24}
            color={colors.primary_green}
            style={{ marginRight: 14 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.studyTitle}>Study participant</Text>
            <Text style={styles.studyMuted}>
              Enrollment · Thesis cohort · {isLoggedIn ? 'Active' : 'Guest'}
            </Text>
          </View>
        </View>

        <View style={styles.settingsBlock}>
          <RowToggle label="Notifications" value={notifOn} onChange={setNotifOn} />
          <RowChevron label="Camera prefs" />
          <RowChevron label="Units" subtitle="Metric" />
        </View>

        <Pressable
          style={[styles.signOutGhost, isLoading && styles.signOutDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading }}
          onPress={() => void handleSignOut()}
          disabled={isLoading}
        >
          <Text style={styles.signOutTxt}>{isLoading ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>

        <Text style={styles.verSmall}>RepRight thesis build</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip(props: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statVal}>{props.value}</Text>
      <Text style={styles.statLab}>{props.label}</Text>
    </View>
  );
}

function RowChevron(props: { label: string; subtitle?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLab}>{props.label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {props.subtitle ? (
          <Text style={{ fontFamily: typography.fontFamily.bold, color: colors.primary_green }}>
            {props.subtitle}
          </Text>
        ) : null}
        <Ionicons name="chevron-forward" color={colors.text_muted} size={20} />
      </View>
    </View>
  );
}

function RowToggle(props: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLab}>{props.label}</Text>
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        trackColor={{ false: '#333', true: colors.primary_green }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg_v3 },
  scroll: { paddingHorizontal: 24, paddingBottom: 100 },
  avatarWrap: { alignSelf: 'center', marginTop: 8 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primary_green,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg_elevated,
  },
  avatarTxt: { fontFamily: typography.fontFamily.bold, fontSize: 34, color: colors.text_primary },
  ver: { position: 'absolute', right: -4, bottom: 6 },
  name: {
    marginTop: 22,
    textAlign: 'center',
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.bodyLg + 12,
    color: colors.text_primary,
    letterSpacing: -0.3,
    textTransform: 'capitalize',
  },
  emailSub: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.captions,
    color: colors.text_muted,
  },
  pillId: {
    alignSelf: 'center',
    marginTop: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary_green,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillTxt: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.captions,
  },
  statRow: { flexDirection: 'row', marginTop: 28, gap: 10 },
  statChip: {
    flex: 1,
    backgroundColor: colors.surface_v3,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statVal: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
  },
  statLab: {
    marginTop: 8,
    color: colors.text_muted,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  studyCard: {
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: colors.green_subtle_bg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary_green,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studyTitle: { fontFamily: typography.fontFamily.bold, color: colors.text_primary, fontSize: 16 },
  studyMuted: { marginTop: 6, fontSize: 13, color: colors.text_secondary },
  settingsBlock: { marginTop: 22, gap: 10 },
  row: {
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  rowLab: { fontFamily: typography.fontFamily.medium, color: colors.text_primary },
  signOutGhost: {
    marginTop: 28,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth + 2,
    borderColor: colors.accent_red + '69',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutDisabled: { opacity: 0.5 },
  signOutTxt: { color: colors.accent_red, fontFamily: typography.fontFamily.bold, fontSize: 15 },
  verSmall: {
    marginTop: 28,
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.text_muted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
