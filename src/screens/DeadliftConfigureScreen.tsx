import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { REPS_PER_SET_MAX, REPS_PER_SET_MIN, RepsSlider } from '@/components/RepsSlider';
import { SetPlanRow } from '@/components/SetPlanRow';
import type { WorkoutStackNav } from '@/navigation/routeTypes';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { clampMass, convertMass, parseMassDraft, type WeightUnit } from '@/utils/weightUnits';

const SET_OPTS = [2, 3, 4, 5] as const;
const WORKOUT_BG = require('../../assets/images/man-deadlifting.jpg');

export function DeadliftConfigureScreen() {
  const nav = useNavigation<WorkoutStackNav>();
  const numSets = useSessionConfigStore((s) => s.setCount);
  const repsPerSet = useSessionConfigStore((s) => s.repsPerSet);
  const customSetPlan = useSessionConfigStore((s) => s.customSetPlan);
  const setPlans = useSessionConfigStore((s) => s.setPlans);
  const weightUnit = useSessionConfigStore((s) => s.weightUnit);
  const weightAmount = useSessionConfigStore((s) => s.weightAmount);
  const patch = useSessionConfigStore((s) => s.patch);
  const setSetCount = useSessionConfigStore((s) => s.setSetCount);
  const setCustomSetPlan = useSessionConfigStore((s) => s.setCustomSetPlan);
  const updateSetPlanRow = useSessionConfigStore((s) => s.updateSetPlanRow);

  const [weightDraft, setWeightDraft] = useState(() => String(weightAmount));

  useEffect(() => {
    patch({ exercise: 'conventional_deadlift' });
  }, [patch]);

  useEffect(() => {
    setWeightDraft(String(weightAmount));
  }, [weightAmount, weightUnit]);

  const commitWeightDraft = useCallback(() => {
    const n = parseMassDraft(weightDraft);
    if (n == null) {
      setWeightDraft(String(weightAmount));
      return;
    }
    patch({ weightAmount: clampMass(n, weightUnit) });
  }, [weightDraft, weightAmount, weightUnit, patch]);

  const setUnit = (next: WeightUnit) => {
    if (next === weightUnit) return;
    const converted = convertMass(weightAmount, weightUnit, next);
    const convertedPlans = setPlans.map((row) => ({
      ...row,
      weightAmount: convertMass(row.weightAmount, weightUnit, next),
    }));
    patch({ weightUnit: next, weightAmount: converted, setPlans: convertedPlans });
  };

  const unitLabel = weightUnit === 'kg' ? 'kg' : 'lb';

  const planSummary = useMemo(() => {
    if (customSetPlan) {
      const reps = setPlans.map((r) => r.reps).join(' · ');
      return `${numSets} sets · ${reps} reps`;
    }
    return `${numSets} sets · ${repsPerSet} reps · ${weightAmount} ${unitLabel}`;
  }, [customSetPlan, numSets, repsPerSet, setPlans, weightAmount, unitLabel]);

  return (
    <View style={styles.root}>
      <View style={styles.bgLayer} pointerEvents="none">
        <Image source={WORKOUT_BG} style={styles.bgImage} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
      <View style={styles.bgScrim} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to exercises"
            onPress={() => nav.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text_primary} />
          </Pressable>
          <View style={styles.topTitles}>
            <Text style={styles.title}>Deadlift</Text>
            <Text style={styles.meta}>Configure session</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeading}>Volume</Text>

          <Text style={styles.fieldLab}>Sets</Text>
          <View style={styles.pillRow}>
            {SET_OPTS.map((n) => {
              const on = numSets === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setSetCount(n)}
                  style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
                >
                  <Text style={[styles.pillTxt, on ? styles.pillTxtOn : styles.pillTxtOff]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.fieldLab, { marginTop: 20 }]}>Rep target</Text>
          <View style={styles.planToggleRow}>
            <Pressable
              onPress={() => setCustomSetPlan(false)}
              style={[styles.planSeg, !customSetPlan ? styles.planSegOn : styles.planSegOff]}
            >
              <Text style={[styles.planSegTxt, !customSetPlan ? styles.planSegTxtOn : styles.planSegTxtOff]}>
                Same each set
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCustomSetPlan(true)}
              style={[styles.planSeg, customSetPlan ? styles.planSegOn : styles.planSegOff]}
            >
              <Text style={[styles.planSegTxt, customSetPlan ? styles.planSegTxtOn : styles.planSegTxtOff]}>
                Vary by set
              </Text>
            </Pressable>
          </View>

          {!customSetPlan ? (
            <View style={styles.volumeBody}>
              <RepsSlider
                value={Math.min(REPS_PER_SET_MAX, Math.max(REPS_PER_SET_MIN, repsPerSet))}
                onChange={(n) => patch({ repsPerSet: n })}
                min={REPS_PER_SET_MIN}
                max={REPS_PER_SET_MAX}
              />
            </View>
          ) : (
            <Text style={styles.customHint}>
              Set reps (and weight) per row below — e.g. 10 / 8 / 5.
            </Text>
          )}

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionHeading}>Load</Text>
          <Text style={styles.fieldLabSub}>Display & enter weights in</Text>
          <View style={styles.unitToggleRow}>
            <Pressable
              onPress={() => setUnit('kg')}
              style={[styles.unitSeg, weightUnit === 'kg' ? styles.unitSegOn : styles.unitSegOff]}
            >
              <Text style={[styles.unitSegTxt, weightUnit === 'kg' ? styles.unitSegTxtOn : styles.unitSegTxtOff]}>
                kg
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setUnit('lb')}
              style={[styles.unitSeg, weightUnit === 'lb' ? styles.unitSegOn : styles.unitSegOff]}
            >
              <Text style={[styles.unitSegTxt, weightUnit === 'lb' ? styles.unitSegTxtOn : styles.unitSegTxtOff]}>
                lb
              </Text>
            </Pressable>
          </View>

          {!customSetPlan ? (
            <>
              <Text style={[styles.fieldLab, { marginTop: 20 }]}>Working weight</Text>
              <View style={styles.weightInputShell}>
                <TextInput
                  placeholder={weightUnit === 'kg' ? '100' : '225'}
                  placeholderTextColor={colors.text_muted}
                  value={weightDraft}
                  onChangeText={setWeightDraft}
                  onBlur={() => commitWeightDraft()}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => commitWeightDraft()}
                  selectTextOnFocus
                  style={styles.weightInput}
                />
                <Text style={styles.weightSuffix}>{unitLabel}</Text>
              </View>
            </>
          ) : (
            <View style={styles.customPlanBlock}>
              {setPlans.map((row, i) => (
                <SetPlanRow
                  key={i}
                  setLabel={`Set ${i + 1}`}
                  row={row}
                  unitLabel={unitLabel}
                  onChange={(p) => updateSetPlanRow(i, p)}
                />
              ))}
            </View>
          )}

          <View style={styles.summaryStrip}>
            <Text style={styles.summaryLab}>Session plan</Text>
            <Text style={styles.summaryVal}>{planSummary}</Text>
          </View>

          <Text style={styles.footerNote}>
            Reps count automatically. Each set ends at your target or after a few seconds at lockout.
          </Text>

          <PrimaryButton title="START SESSION →" onPress={() => nav.navigate('LiveSession')} style={styles.startBtn} />
          <View style={{ height: 104 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3 },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg_v3,
  },
  bgImage: {
    width: '100%',
    height: '100%',
    opacity: 0.26,
  },
  bgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 13, 13, 0.74)',
  },
  safe: { flex: 1, backgroundColor: 'transparent' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bg_elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitles: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 4 },
  title: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.titleSm + 4,
    letterSpacing: -1,
    textTransform: 'uppercase',
  },
  meta: {
    marginTop: 2,
    color: colors.text_secondary,
    fontSize: typography.fontSize.bodySm,
  },
  sectionHeading: {
    marginTop: 20,
    marginBottom: 4,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodyLg,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border_subtle,
    marginTop: 28,
    marginBottom: 4,
  },
  fieldLab: {
    marginTop: 14,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  fieldLabSub: {
    marginTop: 10,
    color: colors.text_muted,
    fontSize: typography.fontSize.bodySm,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  pill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillOn: { backgroundColor: colors.primary_green },
  pillOff: { backgroundColor: colors.bg_elevated },
  pillTxt: { fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.bodyLg },
  pillTxtOn: { color: colors.text_on_green },
  pillTxtOff: { color: colors.text_secondary },
  planToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  planSeg: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  planSegOn: { backgroundColor: colors.primary_green },
  planSegOff: { backgroundColor: colors.bg_elevated },
  planSegTxt: { fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.bodySm },
  planSegTxtOn: { color: colors.text_on_green },
  planSegTxtOff: { color: colors.text_secondary },
  volumeBody: { marginTop: 4 },
  customHint: {
    marginTop: 12,
    color: colors.text_secondary,
    fontSize: typography.fontSize.bodySm,
    lineHeight: 20,
  },
  unitToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  unitSeg: {
    minWidth: 72,
    minHeight: 40,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  unitSegOn: { backgroundColor: colors.primary_green },
  unitSegOff: { backgroundColor: colors.bg_elevated },
  unitSegTxt: { fontFamily: typography.fontFamily.bold, fontSize: typography.fontSize.body },
  unitSegTxtOn: { color: colors.text_on_green },
  unitSegTxtOff: { color: colors.text_secondary },
  weightInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg_elevated,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
    minHeight: 52,
    paddingHorizontal: 22,
    marginTop: 10,
  },
  weightInput: {
    flex: 1,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodyLg,
    color: colors.text_primary,
    paddingVertical: 14,
    margin: 0,
  },
  weightSuffix: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.body,
    marginLeft: 8,
  },
  customPlanBlock: { marginTop: 16 },
  summaryStrip: {
    marginTop: 28,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface_v3,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary_green,
  },
  summaryLab: {
    color: colors.text_muted,
    fontSize: typography.fontSize.captionCaps + 1,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  summaryVal: {
    marginTop: 6,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.titleSm + 2,
  },
  footerNote: {
    marginTop: 16,
    color: colors.text_muted,
    fontSize: typography.fontSize.captionCaps + 1,
    lineHeight: 18,
  },
  startBtn: { marginTop: 24 },
});
