import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { BiomechanicalError } from '@/modules/analyzer';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import type { RecordedFormError } from '@/types/recordedFormError';
import { focusErrorIds, groupFormErrorsByRep } from '@/utils/formBreakdown';

function severityColor(severity: RecordedFormError['severity']): string {
  if (severity === 'critical') return colors.accent_red;
  if (severity === 'warning') return colors.accent_yellow;
  return colors.primary_green;
}

type Props = {
  errors: BiomechanicalError[];
};

export function FormBreakdownCard({ errors }: Props) {
  const { t } = useTranslation();
  const groups = groupFormErrorsByRep(errors);
  const focus = focusErrorIds(errors);

  if (groups.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <MaterialIcons name="analytics" size={22} color={colors.primary_green} />
          <Text style={styles.title}>{t('sessionComplete.formBreakdown')}</Text>
        </View>
        <Text style={styles.empty}>{t('sessionComplete.formBreakdownEmpty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <MaterialIcons name="analytics" size={22} color={colors.primary_green} />
        <Text style={styles.title}>{t('sessionComplete.formBreakdown')}</Text>
      </View>

      {focus.length > 0 ? (
        <View style={styles.focusBlock}>
          <Text style={styles.focusTitle}>{t('sessionComplete.focusTitle')}</Text>
          {focus.slice(0, 3).map((id) => (
            <Text key={id} style={styles.focusLine}>
              · {t(`formErrorTitles.${id}`)}
            </Text>
          ))}
        </View>
      ) : null}

      {groups.map((group) => (
        <View
          key={`${group.setNumber}-${group.repNumber}`}
          style={styles.repBlock}
        >
          <Text style={styles.repHeading}>
            {group.repNumber <= 0
              ? t('sessionComplete.setSetupLabel', { set: group.setNumber })
              : t('sessionComplete.setRepLabel', {
                  set: group.setNumber,
                  rep: group.repNumber,
                })}
          </Text>
          {group.errors.map((err) => (
            <FormErrorRow key={`${err.errorId}-${err.frameTimestamp}`} error={err} t={t} />
          ))}
        </View>
      ))}
    </View>
  );
}

function FormErrorRow({
  error,
  t,
}: {
  error: RecordedFormError;
  t: (key: string) => string;
}) {
  const dot = severityColor(error.severity);
  const phaseKey = `formPhases.${error.phase}` as const;
  const phaseLabel = t(phaseKey);

  return (
    <View style={styles.errorRow}>
      <View style={[styles.errorDot, { backgroundColor: dot }]} />
      <View style={styles.errorBody}>
        <Text style={styles.errorTitle}>{t(`formErrorTitles.${error.errorId}`)}</Text>
        <Text style={styles.errorMeta}>{phaseLabel}</Text>
        <Text style={styles.errorFix}>{t(`formErrors.${error.errorId}`)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    backgroundColor: colors.bg_elevated,
    borderRadius: 12,
    padding: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
    color: colors.text_primary,
    letterSpacing: -0.2,
  },
  empty: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  focusBlock: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface_v3,
  },
  focusTitle: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  focusLine: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    lineHeight: 20,
  },
  repBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border_subtle,
  },
  repHeading: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 10,
  },
  errorBody: { flex: 1 },
  errorTitle: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  errorMeta: {
    marginTop: 2,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  errorFix: {
    marginTop: 6,
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
  },
});
