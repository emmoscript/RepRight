import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/routeTypes';
import { getSession, type SessionLog } from '@/modules/session';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { exerciseDisplayName } from '@/utils/statsFilters';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'SessionDetail'>;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtElapsed(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function scoreColor(sc: number) {
  if (sc >= 90) return colors.primary_green;
  if (sc >= 70) return colors.accent_green_light;
  if (sc >= 50) return colors.accent_yellow;
  return colors.accent_red;
}

function legacySummary(log: SessionLog) {
  const s = log.summary;
  const plannedReps = s.plannedReps ?? s.totalReps;
  const formScore = s.formScore ?? s.avgScore;
  const completionPct = s.completionPct ?? 100;
  return { ...s, plannedReps, formScore, completionPct };
}

export function SessionDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [log, setLog] = useState<SessionLog | null>(null);

  useEffect(() => {
    void getSession(route.params.sessionId).then(setLog);
  }, [route.params.sessionId]);

  if (!log) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const summary = legacySummary(log);
  const sets = log.setSummaries?.length
    ? log.setSummaries
    : log.sets.map((st) => ({
        setNumber: st.setNumber,
        repsCompleted: st.reps.length,
        repsPlanned: st.reps.length,
        weightAmount: 0,
        weightUnit: 'kg' as const,
        elapsedSec: 0,
        formScore: Math.round(st.reps[0]?.score ?? summary.formScore),
      }));

  const accent = scoreColor(summary.avgScore);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => nav.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={colors.text_primary} />
          </Pressable>
          <Text style={styles.topTitle}>Session detail</Text>
          <View style={styles.backBtnSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.exercise}>{exerciseDisplayName(log.exercise || 'conventional_deadlift')}</Text>
          <Text style={styles.date}>{fmtDate(log.date)}</Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLab}>Performance</Text>
            <Text style={[styles.scoreNum, { color: accent }]}>{Math.round(summary.avgScore)}%</Text>
            <View style={styles.scoreRow}>
              <MetricChip label="Form" value={`${Math.round(summary.formScore)}%`} />
              <MetricChip label="Reps" value={`${summary.totalReps}/${summary.plannedReps}`} />
              <MetricChip label="Completion" value={`${Math.round(summary.completionPct)}%`} />
            </View>
          </View>

          <Text style={styles.sectionLab}>Sets</Text>
          {sets.map((row) => {
            const repOk = row.repsCompleted >= row.repsPlanned;
            return (
              <View key={row.setNumber} style={styles.setRow}>
                <View style={styles.setRowTop}>
                  <Text style={styles.setNum}>Set {row.setNumber}</Text>
                  <Text style={[styles.setReps, !repOk && styles.setRepsWarn]}>
                    {row.repsCompleted}/{row.repsPlanned} reps
                  </Text>
                </View>
                <Text style={styles.setMeta}>
                  {row.weightAmount > 0 ? `${row.weightAmount} ${row.weightUnit} · ` : ''}
                  Form {row.formScore}%
                  {row.elapsedSec > 0 ? ` · ${fmtElapsed(row.elapsedSec)}` : ''}
                </Text>
              </View>
            );
          })}

          {summary.mostFrequentError ? (
            <>
              <Text style={styles.sectionLab}>Top issue</Text>
              <Text style={styles.errorTxt}>{summary.mostFrequentError}</Text>
            </>
          ) : null}

          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLab}>{label}</Text>
      <Text style={styles.chipVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3 },
  safe: { flex: 1 },
  loading: { color: colors.text_secondary, textAlign: 'center', marginTop: 40 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bg_elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnSpacer: { width: 42 },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodyLg,
  },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  exercise: {
    marginTop: 8,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.titleSm + 8,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  date: { marginTop: 6, color: colors.text_muted, fontSize: typography.fontSize.bodySm },
  scoreCard: {
    marginTop: 24,
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary_green,
  },
  scoreLab: {
    color: colors.text_muted,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  scoreNum: {
    marginTop: 8,
    fontFamily: typography.fontFamily.display,
    fontSize: 48,
  },
  scoreRow: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.bg_elevated,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 88,
  },
  chipLab: { color: colors.text_muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  chipVal: { marginTop: 4, color: colors.text_primary, fontFamily: typography.fontFamily.bold, fontSize: 15 },
  sectionLab: {
    marginTop: 28,
    marginBottom: 10,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  setRow: {
    backgroundColor: colors.bg_elevated,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  setRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  setNum: { color: colors.text_primary, fontFamily: typography.fontFamily.bold, fontSize: 16 },
  setReps: { color: colors.primary_green, fontFamily: typography.fontFamily.bold, fontSize: 15 },
  setRepsWarn: { color: colors.accent_yellow },
  setMeta: { marginTop: 6, color: colors.text_secondary, fontSize: 13 },
  errorTxt: { color: colors.text_secondary, fontSize: 14, fontFamily: typography.fontFamily.medium },
});
