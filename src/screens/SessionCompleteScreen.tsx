import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { randomUUID } from 'expo-crypto';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Platform, TextInput } from 'react-native';
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
import { clampMass, parseMassDraft, type WeightUnit } from '@/utils/weightUnits';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function fmtWeight(amount: number, unit: WeightUnit) {
  const rounded = Math.round(amount * 10) / 10;
  const body = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return `${body} ${unit === 'kg' ? 'kg' : 'lb'}`;
}

function fmtElapsed(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

const RING_SZ = 200;
/** Outer hit area — larger than SVG ring so the score clears the stroke with padding. */
const RING_CONTAINER = 228;
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
  const {
    errors,
    startedAt,
    lastSetReps,
    lastSetElapsedSec,
    currentSetNumber,
    advanceToNextSet,
    workoutSetSnapshots,
    appendWorkoutSetSnapshot,
  } = useSessionResultStore();
  const { setCount: plannedSetCount, weightAmount, weightUnit } = useSessionConfigStore();
  const patchWeight = useSessionConfigStore((s) => s.patch);
  const { participantId } = useAuthStore();
  const [saved, setSaved] = useState(false);
  /** Working weight on the bar for the *next* set (defaults to weight just used). */
  const [nextWeightDraft, setNextWeightDraft] = useState(() => String(weightAmount));

  useEffect(() => {
    setNextWeightDraft(String(weightAmount));
  }, [weightAmount]);

  const setsProgressDisplay = `${currentSetNumber}/${plannedSetCount}`;
  const canAdvanceToNextSet = currentSetNumber < plannedSetCount;

  const elapsedClock =
    lastSetElapsedSec > 0
      ? `${Math.floor(lastSetElapsedSec / 60)}:${String(lastSetElapsedSec % 60).padStart(2, '0')}`
      : '—';

  const volumeDisplay = useMemo(() => {
    if (lastSetReps <= 0) return '—';
    const v = weightAmount * lastSetReps;
    const rounded = Math.round(v * 10) / 10;
    const body = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
    return `${body} ${weightUnit === 'kg' ? 'kg' : 'lb'}`;
  }, [lastSetReps, weightAmount, weightUnit]);

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

  const onNextSet = () => {
    appendWorkoutSetSnapshot({
      setNumber: currentSetNumber,
      weightAmount,
      weightUnit,
      reps: lastSetReps,
      elapsedSec: lastSetElapsedSec,
      scoreRounded: sc,
    });
    const parsed = parseMassDraft(nextWeightDraft);
    const nextMass = clampMass(parsed ?? weightAmount, weightUnit);
    patchWeight({ weightAmount: nextMass });
    advanceToNextSet();
    nav.replace('LiveSession', { continuedWorkout: true });
  };

  const onSave = async () => {
    if (saved) { goHome(); return; }
    const sessionId = randomUUID();
    const log: SessionLog = {
      sessionId,
      participantId,
      date: new Date().toISOString(),
      sets: [
        {
          setNumber: currentSetNumber,
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
        totalReps: Math.max(0, lastSetReps),
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
        <View style={styles.ringOuter}>
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
          <View style={styles.ringInnerOverlay} pointerEvents="none">
            <View style={styles.ringTextColumn}>
              <Text
                style={[styles.scoreNumHero, { color: rc }]}
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.75}
              >
                {sc}
              </Text>
              <Text style={styles.scoreDenomBelow}>/100</Text>
            </View>
          </View>
        </View>

        {/* Score label */}
        <View style={[styles.labelBadge, { borderColor: rc + '40', backgroundColor: rc + '12' }]}>
          <Text style={[styles.labelBadgeTxt, { color: rc }]}>{label.toUpperCase()}</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.grid}>
          <MiniCard label="Volume" value={volumeDisplay} />
          <MiniCard label="Sets" value={setsProgressDisplay} highlight />
          <MiniCard label="Time" value={elapsedClock} highlight />
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

        {canAdvanceToNextSet && (
          <View style={styles.nextSetBlock}>
            {workoutSetSnapshots.length > 0 && (
              <>
                <Text style={styles.nextSetSectionTitle}>SETS IN THIS WORKOUT</Text>
                {workoutSetSnapshots.map((row) => (
                  <View key={row.setNumber} style={styles.snapshotRow}>
                    <Text style={styles.snapshotSetLab}>SET {row.setNumber}</Text>
                    <Text style={styles.snapshotMeta}>
                      {fmtWeight(row.weightAmount, row.weightUnit)} · {row.reps} reps · score {row.scoreRounded} ·{' '}
                      {fmtElapsed(row.elapsedSec)}
                    </Text>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.nextSetSectionTitle}>NEXT: SET {currentSetNumber + 1}</Text>
            <Text style={styles.nextSetHint}>
              This set was {fmtWeight(weightAmount, weightUnit)}. Enter the weight you will use next.
            </Text>
            <Text style={styles.weightFieldHint}>{`Weight (${weightUnit === 'kg' ? 'kg' : 'lb'})`}</Text>
            <TextInput
              value={nextWeightDraft}
              onChangeText={setNextWeightDraft}
              onBlur={() => {
                const n = parseMassDraft(nextWeightDraft);
                if (n == null) setNextWeightDraft(String(weightAmount));
                else setNextWeightDraft(String(clampMass(n, weightUnit)));
              }}
              keyboardType="decimal-pad"
              returnKeyType="done"
              placeholder={weightUnit === 'kg' ? '100' : '225'}
              placeholderTextColor={colors.text_muted}
              style={styles.nextWeightInput}
            />

            <PrimaryButton title="START NEXT SET" variant="ghost" style={styles.secondaryCta} onPress={onNextSet} />
          </View>
        )}

        <PrimaryButton
          title="SAVE & CONTINUE"
          style={[styles.cta, canAdvanceToNextSet && styles.ctaAfterSecondary]}
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

  ringOuter: {
    marginTop: 28,
    width: RING_CONTAINER,
    height: RING_CONTAINER,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringInnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 38,
    paddingVertical: 42,
  },
  ringTextColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: RING_SZ - 28,
  },
  scoreNumHero: {
    fontFamily: typography.fontFamily.display,
    fontSize: 48,
    lineHeight: 54,
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  scoreDenomBelow: {
    marginTop: 6,
    fontFamily: typography.fontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.5,
    color: colors.text_muted,
    textAlign: 'center',
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

  nextSetBlock: {
    marginTop: 26,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface_v3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
    gap: 10,
  },
  nextSetSectionTitle: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.captionCaps + 3,
    letterSpacing: typography.letterSpacing.capsWide,
    color: colors.primary_green,
  },
  nextSetHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.captions,
    lineHeight: 20,
    color: colors.text_secondary,
  },
  snapshotRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border_subtle,
  },
  snapshotSetLab: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
    color: colors.text_primary,
    letterSpacing: typography.letterSpacing.capsWide,
  },
  snapshotMeta: {
    marginTop: 4,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captions,
    color: colors.text_muted,
    lineHeight: 18,
  },
  weightFieldHint: {
    marginTop: 6,
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    color: colors.text_muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  nextWeightInput: {
    marginTop: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary_green,
    paddingVertical: 10,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodyLg,
    color: colors.text_primary,
    ...(Platform.OS === 'android' ? { paddingVertical: 8 } : {}),
  },

  cta: { marginTop: 28 },
  secondaryCta: { marginTop: 14 },
  ctaAfterSecondary: { marginTop: 14 },
});
