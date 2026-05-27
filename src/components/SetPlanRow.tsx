import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { REPS_PER_SET_MAX, REPS_PER_SET_MIN } from '@/components/RepsSlider';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { clampSetReps, type WorkoutSetPlanRow } from '@/utils/setPlan';
import { clampMass, parseMassDraft } from '@/utils/weightUnits';

type Props = {
  setLabel: string;
  row: WorkoutSetPlanRow;
  unitLabel: string;
  onChange: (patch: Partial<WorkoutSetPlanRow>) => void;
};

export function SetPlanRow({ setLabel, row, unitLabel, onChange }: Props) {
  const [weightDraft, setWeightDraft] = React.useState(() => String(row.weightAmount));

  React.useEffect(() => {
    setWeightDraft(String(row.weightAmount));
  }, [row.weightAmount]);

  const commitWeight = () => {
    const n = parseMassDraft(weightDraft);
    if (n == null) {
      setWeightDraft(String(row.weightAmount));
      return;
    }
    onChange({ weightAmount: clampMass(n, unitLabel === 'kg' ? 'kg' : 'lb') });
  };

  const stepReps = (delta: number) => {
    onChange({ reps: clampSetReps(row.reps + delta) });
  };

  return (
    <View style={styles.row}>
      <Text style={styles.setLab}>{setLabel}</Text>
      <View style={styles.weightShell}>
        <TextInput
          value={weightDraft}
          onChangeText={setWeightDraft}
          onBlur={commitWeight}
          onSubmitEditing={commitWeight}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          style={styles.weightInput}
          placeholder="0"
          placeholderTextColor={colors.text_muted}
        />
        <Text style={styles.unitTxt}>{unitLabel}</Text>
      </View>
      <View style={styles.repsBlock}>
        <Pressable
          accessibilityLabel="Fewer reps"
          onPress={() => stepReps(-1)}
          disabled={row.reps <= REPS_PER_SET_MIN}
          style={[styles.repBtn, row.reps <= REPS_PER_SET_MIN && styles.repBtnOff]}
        >
          <Text style={styles.repBtnTxt}>−</Text>
        </Pressable>
        <Text style={styles.repVal}>{row.reps}</Text>
        <Pressable
          accessibilityLabel="More reps"
          onPress={() => stepReps(1)}
          disabled={row.reps >= REPS_PER_SET_MAX}
          style={[styles.repBtn, row.reps >= REPS_PER_SET_MAX && styles.repBtnOff]}
        >
          <Text style={styles.repBtnTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    backgroundColor: colors.bg_elevated,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  setLab: {
    width: 44,
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodySm,
  },
  weightShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface_v3,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  weightInput: {
    flex: 1,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    paddingVertical: 8,
    margin: 0,
  },
  unitTxt: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 1,
    marginLeft: 4,
  },
  repsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface_v3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repBtnOff: { opacity: 0.35 },
  repBtnTxt: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 18,
    lineHeight: 20,
  },
  repVal: {
    minWidth: 28,
    textAlign: 'center',
    color: colors.primary_green,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.bodyLg,
  },
});
