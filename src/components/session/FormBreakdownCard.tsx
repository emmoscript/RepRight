import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { BiomechanicalError } from '@/modules/analyzer';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import type { RecordedFormError } from '@/types/recordedFormError';
import { focusErrorIds, groupFormErrorsByRep } from '@/utils/formBreakdown';

const COMPACT_GROUP_LIMIT = 4;

function severityColor(severity: RecordedFormError['severity']): string {
  if (severity === 'critical') return colors.accent_red;
  if (severity === 'warning') return colors.accent_yellow;
  return colors.primary_green;
}

type Props = {
  errors: BiomechanicalError[];
  variant?: 'full' | 'compact';
  style?: object;
};

export function FormBreakdownCard({ errors, variant = 'full', style }: Props) {
  const { t } = useTranslation();
  const groups = groupFormErrorsByRep(errors);
  const focus = focusErrorIds(errors);
  const compact = variant === 'compact';
  const visibleGroups = compact ? groups.slice(0, COMPACT_GROUP_LIMIT) : groups;
  const hiddenCount = compact ? Math.max(0, groups.length - COMPACT_GROUP_LIMIT) : 0;

  if (groups.length === 0) {
    return (
      <View style={[styles.card, style]}>
        <View style={styles.titleRow}>
          <MaterialIcons name="analytics" size={22} color={colors.primary_green} />
          <Text style={styles.title}>{t('sessionComplete.formBreakdown')}</Text>
        </View>
        <Text style={styles.empty}>{t('sessionComplete.formBreakdownEmpty')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      <View style={styles.titleRow}>
        <MaterialIcons name="analytics" size={22} color={colors.primary_green} />
        <Text style={styles.title}>{t('sessionComplete.formBreakdown')}</Text>
      </View>

      {focus.length > 0 ? (
        <View style={[styles.focusBlock, compact && styles.focusBlockCompact]}>
          <Text style={styles.focusTitle}>{t('sessionComplete.focusTitle')}</Text>
          <Text style={styles.focusLine} numberOfLines={compact ? 2 : 3}>
            {focus
              .slice(0, compact ? 2 : 3)
              .map((id) => t(`formErrorTitles.${id}`))
              .join(' · ')}
          </Text>
        </View>
      ) : null}

      {visibleGroups.map((group) => (
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
            <FormErrorRow
              key={`${err.errorId}-${err.frameTimestamp}`}
              error={err}
              t={t}
              compact={compact}
            />
          ))}
        </View>
      ))}

      {hiddenCount > 0 ? (
        <Text style={styles.moreHint}>
          {t('sessionDetail.moreFormIssues', { count: hiddenCount })}
        </Text>
      ) : null}
    </View>
  );
}

function FormErrorRow({
  error,
  t,
  compact,
}: {
  error: RecordedFormError;
  t: (key: string, opts?: Record<string, unknown>) => string;
  compact: boolean;
}) {
  const dot = severityColor(error.severity);
  const phaseLabel = t(`formPhases.${error.phase}`);

  return (
    <View style={styles.errorRow}>
      <View style={[styles.errorDot, { backgroundColor: dot }]} />
      <View style={styles.errorBody}>
        <Text style={styles.errorTitle}>{t(`formErrorTitles.${error.errorId}`)}</Text>
        <Text style={styles.errorMeta}>{phaseLabel}</Text>
        {!compact ? (
          <Text style={styles.errorFix}>{t(`formErrors.${error.errorId}`)}</Text>
        ) : null}
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
  cardCompact: {
    marginTop: 0,
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
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface_v3,
  },
  focusBlockCompact: {
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  focusTitle: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  focusLine: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
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
  moreHint: {
    marginTop: 8,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
  },
});
