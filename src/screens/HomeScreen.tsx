import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BiomechSurveyPrompt } from '@/components/BiomechSurveyPrompt';
import { Icon, ICONS } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RepRightHeader } from '@/components/RepRightHeader';
import { SvgPlayIcon, SvgTrendingUpIcon } from '@/components/icons/SvgUiIcons';
import type { MainTabCompositeNav } from '@/navigation/routeTypes';
import { getAllSessions, type SessionLog } from '@/modules/session';
import {
  markBiomechSurveyPrompted,
  shouldShowBiomechSurveyPrompt,
} from '@/constants/researchSurvey';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { resolveDisplayName } from '@/utils/displayName';
import { timeGreetingI18nKey, timeGreetingPeriod, timeReadyLiftI18nKey } from '@/utils/timeGreeting';

function formatDateShort(iso: string, months: string[]): string {
  const d = new Date(iso);
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

function sessionDurationMinutes(log: SessionLog): number | null {
  let minTs = Infinity;
  let maxTs = 0;
  for (const st of log.sets) {
    for (const r of st.reps) {
      minTs = Math.min(minTs, r.startTimestamp);
      maxTs = Math.max(maxTs, r.endTimestamp);
    }
  }
  if (!Number.isFinite(minTs) || maxTs <= minTs) return null;
  return Math.max(1, Math.round((maxTs - minTs) / 60000));
}

function parseIso(ts: string): number {
  return new Date(ts).getTime();
}

function repsRolling7Days(sessions: SessionLog[], anchor: Date, offsetWeeks: number): number {
  const end = anchor.getTime() - offsetWeeks * 7 * 24 * 60 * 60 * 1000;
  const start = end - 7 * 24 * 60 * 60 * 1000;
  return sessions.reduce((acc, s) => {
    const t = parseIso(s.date);
    if (t >= start && t < end) return acc + (s.summary?.totalReps ?? 0);
    return acc;
  }, 0);
}

function scoreTone(score: number, t: (key: string) => string) {
  if (score >= 90) return { bar: colors.primary_green, headline: colors.primary_green, sub: t('common.performance') };
  if (score >= 70) {
    return { bar: colors.accent_green_light, headline: colors.primary_green, sub: t('common.performance') };
  }
  if (score >= 50) {
    return { bar: colors.accent_yellow, headline: colors.accent_yellow, sub: t('common.underTarget') };
  }
  return { bar: colors.accent_red, headline: colors.accent_red, sub: t('common.underTarget') };
}

export function HomeScreen() {
  const { t, i18n } = useTranslation();
  const nav = useNavigation<MainTabCompositeNav>();
  const isGuest = useAuthStore((s) => s.isGuest);
  const email = useAuthStore((s) => s.user?.email ?? null);
  const displayNamePref = useUserPreferencesStore((s) => s.displayName);

  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [surveyPromptVisible, setSurveyPromptVisible] = useState(false);
  const [greetingTick, setGreetingTick] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setGreetingTick(Date.now());
      const clockId = setInterval(() => setGreetingTick(Date.now()), 60_000);

      void (async () => {
        const list = await getAllSessions();
        if (!active) return;
        const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
        setSessions(sorted);

        if (sorted.length >= 1 && (await shouldShowBiomechSurveyPrompt(sorted.length))) {
          await markBiomechSurveyPrompted(sorted.length);
          if (active) setSurveyPromptVisible(true);
        }
      })();
      return () => {
        active = false;
        clearInterval(clockId);
      };
    }, []),
  );

  const shortMonths = useMemo(
    () => t('months.short', { returnObjects: true }) as string[],
    [t],
  );

  const greetingPeriod = useMemo(
    () => timeGreetingPeriod(new Date(greetingTick).getHours()),
    [greetingTick],
  );

  const greeting = useMemo(
    () => t(timeGreetingI18nKey(greetingPeriod)),
    [t, greetingPeriod],
  );

  const readyLift = useMemo(
    () => t(timeReadyLiftI18nKey(greetingPeriod)),
    [t, greetingPeriod],
  );

  const displayName = useMemo(
    () => resolveDisplayName({ displayName: displayNamePref, email, isGuest }),
    [displayNamePref, email, isGuest, i18n.language],
  );

  const latest = sessions[0] ?? null;
  const recent = sessions.slice(0, 2);
  const sessionCount = sessions.length;

  const lastScore = latest ? Math.round(latest.summary.avgScore) : null;
  const lastSets = latest?.sets?.length ?? 0;
  const lastReps = latest?.summary.totalReps ?? 0;

  const weeklyPct = useMemo(() => {
    const anchor = new Date();
    const cur = repsRolling7Days(sessions, anchor, 0);
    const prev = repsRolling7Days(sessions, anchor, 1);
    if (prev <= 0 && cur <= 0) return 0;
    if (cur <= 0) return 0;
    if (prev <= 0) return 100;
    return ((cur - prev) / prev) * 100;
  }, [sessions]);

  const weeklyPctLabel = useMemo(() => {
    if (weeklyPct === 0) return '0%';
    return `${weeklyPct >= 0 ? '+' : ''}${weeklyPct.toFixed(1)}%`;
  }, [weeklyPct]);

  const barHeightsPct = useMemo(() => {
    const chunk = sessions.slice(0, 5).map((s) => s.summary.totalReps);
    const mx = Math.max(...chunk, 1);
    return chunk.map((r) => Math.max(12, Math.round((r / mx) * 100)));
  }, [sessions]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <RepRightHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.greetingName}>{displayName}</Text>
        <Text style={styles.subGreeting}>{readyLift}</Text>

        <PrimaryButton
          title={t('home.startSession')}
          trailing={<SvgPlayIcon color={colors.text_on_green} size={28} />}
          onPress={() => nav.navigate('Workout')}
          style={styles.heroCta as ViewStyle}
        />

        {/* Bento: Last session + quick stats */}
        <View style={styles.bentoRow}>
          <View style={styles.lastCard}>
            <View style={styles.lastDecor} pointerEvents="none">
              <Icon name={ICONS.barbellOutline} size={76} color={colors.text_muted} />
            </View>

            <View style={styles.lastTop}>
              <View style={styles.lastTopTxt}>
                <Text style={styles.lastCardLabel}>{t('home.lastSession')}</Text>
                {latest ? (
                  <>
                    <Text style={styles.lastCardDateLine}>{formatDateShort(latest.date, shortMonths)}</Text>
                    <Text
                      style={styles.lastCardSummaryLine}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      {t('common.summary')}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.lastCardSummaryLine} numberOfLines={2}>
                    {t('home.noSessionYet')}
                  </Text>
                )}
              </View>
              {lastScore != null ? (
                <View style={styles.scorePill}>
                  <Text style={styles.scorePillTxt}>{lastScore}%</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.lastBottom}>
              <View style={styles.lastMetrics}>
                <View style={styles.metricBlock}>
                  <Text style={styles.metricLab}>{t('common.sets')}</Text>
                  <Text style={styles.metricVal}>{latest ? lastSets : '—'}</Text>
                </View>
                <View style={[styles.metricBlock, styles.metricBlockSpaced]}>
                  <Text style={styles.metricLab}>{t('common.reps')}</Text>
                  <Text style={styles.metricVal}>{latest ? lastReps : '—'}</Text>
                </View>
              </View>
              <View style={styles.lastMiniIcon}>
                <Icon name={ICONS.barbell} size={36} color={colors.primary_green} />
              </View>
            </View>
          </View>

          <View style={styles.quickCol}>
            <View style={[styles.miniStat, styles.miniStatSpacing]}>
              <Text style={styles.miniStatLab}>{t('home.totalSessions')}</Text>
              <Text style={styles.miniStatValGreen}>{sessionCount}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLab}>{t('home.currentStreak')}</Text>
              <View style={styles.streakRow}>
                <Text style={styles.miniStatVal}>12</Text>
                <Text style={styles.streakEmoji} accessibilityLabel="Streak flame">
                  {'🔥'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionEyebrow}>{t('home.recentActivity')}</Text>
        <View style={styles.activityStack}>
          {recent.length > 0 ? (
            recent.map((s) => {
              const sc = Math.round(s.summary.avgScore);
              const tone = scoreTone(sc, t);
              const mins = sessionDurationMinutes(s);
              const subParts = [`${formatDateShort(s.date, shortMonths)}`];
              if (mins != null) subParts.push(`${mins} ${t('home.min')}`);
              const subLine = subParts.join(' • ');
              return (
                <View key={s.sessionId} style={styles.activityRow}>
                  <View style={[styles.activityBar, { backgroundColor: tone.bar }]} />
                  <View style={styles.activityMid}>
                    <Text style={styles.activityTitle}>{t('common.deadlift')}</Text>
                    <Text style={styles.activitySub}>{`${t('home.formSession')} · ${subLine}`}</Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={[styles.activityScore, { color: tone.headline }]}>{sc}%</Text>
                    <Text style={styles.activityPerf}>{tone.sub}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.activityRow}>
              <View style={[styles.activityBar, { backgroundColor: colors.border_subtle }]} />
              <View style={styles.activityMid}>
                <Text style={styles.activityTitle}>{t('home.noRecentSessions')}</Text>
                <Text style={styles.activitySub}>{t('home.startToLog')}</Text>
              </View>
              <View style={styles.activityRight}>
                <Text style={[styles.activityScore, { color: colors.text_muted }]}>—</Text>
                <Text style={styles.activityPerf}>{t('common.idle')}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.volumeBanner}>
          <View style={styles.volDecoWrap} pointerEvents="none">
            <SvgTrendingUpIcon color={colors.text_primary} size={120} />
          </View>
          <View style={styles.volInner}>
            <View style={styles.volLeft}>
              <Text style={styles.volPct}>{weeklyPctLabel}</Text>
              <Text style={styles.volCap}>{t('home.weeklyVolume')}</Text>
              <Text style={styles.volHint}>{t('home.weeklyHint')}</Text>
            </View>
            <View style={styles.volBars}>
              {(barHeightsPct.length ? barHeightsPct : [40, 60, 55, 75, 90]).map((h, idx, arr) => {
                const isLast = idx === arr.length - 1;
                return (
                  <View
                    // eslint-disable-next-line react/no-array-index-key -- static decorative bars
                    key={idx}
                    style={[
                      styles.volBar,
                      idx > 0 ? styles.volBarSpaced : null,
                      {
                        height: 48 * (h / 100),
                        backgroundColor: isLast ? colors.primary_green : colors.bg_high,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <BiomechSurveyPrompt
        visible={surveyPromptVisible}
        isGuest={isGuest}
        accountEmail={email}
        onDismiss={() => setSurveyPromptVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg_v3 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 28 },

  greeting: {
    marginTop: 12,
    color: colors.text_primary,
    fontSize: typography.fontSize.hero - 6,
    fontFamily: typography.fontFamily.display,
    lineHeight: (typography.fontSize.hero - 6) * 1.06,
    letterSpacing: -0.9,
    fontWeight: '700',
  },
  greetingName: {
    marginTop: 4,
    color: colors.text_primary,
    fontSize: typography.fontSize.hero - 6,
    fontFamily: typography.fontFamily.display,
    lineHeight: (typography.fontSize.hero - 6) * 1.06,
    letterSpacing: -0.9,
    fontWeight: '700',
  },
  subGreeting: {
    marginTop: 10,
    color: colors.text_secondary,
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  heroCta: { marginTop: 24, borderRadius: 14, minHeight: 80 },

  bentoRow: { flexDirection: 'row', marginTop: 28, alignItems: 'stretch' },
  lastCard: {
    flex: 1.55,
    minWidth: 0,
    marginRight: 16,
    backgroundColor: colors.bg_elevated,
    borderRadius: 12,
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
    minHeight: 220,
  },
  quickCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  miniStatSpacing: { marginBottom: 16 },
  lastDecor: { position: 'absolute', bottom: -12, right: -8, opacity: 0.14 },

  lastTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lastTopTxt: { flex: 1, paddingRight: 10 },
  lastCardLabel: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  scorePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bg_high,
  },
  scorePillTxt: {
    fontFamily: typography.fontFamily.display,
    color: colors.primary_green,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.3,
  },
  lastCardDateLine: {
    fontFamily: typography.fontFamily.display,
    color: colors.text_primary,
    fontWeight: '700',
    fontSize: 22,
    letterSpacing: -0.5,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  lastCardSummaryLine: {
    marginTop: 2,
    fontFamily: typography.fontFamily.display,
    color: colors.text_primary,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  lastBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18 },
  lastMetrics: { flexDirection: 'row', alignItems: 'flex-end' },
  metricBlock: {},
  metricBlockSpaced: { marginLeft: 32 },
  metricLab: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricVal: {
    fontFamily: typography.fontFamily.display,
    fontSize: 32,
    color: colors.text_primary,
    fontWeight: '700',
    letterSpacing: -1,
  },
  lastMiniIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.green_subtle_bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -2,
  },

  miniStat: {
    flex: 1,
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    padding: 18,
    justifyContent: 'center',
  },
  miniStatLab: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  miniStatValGreen: {
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 36,
    color: colors.primary_green,
    letterSpacing: -1.2,
  },
  miniStatVal: {
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 36,
    color: colors.text_primary,
    letterSpacing: -1.2,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  streakEmoji: { fontSize: 26, marginLeft: 6, lineHeight: 30 },
  sectionEyebrow: {
    marginTop: 32,
    marginBottom: 20,
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  activityStack: {},

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    paddingVertical: 2,
  },
  activityBar: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 999,
    marginRight: 14,
  },
  activityMid: { flex: 1, minWidth: 0 },
  activityRight: { alignItems: 'flex-end', marginLeft: 12 },
  activityTitle: {
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 18,
    color: colors.text_primary,
    letterSpacing: -0.3,
  },
  activitySub: {
    marginTop: 4,
    color: colors.text_secondary,
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    letterSpacing: 0.2,
  },
  activityScore: { fontFamily: typography.fontFamily.display, fontWeight: '700', fontSize: 20, letterSpacing: -0.2 },
  activityPerf: {
    marginTop: 4,
    color: colors.text_secondary,
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  volumeBanner: {
    marginTop: 26,
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 120,
  },
  volDecoWrap: {
    position: 'absolute',
    bottom: -30,
    right: -36,
    opacity: 0.05,
    pointerEvents: 'none',
  },
  volInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  volLeft: { flex: 1, paddingRight: 12 },
  volPct: {
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 40,
    color: colors.text_primary,
    letterSpacing: -2,
    lineHeight: 42,
  },
  volCap: {
    marginTop: 8,
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  volHint: {
    marginTop: 6,
    color: colors.text_muted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.fontFamily.regular,
  },
  volBars: { flexDirection: 'row', alignItems: 'flex-end', height: 48 },
  volBar: { width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  volBarSpaced: { marginLeft: 4 },
});
