import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RepRightHeader } from '@/components/RepRightHeader';
import { getAllSessions, type SessionLog } from '@/modules/session';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type FilterKind = 'week' | 'last' | 'month';

export function StatsScreen() {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [refresh, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKind>('week');

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

  const peak = sessions.length ? Math.max(...sessions.map((s) => Math.round(s.summary.avgScore))) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RepRightHeader />
      <FlatList
        data={sessions}
        keyExtractor={(it) => it.sessionId}
        refreshControl={
          <RefreshControl refreshing={refresh} onRefresh={load} tintColor={colors.primary_green} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No sessions yet — complete a live lift to populate the rep log.
          </Text>
        }
        ListHeaderComponent={
          <View style={styles.hdr}>
            <Text style={styles.h1}>Rep log</Text>
            <Text style={styles.meta}>Your biomechanical history</Text>

            <View style={styles.filt}>
              <Pill tab="THIS WEEK" selected={filter === 'week'} onPress={() => setFilter('week')} />
              <Pill tab="LAST WEEK" selected={filter === 'last'} onPress={() => setFilter('last')} />
              <Pill tab="MONTHLY" selected={filter === 'month'} onPress={() => setFilter('month')} />
            </View>

            <View style={styles.peakCard}>
              <Text style={styles.peakLab}>Peak form score</Text>
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

            <Text style={styles.weekVol}>Weekly volume</Text>
            <View style={styles.bars}>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const hi = ((new Date().getDay() + 6) % 7) === d;
                return (
                  <View key={String(d)} style={styles.barWrap}>
                    <View style={[styles.bar, hi ? styles.barHot : styles.barCold]} />
                    <Text style={styles.dayL}>{(['M','T','W','T','F','S','S'][d])}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.secTitle}>Deadlift sessions</Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = Math.round(item.summary.avgScore);
          const good = sc >= 70;
          const d = new Date(item.date);
          const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const dateStr = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
          const accent = sc >= 90 ? colors.primary_green : sc >= 70 ? colors.accent_green_light : sc >= 50 ? colors.accent_yellow : colors.accent_red;
          return (
            <View style={[styles.card, { borderLeftColor: good ? colors.primary_green : colors.accent_red }]}>
              <Text style={styles.cardDate}>{dateStr}</Text>
              <Text style={styles.cardMuted}>
                {item.sets.length} set(s) · deadlift session
              </Text>
              <View style={[styles.badge, { backgroundColor: accent + '18', borderColor: accent + '30' }]}>
                <Text style={[styles.badgeTxt, { color: accent }]}>{sc}%</Text>
              </View>
            </View>
          );
        }}
      />
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
  list: { paddingHorizontal: 24, paddingBottom: 112 },
  hdr: {},
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
  pillTxt: { fontFamily: typography.fontFamily.display, fontSize: typography.fontSize.captionCaps + 2, letterSpacing: 1.6 },
  pillTxtOff: { color: colors.text_secondary, textTransform: 'uppercase' },
  peakCard: {
    marginTop: 16,
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  peakLab: { color: colors.text_secondary, letterSpacing: 2, fontSize: 11, textTransform: 'uppercase', fontFamily: typography.fontFamily.medium },
  peakNum: { marginTop: 10, fontFamily: typography.fontFamily.display, fontSize: 44, color: colors.primary_green },
  peakBar: { marginTop: 14, flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.bg_high },
  peakFill: {
    borderRadius: 999,
    backgroundColor: colors.primary_green,
    height: '100%',
    minWidth: 0,
  },
  pillOff: { backgroundColor: colors.bg_high },
  pillTxtOn: { color: colors.text_on_green, textTransform: 'uppercase' },
  weekVol: {
    marginTop: 26,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bars: { flexDirection: 'row', marginTop: 12, gap: 8 },
  barWrap: { flex: 1, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 24, borderRadius: 999, height: 48 },
  barHot: { backgroundColor: colors.primary_green },
  barCold: { backgroundColor: colors.bg_high },
  dayL: { marginTop: 8, fontSize: 10, color: colors.text_muted },
  secTitle: {
    marginTop: 28,
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
  cardDate: { flex: 1, minWidth: '40%', fontFamily: typography.fontFamily.bold, color: colors.text_primary, fontSize: 17 },
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
  empty: { marginTop: 24, marginBottom: 40, color: colors.text_secondary, fontSize: 15, textAlign: 'center' },
});
