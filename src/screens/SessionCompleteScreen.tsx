import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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

const RING_SZ = 240;
/** Outer hit area — larger than SVG ring so the score clears the stroke with padding. */
const RING_CONTAINER = 268;
const R = 88;
const RING_STROKE = 12;
const C = 2 * Math.PI * R;

function ringColor(sc: number) {
  if (sc >= 90) return colors.primary_green;
  if (sc >= 70) return colors.accent_green_light;
  if (sc >= 50) return colors.accent_yellow;
  return colors.accent_red;
}

function precisionTitle(scoreRounded: number) {
  if (scoreRounded >= 90) return 'ELITE PRECISION';
  if (scoreRounded >= 80) return 'STRONG PRECISION';
  if (scoreRounded >= 70) return 'SOLID CONTROL';
  if (scoreRounded >= 50) return 'NEEDS CLEANUP';
  return 'HIGH ALERT FORM';
}

type FormBand = 'critical' | 'warning' | 'good';

function bandLabel(band: FormBand) {
  if (band === 'critical') return 'CRITICAL';
  if (band === 'warning') return 'WARNING';
  return 'GOOD';
}

function bandDotColor(band: FormBand) {
  if (band === 'critical') return colors.accent_red;
  if (band === 'warning') return '#FF9100';
  return colors.primary_green;
}

function badgeColors(band: FormBand) {
  const dot = bandDotColor(band);
  if (band === 'good') return { fg: dot, bg: `${dot}14`, bd: `${dot}33` };
  if (band === 'critical') return { fg: dot, bg: `${dot}1A`, bd: `${dot}33` };
  return { fg: dot, bg: `${dot}22`, bd: `${dot}40` };
}

function buildFormInsights(errorIds: Set<string>): Array<{ key: string; label: string; band: FormBand }> {
  const hipCrit = errorIds.has('ERR_001') || errorIds.has('ERR_002');
  const romWarn = errorIds.has('ERR_003') || errorIds.has('ERR_004') || errorIds.has('ERR_005');
  return [
    { key: 'hip-sway', label: 'Hip Sway', band: hipCrit ? 'critical' : 'good' },
    { key: 'rom', label: 'Range of Motion', band: romWarn ? 'warning' : 'good' },
    { key: 'tempo', label: 'Tempo Consistency', band: 'good' },
  ];
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

  const repScore = useMemo(() => calculateRepScore(errors), [errors]);
  const score = repScore.score;
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

  const insightRows = useMemo(() => {
    const ids = new Set(uniqueErrors.map((e) => e.errorId));
    return buildFormInsights(ids);
  }, [uniqueErrors]);
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
      <RepRightHeader variant="sessionComplete" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.h1}>Session Complete</Text>

        {/* Score ring */}
        <View style={styles.ringOuter}>
          <Svg width={RING_SZ} height={RING_SZ}>
            <G transform={`rotate(-90 ${RING_SZ / 2} ${RING_SZ / 2})`}>
              <Circle
                cx={RING_SZ / 2} cy={RING_SZ / 2} r={R}
                stroke={colors.surface_v3} strokeWidth={RING_STROKE} fill="none"
              />
              <Circle
                cx={RING_SZ / 2} cy={RING_SZ / 2} r={R}
                stroke={rc} strokeWidth={RING_STROKE} fill="none"
                strokeLinecap="round" strokeDasharray={arc}
              />
            </G>
          </Svg>
          <View style={styles.ringInnerOverlay} pointerEvents="none">
            <View style={styles.ringCenterStack}>
              <View style={styles.ringScoreInline}>
                <Text
                  style={styles.ringScoreBig}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  minimumFontScale={0.65}
                >
                  {sc}
                </Text>
                <Text
                  style={styles.ringScoreFrac}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  minimumFontScale={0.7}
                >
                  /100
                </Text>
              </View>
              <Text
                style={styles.ringRecoveryLbl}
                adjustsFontSizeToFit
                numberOfLines={1}
                minimumFontScale={0.75}
              >
                Recovery Index
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.eliteBadge}>
          <MaterialIcons name="verified" size={16} color={colors.primary_green} />
          <Text style={styles.eliteBadgeTxt}>{precisionTitle(sc)}</Text>
        </View>

        {/* Stats grid */}
        <View style={styles.grid}>
          <MiniCard label="Volume" value={volumeDisplay} accentBorder />
          <MiniCard label="Sets" value={setsProgressDisplay} accentBorder />
          <MiniCard label="Time" value={elapsedClock} accentBorder />
          <MiniCard label="Avg score" value={`${sc}%`} accentBorder />
        </View>

        {/* Form adjustments — canonical summary rows */}
        <View style={styles.formCard}>
          <View style={styles.formCardTitleRow}>
            <MaterialIcons name="analytics" size={22} color={colors.primary_green} />
            <Text style={styles.formCardTitle}>Form Adjustments Detected</Text>
          </View>
          <View style={styles.formCardBody}>
            {insightRows.map((row, idx) => {
              const b = badgeColors(row.band);
              return (
                <View
                  key={row.key}
                  style={[styles.insightRow, idx < insightRows.length - 1 && styles.insightRowSep]}
                >
                  <View style={styles.insightLeft}>
                    <View style={[styles.insightDot, { backgroundColor: bandDotColor(row.band) }]} />
                    <Text style={styles.insightName}>{row.label}</Text>
                  </View>
                  <View style={[styles.bandBadge, { backgroundColor: b.bg, borderColor: b.bd }]}>
                    <Text style={[styles.bandBadgeTxt, { color: b.fg }]}>{bandLabel(row.band)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

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

function MiniCard({
  label,
  value,
  accentBorder,
}: {
  label: string;
  value: string;
  accentBorder?: boolean;
}) {
  return (
    <View style={[miniStyles.card, accentBorder && miniStyles.cardAccent]}>
      <Text style={miniStyles.label}>{label.toUpperCase()}</Text>
      <Text style={miniStyles.value}>{value}</Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg_elevated,
    width: '48%',
    padding: 18,
    borderRadius: 14,
    minHeight: 84,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  cardAccent: {
    borderLeftColor: colors.primary_green,
  },
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
  scroll: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 64 },

  h1: {
    marginTop: 6,
    textAlign: 'center',
    color: colors.text_primary,
    fontSize: typography.fontSize.screenTitle - 10,
    fontFamily: typography.fontFamily.display,
    letterSpacing: -1.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },

  ringOuter: {
    marginTop: 16,
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
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  ringCenterStack: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: RING_SZ - RING_STROKE * 2 - 36,
  },
  ringScoreInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  ringScoreBig: {
    fontFamily: typography.fontFamily.display,
    fontSize: 52,
    lineHeight: 56,
    color: colors.text_primary,
    fontWeight: '700',
    letterSpacing: -1.5,
    flexShrink: 1,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  ringScoreFrac: {
    marginLeft: 3,
    fontFamily: typography.fontFamily.display,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text_secondary,
    fontWeight: '400',
    letterSpacing: 0,
    flexShrink: 1,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  ringRecoveryLbl: {
    marginTop: 6,
    color: colors.primary_green,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: 2,
    fontSize: 9,
    textTransform: 'uppercase',
    textAlign: 'center',
    maxWidth: '100%',
  },

  eliteBadge: {
    marginTop: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(39,195,79,0.25)',
    backgroundColor: 'rgba(39,195,79,0.10)',
  },
  eliteBadgeTxt: {
    marginLeft: 8,
    color: colors.primary_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.captions - 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },

  grid: {
    marginTop: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  formCard: {
    marginTop: 28,
    backgroundColor: colors.surface_low,
    borderRadius: 14,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  formCardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  formCardTitle: {
    marginLeft: 10,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: typography.fontSize.bodyLg,
    letterSpacing: -0.2,
  },
  formCardBody: {},
  insightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  insightRowSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border_subtle },
  insightLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginRight: 14 },
  insightName: { color: colors.text_primary, fontFamily: typography.fontFamily.medium, fontSize: typography.fontSize.body },
  bandBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  bandBadgeTxt: { fontFamily: typography.fontFamily.bold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },

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
