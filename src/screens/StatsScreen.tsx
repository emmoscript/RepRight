import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
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
import type { RootStackParamList } from '@/navigation/routeTypes';
import { getAllSessions, type SessionLog } from '@/modules/session';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import {
  exerciseDisplayName,
  filterSessionsByPeriod,
  groupSessionsByExercise,
  type StatsFilterKind,
} from '@/utils/statsFilters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PREVIEW_COUNT = 3;

function sessionPerformance(log: SessionLog): number {
  return Math.round(log.summary.avgScore);
}

function sessionRepsLabel(log: SessionLog): string {
  const s = log.summary;
  const planned = s.plannedReps ?? s.totalReps;
  return `${s.totalReps}/${planned} reps`;
}

function fmtCardDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}

function scoreAccent(sc: number) {
  if (sc >= 90) return colors.primary_green;
  if (sc >= 70) return colors.accent_green_light;
  if (sc >= 50) return colors.accent_yellow;
  return colors.accent_red;
}

export function StatsScreen() {
  const nav = useNavigation<Nav>();
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

  const filtered = useMemo(
    () => filterSessionsByPeriod(sessions, filter),
    [sessions, filter],
  );

  const grouped = useMemo(() => groupSessionsByExercise(filtered), [filtered]);

  const peak = filtered.length
    ? Math.max(...filtered.map((s) => sessionPerformance(s)))
    : null;

  const toggleExpanded = (exerciseId: string) => {
    setExpanded((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  };

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
        <Text style={styles.h1}>Rep log</Text>
        <Text style={styles.meta}>Your biomechanical history</Text>

        <View style={styles.filt}>
          <Pill tab="THIS WEEK" selected={filter === 'week'} onPress={() => setFilter('week')} />
          <Pill tab="LAST WEEK" selected={filter === 'last'} onPress={() => setFilter('last')} />
          <Pill tab="MONTHLY" selected={filter === 'month'} onPress={() => setFilter('month')} />
        </View>

        <View style={styles.peakCard}>
          <Text style={styles.peakLab}>Peak performance</Text>
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
          <Text style={styles.empty}>
            No sessions in this period — complete a live lift to populate the rep log.
          </Text>
        ) : (
          grouped.map(({ exerciseId, sessions: rows }) => {
            const isOpen = expanded[exerciseId] === true;
            const visible = isOpen ? rows : rows.slice(0, PREVIEW_COUNT);
            const hasMore = rows.length > PREVIEW_COUNT;
            const title = exerciseDisplayName(exerciseId);

            return (
              <View key={exerciseId} style={styles.section}>
                <Text style={styles.secTitle}>{title} sessions</Text>
                {visible.map((item) => {
                  const sc = sessionPerformance(item);
                  const accent = scoreAccent(sc);
                  const setCount = item.setSummaries?.length ?? item.sets.length;
                  return (
                    <Pressable
                      key={item.sessionId}
                      onPress={() => nav.navigate('SessionDetail', { sessionId: item.sessionId })}
                      style={({ pressed }) => [
                        styles.card,
                        { borderLeftColor: sc >= 70 ? colors.primary_green : colors.accent_red },
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Text style={styles.cardDate}>{fmtCardDate(item.date)}</Text>
                      <Text style={styles.cardMuted}>
                        {setCount} set(s) · {sessionRepsLabel(item)}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: accent + '18', borderColor: accent + '30' }]}>
                        <Text style={[styles.badgeTxt, { color: accent }]}>{sc}%</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {hasMore ? (
                  <Pressable onPress={() => toggleExpanded(exerciseId)} style={styles.seeMoreBtn}>
                    <Text style={styles.seeMoreTxt}>
                      {isOpen ? 'Show less' : `See all (${rows.length})`}
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

function Pill(props: { tab: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.pillBase, props.selected ? styles.pillOn : styles.pillOff]}
    >
      <Text style={[styles.pillTxt, props.selected ? styles.pillTxtOn : styles.pillTxtOff]}>
        {props.tab}
      </Text>
    </Pressable>
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
  filt: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
    marginBottom: 8,
  },
  pillBase: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  pillOn: { backgroundColor: colors.primary_green },
  pillOff: { backgroundColor: colors.bg_high },
  pillTxt: { fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.captionCaps + 2, letterSpacing: 1.6 },
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
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
  },
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg_elevated,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderLeftWidth: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border_subtle,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border_subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border_subtle,
  },
  cardPressed: { opacity: 0.88 },
  cardDate: {
    flex: 1,
    minWidth: '40%',
    fontFamily: typography.fontFamily.bold,
    color: colors.text_primary,
    fontSize: 17,
  },
  cardMuted: { width: '100%', color: colors.text_secondary, fontSize: 13, marginBottom: -4 },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.captions,
    letterSpacing: 0.5,
  },
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
