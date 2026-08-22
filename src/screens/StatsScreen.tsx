import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RepRightHeader } from '@/components/RepRightHeader';
import { Icon, ICONS } from '@/components/Icon';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { getAllSessions, type SessionLog } from '@/modules/session';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import {
  exerciseDisplayName,
  filterSessionsByPeriod,
  groupSessionsByExercise,
  type StatsFilterKind,
} from '@/utils/statsFilters';
import { summarizeSessionFormFocus } from '@/utils/formBreakdown';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FREE_STATS_PREVIEW_COUNT = 3;

function sessionPerformance(log: SessionLog): number {
  return Math.round(log.summary.avgScore);
}

function sessionRepsCompleted(log: SessionLog): { done: number; planned: number } {
  const s = log.summary;
  return { done: s.totalReps, planned: s.plannedReps ?? s.totalReps };
}

function fmtCardDate(iso: string, months: string[]): string {
  const d = new Date(iso);
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtCardTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function sessionFormFocusChipText(
  focus: ReturnType<typeof summarizeSessionFormFocus>,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const { previewIds, totalUnique } = focus;
  if (totalUnique === 0) return t('stats.cleanForm');
  const issues = previewIds.map((id) => t(`formErrorTitles.${id}`)).join(' · ');
  if (totalUnique <= 2) return issues;
  return t('stats.formIssuesMore', { issues, count: totalUnique - 2 });
}

function scoreAccent(sc: number) {
  if (sc >= 90) return colors.primary_green;
  if (sc >= 70) return colors.accent_green_light;
  if (sc >= 50) return colors.accent_yellow;
  return colors.accent_red;
}

export function StatsScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const subscribed = useSubscriptionStore((s) => s.subscribed);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [refresh, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatsFilterKind>('week');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setRefreshing(true);
    const data = await getAllSessions();
    setSessions(data.sort((a, b) => b.date.localeCompare(a.date)));
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const longMonths = useMemo(
    () => t('months.long', { returnObjects: true }) as string[],
    [t],
  );

  const filtered = useMemo(
    () => filterSessionsByPeriod(sessions, filter),
    [sessions, filter],
  );

  const grouped = useMemo(() => groupSessionsByExercise(filtered), [filtered]);

  const peak = filtered.length
    ? Math.max(...filtered.map((s) => sessionPerformance(s)))
    : null;

  const toggleExpanded = (exerciseId: string) => {
    if (!subscribed) {
      nav.navigate('SubscriptionOffer', { source: 'stats' });
      return;
    }
    setExpanded((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  };

  const onFilterPress = (next: StatsFilterKind) => {
    if (next === 'month' && !subscribed) {
      nav.navigate('SubscriptionOffer', { source: 'stats' });
      return;
    }
    setFilter(next);
  };

  const previewCount = subscribed ? Number.MAX_SAFE_INTEGER : FREE_STATS_PREVIEW_COUNT;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <RepRightHeader />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refresh} onRefresh={load} tintColor={colors.primary_green} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>{t('stats.title')}</Text>
        <Text style={styles.meta}>{t('stats.meta')}</Text>

        {!subscribed ? (
          <Pressable
            style={styles.premiumBanner}
            onPress={() => nav.navigate('SubscriptionOffer', { source: 'stats' })}
          >
            <Ionicons name="lock-closed-outline" size={18} color={colors.primary_green} />
            <Text style={styles.premiumBannerTxt}>{t('stats.premiumUpsell')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text_muted} />
          </Pressable>
        ) : null}

        <View style={styles.filt}>
          <Pill tab={t('stats.thisWeek')} selected={filter === 'week'} onPress={() => onFilterPress('week')} />
          <Pill tab={t('stats.lastWeek')} selected={filter === 'last'} onPress={() => onFilterPress('last')} />
          <Pill
            tab={t('stats.monthly')}
            selected={filter === 'month'}
            onPress={() => onFilterPress('month')}
            locked={!subscribed}
          />
        </View>

        <View style={styles.peakCard}>
          <Text style={styles.peakLab}>{t('stats.peakPerformance')}</Text>
          <Text style={styles.peakNum}>{peak != null ? peak : '—'}</Text>
          <View style={styles.peakBar}>
            <View
              style={[
                styles.peakFill,
                peak != null && {
                  width: `${Math.min(Math.max(peak, 0), 100)}%` as `${number}%`,
                },
              ]}
            />
          </View>
        </View>

        {grouped.length === 0 ? (
          <Text style={styles.empty}>{t('stats.empty')}</Text>
        ) : (
          grouped.map(({ exerciseId, sessions: rows }) => {
            const isOpen = expanded[exerciseId] === true;
            const visible = isOpen ? rows : rows.slice(0, previewCount);
            const hasMore = rows.length > previewCount;
            const title = exerciseDisplayName(exerciseId);

            return (
              <View key={exerciseId} style={styles.section}>
                <Text style={styles.secTitle}>{t('stats.sessionsTitle', { exercise: title })}</Text>
                {visible.map((item) => (
                  <SessionCard
                    key={item.sessionId}
                    item={item}
                    longMonths={longMonths}
                    onPress={() => nav.navigate('SessionDetail', { sessionId: item.sessionId })}
                    t={t}
                  />
                ))}
                {hasMore ? (
                  <Pressable onPress={() => toggleExpanded(exerciseId)} style={styles.seeMoreBtn}>
                    <Text style={styles.seeMoreTxt}>
                      {isOpen
                        ? t('stats.showLess')
                        : subscribed
                          ? t('stats.seeAll', { count: rows.length })
                          : t('stats.unlockAll', { count: rows.length })}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}

        <View style={{ height: 112 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Pill(props: {
  tab: string;
  selected: boolean;
  onPress: () => void;
  locked?: boolean;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.pillBase, props.selected ? styles.pillOn : styles.pillOff]}
    >
      <Text style={[styles.pillTxt, props.selected ? styles.pillTxtOn : styles.pillTxtOff]}>
        {props.tab}
      </Text>
      {props.locked ? (
        <Ionicons name="lock-closed" size={12} color={colors.text_muted} style={{ marginLeft: 4 }} />
      ) : null}
    </Pressable>
  );
}

function SessionCard(props: {
  item: SessionLog;
  longMonths: string[];
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { item, longMonths, onPress, t } = props;
  const sc = sessionPerformance(item);
  const accent = scoreAccent(sc);
  const setCount = item.setSummaries?.length ?? item.sets.length;
  const reps = sessionRepsCompleted(item);
  const focus = summarizeSessionFormFocus(item);
  const focusText = sessionFormFocusChipText(focus, t);
  const hasFormIssues = focus.totalUnique > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
    >
      <View style={[styles.cardAccentTop, { backgroundColor: accent }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardMeta}>
            <Text style={styles.cardTime}>{fmtCardTime(item.date)}</Text>
            <Text style={styles.cardDate}>{fmtCardDate(item.date, longMonths)}</Text>
          </View>
          <View style={styles.cardChevron}>
            <Icon name={ICONS.chevronForward} size={18} color={colors.text_muted} />
          </View>
        </View>

        <View style={styles.cardMetrics}>
          <MetricCell
            label={t('stats.scoreLabel')}
            value={`${sc}%`}
            valueColor={accent}
            highlight
          />
          <View style={styles.metricDivider} />
          <MetricCell label={t('common.sets')} value={String(setCount)} />
          <View style={styles.metricDivider} />
          <MetricCell label={t('common.reps')} value={`${reps.done}/${reps.planned}`} />
        </View>

        <View
          style={[
            styles.focusChip,
            hasFormIssues ? styles.focusChipWarn : styles.focusChipOk,
          ]}
        >
          <Icon
            name={hasFormIssues ? ICONS.warning : ICONS.checkmark}
            size={14}
            color={hasFormIssues ? colors.accent_yellow : colors.primary_green}
          />
          <Text
            style={[styles.focusChipTxt, hasFormIssues ? styles.focusChipTxtWarn : styles.focusChipTxtOk]}
            numberOfLines={2}
          >
            {focusText}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function MetricCell(props: {
  label: string;
  value: string;
  valueColor?: string;
  highlight?: boolean;
}) {
  const { label, value, valueColor = colors.text_primary, highlight = false } = props;
  return (
    <View style={[styles.metricCell, highlight && styles.metricCellHighlight]}>
      <Text style={styles.metricCellLab}>{label}</Text>
      <Text style={[styles.metricCellVal, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg_v3 },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  h1: {
    marginTop: 6,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.hero - 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  meta: { marginTop: 8, color: colors.text_muted, fontSize: typography.fontSize.bodySm },
  premiumBanner: {
    marginTop: 16,
    backgroundColor: colors.green_subtle_bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline_variant,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  premiumBannerTxt: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.bodySm,
    color: colors.on_surface,
    lineHeight: 20,
  },
  filt: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
  },
  pillBase: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  pillOn: { backgroundColor: colors.primary_green },
  pillOff: { backgroundColor: colors.bg_high },
  pillTxt: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  pillTxtOff: { color: colors.text_secondary, textTransform: 'uppercase' },
  pillTxtOn: { color: colors.text_on_green, textTransform: 'uppercase' },
  peakCard: {
    marginTop: 16,
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  peakLab: {
    color: colors.text_secondary,
    letterSpacing: 2,
    fontSize: 11,
    textTransform: 'uppercase',
    fontFamily: typography.fontFamily.medium,
  },
  peakNum: {
    marginTop: 10,
    fontFamily: typography.fontFamily.display,
    fontSize: 44,
    color: colors.primary_green,
  },
  peakBar: {
    marginTop: 14,
    flexDirection: 'row',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.bg_high,
  },
  peakFill: {
    borderRadius: 999,
    backgroundColor: colors.primary_green,
    height: '100%',
    minWidth: 0,
  },
  section: { marginTop: 28 },
  secTitle: {
    marginBottom: 14,
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.display,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.992 }] },
  cardAccentTop: {
    height: 3,
    width: '100%',
  },
  cardBody: {
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  cardMeta: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  cardChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg_high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTime: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'left',
  },
  cardDate: {
    fontFamily: typography.fontFamily.display,
    color: colors.text_primary,
    fontSize: 17,
    letterSpacing: -0.4,
    textAlign: 'left',
  },
  cardMetrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 14,
    backgroundColor: colors.bg_high,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 72,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  metricCellHighlight: {
    backgroundColor: colors.bg_elevated,
  },
  metricCellLab: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  metricCellVal: {
    marginTop: 6,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border_subtle,
    marginVertical: 12,
  },
  focusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    minHeight: 36,
  },
  focusChipOk: {
    backgroundColor: colors.green_subtle_bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary_green + '33',
  },
  focusChipWarn: {
    backgroundColor: colors.warning_subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent_yellow + '33',
  },
  focusChipTxt: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'left',
  },
  focusChipTxtOk: { color: colors.accent_green_light },
  focusChipTxtWarn: { color: colors.text_secondary },
  seeMoreBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  seeMoreTxt: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  empty: { marginTop: 32, color: colors.text_secondary, fontSize: 15, textAlign: 'center' },
});
