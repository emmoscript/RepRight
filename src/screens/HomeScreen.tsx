import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RepRightHeader } from '@/components/RepRightHeader';
import type { MainTabCompositeNav } from '@/navigation/routeTypes';
import { getAllSessions } from '@/modules/session';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

function scoreBadgeColor(score: number) {
  if (score >= 90) return colors.primary_green;
  if (score >= 70) return colors.accent_green_light;
  if (score >= 50) return colors.accent_yellow;
  return colors.accent_red;
}

export function HomeScreen() {
  const nav = useNavigation<MainTabCompositeNav>();
  const { participantId, email } = useAuthStore();

  const [sessionCount, setSessionCount] = useState(0);
  const [lastIso, setLastIso] = useState<string | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [recentSessions, setRecentSessions] = useState<
    Array<{ date: string; score: number }>
  >([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const list = await getAllSessions();
        if (!active) return;
        setSessionCount(list.length);
        const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
        if (sorted[0]) {
          setLastIso(sorted[0].date);
          setLastScore(Math.round(sorted[0].summary.avgScore));
        } else {
          setLastIso(null);
          setLastScore(null);
        }
        setRecentSessions(
          sorted.slice(0, 2).map((s) => ({
            date: s.date,
            score: Math.round(s.summary.avgScore),
          })),
        );
      })();
      return () => { active = false; };
    }, []),
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const displayName = useMemo(
    () =>
      email
        ? email.split('@')[0]?.replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Athlete'
        : participantId,
    [email, participantId],
  );

  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RepRightHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Text style={styles.greeting}>
          {greeting},{'\n'}
          <Text style={styles.greetingName}>{displayName}</Text>
        </Text>
        <Text style={styles.subGreeting}>READY FOR YOUR MORNING LIFT?</Text>

        {/* CTA */}
        <PrimaryButton
          title="START DEADLIFT SESSION ▶"
          onPress={() => nav.navigate('Workout')}
          style={styles.heroCta as ViewStyle}
        />

        {/* Last session card */}
        <View style={styles.lastCard}>
          {/* Decorative icon */}
          <View style={styles.lastDecor} pointerEvents="none">
            <Ionicons name="fitness-outline" size={100} color={colors.primary_green} style={{ opacity: 0.08 }} />
          </View>

          <View style={styles.lastCardHeader}>
            <Text style={styles.lastCardLabel}>LAST SESSION</Text>
            {lastScore != null ? (
              <View style={[styles.scorePill, { backgroundColor: scoreBadgeColor(lastScore) + '18', borderColor: scoreBadgeColor(lastScore) + '30' }]}>
                <Text style={[styles.scorePillTxt, { color: scoreBadgeColor(lastScore) }]}>
                  {lastScore}%
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.lastCardTitle}>
            {lastIso ? `${formatDate(lastIso)} SUMMARY` : 'NO SESSION YET'}
          </Text>
          <Text style={styles.lastCardMeta}>
            {lastIso
              ? `Score: ${lastScore ?? '—'}%  ·  Latest deadlift session`
              : 'Start a lift to build your history'}
          </Text>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={[styles.statVal, { color: colors.primary_green }]}>
              {sessionCount}
            </Text>
            <Text style={styles.statLabel}>TOTAL{'\n'}SESSIONS</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statVal}>
              <Text style={{ color: colors.accent_yellow }}>12</Text>
            </Text>
            <Text style={styles.statLabel}>
              CURRENT{'\n'}STREAK 🔥
            </Text>
          </View>
        </View>

        {/* Recent activity */}
        <Text style={styles.sectionTitle}>Recent activity</Text>
        {recentSessions.length > 0 ? (
          recentSessions.map((s, i) => (
            <View
              key={`${s.date}-${i}`}
              style={[
                styles.activityRow,
                { borderLeftColor: s.score >= 70 ? colors.primary_green : colors.accent_red },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>Deadlift · Form session</Text>
                <Text style={styles.activityDate}>{formatDate(s.date)}</Text>
              </View>
              <Text
                style={[
                  styles.activityScore,
                  { color: scoreBadgeColor(s.score) },
                ]}
              >
                {s.score}%
              </Text>
            </View>
          ))
        ) : (
          <View style={[styles.activityRow, { borderLeftColor: colors.border_subtle }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.activityTitle}>Deadlift · Form drill</Text>
              <Text style={styles.activityDate}>Awaiting logged session data</Text>
            </View>
            <Text style={[styles.activityScore, { color: colors.text_muted }]}>—</Text>
          </View>
        )}

        {/* Weekly volume */}
        <Text style={styles.sectionTitle}>Weekly volume</Text>
        <View style={styles.barsWrap}>
          {DAYS.map((label, i) => (
            <View key={`${label}-${i}`} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  i === todayIdx ? styles.barActive : styles.barInactive,
                ]}
              />
              <Text style={[styles.barLabel, i === todayIdx && { color: colors.primary_green }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
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
    fontSize: typography.fontSize.hero,
    fontFamily: typography.fontFamily.display,
    lineHeight: typography.fontSize.hero * 1.08,
    letterSpacing: -0.5,
  },
  greetingName: {
    color: colors.text_primary,
  },
  subGreeting: {
    marginTop: 10,
    color: colors.text_secondary,
    fontSize: typography.fontSize.captionCaps + 3,
    fontFamily: typography.fontFamily.medium,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },

  heroCta: { marginTop: 24, borderRadius: 16, minHeight: 72 },

  lastCard: {
    marginTop: 28,
    backgroundColor: colors.bg_elevated,
    borderRadius: 16,
    padding: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  lastDecor: { position: 'absolute', bottom: -10, right: -10 },
  lastCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lastCardLabel: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  scorePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  scorePillTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 13,
  },
  lastCardTitle: {
    fontFamily: typography.fontFamily.bold,
    color: colors.text_primary,
    fontSize: typography.fontSize.bodyLg,
    letterSpacing: 0.3,
  },
  lastCardMeta: {
    marginTop: 8,
    color: colors.text_secondary,
    fontSize: typography.fontSize.bodySm,
    fontFamily: typography.fontFamily.regular,
  },

  statsRow: { flexDirection: 'row', gap: 14, marginTop: 22 },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  statVal: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.titleSm + 4,
    color: colors.text_primary,
  },
  statLabel: {
    marginTop: 10,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 1,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },

  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.bodySm,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg_elevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  activityTitle: {
    fontFamily: typography.fontFamily.bold,
    color: colors.text_primary,
    fontSize: typography.fontSize.bodySm,
  },
  activityDate: { color: colors.text_muted, fontSize: 12, marginTop: 4, fontFamily: typography.fontFamily.regular },
  activityScore: { fontFamily: typography.fontFamily.bold, fontSize: 17 },

  barsWrap: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: '100%', maxWidth: 32, borderRadius: 999, height: 52 },
  barActive: { backgroundColor: colors.primary_green },
  barInactive: { backgroundColor: colors.bg_high },
  barLabel: {
    marginTop: 7,
    color: colors.text_muted,
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
  },
});
