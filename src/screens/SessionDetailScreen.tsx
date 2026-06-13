import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormBreakdownCard } from '@/components/session/FormBreakdownCard';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { getSession, type SessionLog } from '@/modules/session';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { extractFormErrorsFromSessionLog } from '@/utils/formBreakdown';
import { exerciseDisplayName } from '@/utils/statsFilters';
import { weightUnitSuffix } from '@/utils/weightUnits';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'SessionDetail'>;

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
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [log, setLog] = useState<SessionLog | null>(null);

  useEffect(() => {
    void getSession(route.params.sessionId).then(setLog);
  }, [route.params.sessionId]);

  const shortMonths = useMemo(
    () => t('months.short', { returnObjects: true }) as string[],
    [t],
  );

  const formErrors = useMemo(
    () => (log ? extractFormErrorsFromSessionLog(log) : []),
    [log],
  );

  if (!log) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>{t('sessionDetail.loading')}</Text>
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

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const month = shortMonths[d.getMonth()] ?? '';
    return `${month} ${d.getDate()}, ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const fmtElapsed = (sec: number) =>
    `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const fmtWeight = (amount: number, unit: string) => {
    const rounded = Math.round(amount * 10) / 10;
    const body = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
    return `${body} ${weightUnitSuffix(unit === 'kg' ? 'kg' : 'lb')}`;
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => nav.goBack()}
            style={styles.backBtn}
            accessibilityLabel={t('sessionDetail.goBack')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text_primary} />
          </Pressable>
          <Text style={styles.topTitle}>{t('sessionDetail.title')}</Text>
          <View style={styles.backBtnSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.exercise}>
            {exerciseDisplayName(log.exercise || 'conventional_deadlift')}
          </Text>
          <Text style={styles.date}>{fmtDate(log.date)}</Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLab}>{t('sessionDetail.performance')}</Text>
            <Text style={[styles.scoreNum, { color: accent }]}>
              {Math.round(summary.avgScore)}%
            </Text>
            <View style={styles.scoreRow}>
              <MetricChip label={t('sessionComplete.form')} value={`${Math.round(summary.formScore)}%`} />
              <View style={styles.metricDivider} />
              <MetricChip
                label={t('common.reps')}
                value={`${summary.totalReps}/${summary.plannedReps}`}
              />
              <View style={styles.metricDivider} />
              <MetricChip
                label={t('sessionComplete.completion')}
                value={`${Math.round(summary.completionPct)}%`}
              />
            </View>
          </View>

          <Text style={styles.sectionLab}>{t('sessionDetail.sets')}</Text>
          {sets.map((row) => {
            const repOk = row.repsCompleted >= row.repsPlanned;
            return (
              <View key={row.setNumber} style={styles.setRow}>
                <View style={styles.setRowLeft}>
                  <Text style={styles.setNum}>
                    {t('deadliftConfigure.setLabel', { n: row.setNumber })}
                  </Text>
                  <Text style={styles.setMeta}>
                    {row.weightAmount > 0 ? `${fmtWeight(row.weightAmount, row.weightUnit)} · ` : ''}
                    {t('sessionComplete.form')} {row.formScore}%
                    {row.elapsedSec > 0 ? ` · ${fmtElapsed(row.elapsedSec)}` : ''}
                  </Text>
                </View>
                <Text style={[styles.setReps, !repOk && styles.setRepsWarn]}>
                  {row.repsCompleted}/{row.repsPlanned} {t('common.repsLower')}
                </Text>
              </View>
            );
          })}

          <FormBreakdownCard errors={formErrors} variant="compact" style={styles.breakdownCard} />

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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 16,
    backgroundColor: colors.bg_elevated,
    borderRadius: 12,
    overflow: 'hidden',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border_subtle,
    marginVertical: 10,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  chipLab: {
    color: colors.text_muted,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  chipVal: {
    marginTop: 4,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 15,
    textAlign: 'center',
  },
  sectionLab: {
    marginTop: 28,
    marginBottom: 10,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  breakdownCard: {
    marginTop: 28,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg_elevated,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  setRowLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  setNum: { color: colors.text_primary, fontFamily: typography.fontFamily.bold, fontSize: 16 },
  setReps: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: 15,
    textAlign: 'right',
    flexShrink: 0,
  },
  setRepsWarn: { color: colors.accent_yellow },
  setMeta: { marginTop: 6, color: colors.text_secondary, fontSize: 13 },
});
