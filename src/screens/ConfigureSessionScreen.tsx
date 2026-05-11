import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RepRightHeader } from '@/components/RepRightHeader';
import type { MainTabCompositeNav } from '@/navigation/routeTypes';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const SET_OPTS = [2, 3, 4, 5] as const;

export function ConfigureSessionScreen() {
  const nav = useNavigation<MainTabCompositeNav>();
  const numSets = useSessionConfigStore((s) => s.setCount);
  const patch = useSessionConfigStore((s) => s.patch);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RepRightHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Configure</Text>
        <Text style={styles.meta}>Performance session · v2.4</Text>

        <Text style={styles.lab}>Select exercise</Text>
        <View style={styles.exActive}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text_primary, fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.bodyLg }}>
              Deadlift
            </Text>
            <Ionicons name="checkmark-circle" color={colors.primary_green} size={26} />
          </View>
          <Text style={styles.trackLab}>HIGH INTENSITY TRACKING</Text>
          <Text style={{ color: colors.text_secondary, marginTop: 8, fontSize: typography.fontSize.captions, lineHeight: 18 }}>
            Conventional barbell · full ROM logging
          </Text>
        </View>

        <View style={[styles.exLock, styles.exMuted]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.lockTitle]}>Squat</Text>
            <Ionicons name="lock-closed-outline" color={colors.text_muted} size={22} />
          </View>
          <Text style={styles.lockSub}>Coming soon</Text>
        </View>

        <View style={[styles.exLock, styles.exMuted]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.lockTitle]}>Romanian Deadlift</Text>
            <Ionicons name="lock-closed-outline" color={colors.text_muted} size={22} />
          </View>
          <Text style={styles.lockSub}>Coming soon</Text>
        </View>

        <Text style={[styles.lab, { marginTop: 26 }]}>Number of sets</Text>
        <View style={styles.pillRow}>
          {SET_OPTS.map((n) => {
            const on = numSets === n;
            return (
              <Pressable
                key={n}
                onPress={() => patch({ setCount: n })}
                style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
              >
                <Text style={[styles.pillTxt, on ? styles.pillTxtOn : styles.pillTxtOff]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" color={colors.primary_green} size={26} />
          <Text style={styles.infoTxt}>Reps will be counted automatically during the lift.</Text>
        </View>

        <View style={styles.miniGrid}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLab}>LAST PERFORMANCE</Text>
            <Text style={styles.miniVal}>— kg</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLab}>Recovery</Text>
            <Text style={[styles.miniVal, { color: colors.primary_green }]}>—%</Text>
          </View>
        </View>

        <PrimaryButton title="START SESSION →" onPress={() => nav.navigate('LiveSession')} style={{ marginTop: 28 }} />
        <View style={{ height: 104 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg_v3 },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  title: {
    marginTop: 8,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.screenTitle,
    letterSpacing: -2,
    textTransform: 'uppercase',
  },
  meta: {
    marginTop: 8,
    color: colors.text_secondary,
    letterSpacing: typography.letterSpacing.capsWide,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 2,
    textTransform: 'uppercase',
  },
  lab: {
    marginTop: 22,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  exActive: {
    marginTop: 12,
    backgroundColor: colors.bg_elevated,
    borderRadius: 14,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary_green,
  },
  trackLab: {
    marginTop: 10,
    color: colors.primary_green,
    letterSpacing: typography.letterSpacing.capsWide,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.captionCaps + 1,
    textTransform: 'uppercase',
  },
  exLock: {
    marginTop: 12,
    backgroundColor: colors.bg_elevated,
    borderRadius: 14,
    padding: 16,
  },
  exMuted: { opacity: 0.45 },
  lockTitle: { color: colors.text_primary, fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.body },
  lockSub: { color: colors.text_muted, fontSize: 12, marginTop: 10 },
  pillRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    justifyContent: 'space-between',
  },
  pill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillOn: { backgroundColor: colors.primary_green },
  pillOff: { backgroundColor: colors.bg_elevated },
  pillTxt: { fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.bodyLg },
  pillTxtOn: { color: colors.text_on_green },
  pillTxtOff: { color: colors.text_secondary },
  infoRow: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  infoTxt: { flex: 1, color: colors.text_secondary, fontSize: typography.fontSize.bodySm, lineHeight: 21 },
  miniGrid: { flexDirection: 'row', gap: 14, marginTop: 26 },
  miniCard: { flex: 1, borderRadius: 14, padding: 16, backgroundColor: colors.surface_v3 },
  miniLab: { color: colors.text_muted, fontSize: typography.fontSize.captionCaps + 1, letterSpacing: 1 },
  miniVal: { marginTop: 10, fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.titleSm + 6, color: colors.text_primary },
});
