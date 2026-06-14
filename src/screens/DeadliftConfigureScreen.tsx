import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, InteractionManager, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { REPS_PER_SET_MAX, REPS_PER_SET_MIN, RepsSlider } from '@/components/RepsSlider';
import { SetPlanRow } from '@/components/SetPlanRow';
import type { WorkoutStackNav } from '@/navigation/routeTypes';
import { diagBreadcrumb } from '@/lib/crashDiag';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { useUserPreferencesStore } from '@/store/userPreferencesStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { clampMass, parseMassDraft, weightPlaceholder, weightUnitSuffix } from '@/utils/weightUnits';

const SET_OPTS = [2, 3, 4, 5] as const;
const WORKOUT_BG = require('../../assets/images/man-deadlifting.jpg');

export function DeadliftConfigureScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<WorkoutStackNav>();
  const numSets = useSessionConfigStore((s) => s.setCount);
  const repsPerSet = useSessionConfigStore((s) => s.repsPerSet);
  const customSetPlan = useSessionConfigStore((s) => s.customSetPlan);
  const setPlans = useSessionConfigStore((s) => s.setPlans);
  const weightUnit = useUserPreferencesStore((s) => s.weightUnit);
  const weightAmount = useSessionConfigStore((s) => s.weightAmount);
  const patch = useSessionConfigStore((s) => s.patch);
  const setSetCount = useSessionConfigStore((s) => s.setSetCount);
  const setCustomSetPlan = useSessionConfigStore((s) => s.setCustomSetPlan);
  const updateSetPlanRow = useSessionConfigStore((s) => s.updateSetPlanRow);

  const [weightDraft, setWeightDraft] = useState(() => String(weightAmount));

  useEffect(() => {
    patch({ exercise: 'conventional_deadlift' });
  }, [patch]);

  useFocusEffect(
    useCallback(() => {
      const prefUnit = useUserPreferencesStore.getState().weightUnit;
      const configUnit = useSessionConfigStore.getState().weightUnit;
      if (configUnit !== prefUnit) {
        void useUserPreferencesStore.getState().setWeightUnit(prefUnit);
      }
    }, []),
  );

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

  const unitLabel = weightUnitSuffix(weightUnit);

  const planSummary = useMemo(() => {
    if (customSetPlan) {
      const reps = setPlans.map((r) => r.reps).join(' · ');
      return t('deadliftConfigure.planCustom', { sets: numSets, repsList: reps });
    }
    return t('deadliftConfigure.planSame', {
      sets: numSets,
      reps: repsPerSet,
      weight: weightAmount,
      unit: unitLabel,
    });
  }, [customSetPlan, numSets, repsPerSet, setPlans, weightAmount, unitLabel, t]);

  const startLiveSession = useCallback(() => {
    diagBreadcrumb('deadlift_configure:start_session_tap');
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        diagBreadcrumb('deadlift_configure:navigate_live_session');
        nav.navigate('LiveSession');
      });
    });
  }, [nav]);

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
            <Text style={styles.title}>{t('deadliftConfigure.title')}</Text>
            <Text style={styles.meta}>{t('deadliftConfigure.meta')}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeading}>{t('deadliftConfigure.volume')}</Text>

          <Text style={styles.fieldLab}>{t('deadliftConfigure.sets')}</Text>
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

          <Text style={[styles.fieldLab, { marginTop: 20 }]}>{t('deadliftConfigure.repTarget')}</Text>
          <View style={styles.planToggleRow}>
            <Pressable
              onPress={() => setCustomSetPlan(false)}
              style={[styles.planSeg, !customSetPlan ? styles.planSegOn : styles.planSegOff]}
            >
              <Text style={[styles.planSegTxt, !customSetPlan ? styles.planSegTxtOn : styles.planSegTxtOff]}>
                {t('deadliftConfigure.sameEachSet')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCustomSetPlan(true)}
              style={[styles.planSeg, customSetPlan ? styles.planSegOn : styles.planSegOff]}
            >
              <Text style={[styles.planSegTxt, customSetPlan ? styles.planSegTxtOn : styles.planSegTxtOff]}>
                {t('deadliftConfigure.varyBySet')}
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
            <Text style={styles.customHint}>{t('deadliftConfigure.customHint')}</Text>
          )}

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionHeading}>{t('deadliftConfigure.load')}</Text>

          {!customSetPlan ? (
            <>
              <Text style={[styles.fieldLab, { marginTop: 14 }]}>{t('deadliftConfigure.workingWeight')}</Text>
              <View style={styles.weightInputShell}>
                <TextInput
                  placeholder={weightPlaceholder(weightUnit)}
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
                  setLabel={t('deadliftConfigure.setLabel', { n: i + 1 })}
                  row={row}
                  unitLabel={unitLabel}
                  onChange={(p) => updateSetPlanRow(i, p)}
                />
              ))}
            </View>
          )}

          <View style={styles.summaryStrip}>
            <Text style={styles.summaryLab}>{t('deadliftConfigure.sessionPlan')}</Text>
            <Text style={styles.summaryVal}>{planSummary}</Text>
          </View>

          <Text style={styles.footerNote}>{t('deadliftConfigure.footerNote')}</Text>

          <PrimaryButton title={t('deadliftConfigure.startSession')} onPress={startLiveSession} style={styles.startBtn} />
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
