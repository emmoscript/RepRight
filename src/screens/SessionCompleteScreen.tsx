import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { randomUUID } from 'expo-crypto';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RepRightHeader } from '@/components/RepRightHeader';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { calculateRepScore } from '@/modules/scoring';
import { saveSession, type SessionLog } from '@/modules/session';
import { useSessionResultStore } from '@/store/sessionResultStore';
import { useAuthStore } from '@/store/authStore';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RING_SZ = 200;
const R = 74;
const C = 2 * Math.PI * R;

const ERROR_NAMES: Record<string, { name: string; severity: 'critical' | 'warning' }> = {
  ERR_001: { name: 'Lumbar rounding', severity: 'critical' },
  ERR_002: { name: 'Hips too high at initiation', severity: 'critical' },
  ERR_003: { name: 'Bar drift away from body', severity: 'warning' },
  ERR_004: { name: 'Hyperextension at lockout', severity: 'warning' },
  ERR_005: { name: 'Shoulder behind bar at setup', severity: 'warning' },
};

function ringColor(sc: number) {
  if (sc >= 90) return colors.primary_green;
  if (sc >= 70) return colors.accent_green_light;
  if (sc >= 50) return colors.accent_yellow;
  return colors.accent_red;
}

export function SessionCompleteScreen() {
  const nav = useNavigation<Nav>();
  const { errors, startedAt } = useSessionResultStore();
  const { participantId } = useAuthStore();
  const { setCount: numSets } = useSessionConfigStore();
  const [saved, setSaved] = useState(false);

  const { score, label } = useMemo(() => calculateRepScore(errors), [errors]);
  const sc = Math.round(score);
  const rc = ringColor(sc);
  const arc = `${(sc / 100) * C} ${C}`;

  const uniqueErrors = useMemo(() => {
    const seen = new Set<string>();
    return errors.filter((e) => {
      if (seen.has(e.errorId)) return false;
      seen.add(e.errorId);
      return true;
    });
  }, [errors]);

  const goHome = () => nav.navigate('MainTabs', { screen: 'HomeMain' });

  const onSave = async () => {
    if (saved) { goHome(); return; }
    const sessionId = randomUUID();
    const log: SessionLog = {
      sessionId,
      participantId,
      date: new Date().toISOString(),
      sets: [
        {
          setNumber: 1,
          reps: [
            {
              repNumber: 1,
              startTimestamp: startedAt,
              endTimestamp: Date.now(),
              score,
              errors: Array.from(
                new Map(
                  errors.map((e) => [
                    e.errorId,
                    { errorId: e.errorId, frameCount: 1, totalFrames: 1 },
                  ]),
                ).values(),
              ),
            },
          ],
        },
      ],
      summary: {
        totalReps: 1,
        avgScore: score,
        mostFrequentError: errors[0]?.errorId ?? null,
      },
    };
    await saveSession(log);
    setSaved(true);
    useSessionResultStore.getState().clear();
    goHome();
  };

  return (
    <View style={styles.root}>
      <RepRightHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.h1}>SESSION COMPLETE</Text>

        {/* Score ring */}
        <View style={styles.ringWrap}>
          <Svg width={RING_SZ} height={RING_SZ}>
            <G transform={`rotate(-90 ${RING_SZ / 2} ${RING_SZ / 2})`}>
              <Circle
                cx={RING_SZ / 2} cy={RING_SZ / 2} r={R}
                stroke={colors.surface_v3} strokeWidth={14} fill="none"
              />
              <Circle
                cx={RING_SZ / 2} cy={RING_SZ / 2} r={R}
                stroke={rc} strokeWidth={14} fill="none"
                strokeLinecap="round" strokeDasharray={arc}
              />
            </G>
          </Svg>
          <View style={styles.ringInner}>
            <Text style={[styles.scoreNum, { color: rc }]}>{sc}</Text>
            <Text style={styles.scoreDenom}>/100</Text>
          </View>
        </View>

        {/* Score label */}
        <View style={[styles.labelBadge, { borderColor: rc + '40', backgroundColor: rc + '12' }]}>
          <Text style={[styles.labelBadgeTxt, { color: rc }]}>{label.toUpperCase()}</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.grid}>
          <MiniCard label="Volume" value="—" />
          <MiniCard label="Sets" value={String(numSets)} highlight />
          <MiniCard label="Time" value="—" highlight />
          <MiniCard label="Avg score" value={`${sc}`} />
        </View>

        {/* Form adjustments */}
        {uniqueErrors.length > 0 && (
          <>
            <Text style={styles.adjTitle}>Form Adjustments Detected</Text>
            {uniqueErrors.map((e) => {
              const meta = ERROR_NAMES[e.errorId];
              const isCritical = meta?.severity === 'critical';
              const accent = isCritical ? colors.accent_red : colors.accent_yellow;
              return (
                <View
                  key={e.errorId}
                  style={[styles.errRow, { borderLeftColor: accent }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.errName}>{meta?.name ?? e.errorId}</Text>
                    <Text style={styles.errId}>{e.errorId}</Text>
                  </View>
                  <View style={[styles.sevBadge, { backgroundColor: accent + '18', borderColor: accent + '30' }]}>
                    <Text style={[styles.sevTxt, { color: accent }]}>
                      {isCritical ? 'CRITICAL' : 'WARNING'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {uniqueErrors.length === 0 && (
          <View style={styles.perfectRow}>
            <Text style={styles.perfectIcon}>✓</Text>
            <Text style={styles.perfectTxt}>No form issues detected. Great lift!</Text>
          </View>
        )}

        <PrimaryButton
          title="SAVE & CONTINUE"
          style={styles.cta}
          onPress={() => void onSave()}
        />
      </ScrollView>
    </View>
  );
}

function MiniCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[miniStyles.card, highlight && miniStyles.cardHi]}>
      <Text style={miniStyles.label}>{label.toUpperCase()}</Text>
      <Text style={[miniStyles.value, highlight && { color: colors.primary_green }]}>
        {value}
      </Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg_elevated,
    width: '47%',
    padding: 16,
    borderRadius: 14,
    minHeight: 84,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.border_subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  cardHi: { borderBottomColor: colors.primary_green },
  label: {
    color: colors.text_secondary,
    letterSpacing: 1.5,
    fontSize: 10,
    fontFamily: typography.fontFamily.medium,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 8,
    fontFamily: typography.fontFamily.bold,
    fontSize: 22,
    color: colors.text_primary,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3 },
  scroll: { paddingHorizontal: 24, paddingBottom: 64 },

  h1: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.text_primary,
    fontSize: typography.fontSize.captionCaps + 4,
    fontFamily: typography.fontFamily.display,
    letterSpacing: typography.letterSpacing.capsWider,
    textTransform: 'uppercase',
  },

  ringWrap: { marginTop: 28, alignItems: 'center', justifyContent: 'center' },
  ringInner: {
    position: 'absolute',
    width: RING_SZ - 56,
    height: RING_SZ - 56,
    borderRadius: 999,
    backgroundColor: colors.bg_v3,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignSelf: 'center',
  },
  scoreNum: {
    fontFamily: typography.fontFamily.display,
    fontSize: 56,
    lineHeight: 60,
  },
  scoreDenom: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 18,
    marginBottom: 6,
    marginLeft: 2,
    alignSelf: 'flex-end',
  },

  labelBadge: {
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  labelBadgeTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.captions,
    letterSpacing: typography.letterSpacing.capsWide,
  },

  grid: {
    marginTop: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },

  adjTitle: {
    marginTop: 30,
    marginBottom: 12,
    fontFamily: typography.fontFamily.display,
    color: colors.text_primary,
    fontSize: typography.fontSize.bodySm,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  errRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface_v3,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  errName: {
    fontFamily: typography.fontFamily.bold,
    color: colors.text_primary,
    fontSize: typography.fontSize.bodySm,
  },
  errId: {
    marginTop: 3,
    color: colors.text_muted,
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
  },
  sevBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  sevTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  perfectRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.green_subtle_bg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary_green + '40',
  },
  perfectIcon: { color: colors.primary_green, fontSize: 22, fontFamily: typography.fontFamily.bold },
  perfectTxt: { color: colors.primary_green, fontFamily: typography.fontFamily.medium, fontSize: 14, flex: 1 },

  cta: { marginTop: 28 },
});
