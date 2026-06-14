import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { navigateToBiomechSurvey } from '@/lib/openBiomechSurvey';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  visible: boolean;
  isGuest: boolean;
  accountEmail: string | null;
  onDismiss: () => void;
};

export function BiomechSurveyPrompt({ visible, isGuest, accountEmail, onDismiss }: Props) {
  const { t } = useTranslation();

  const accountDisplay = isGuest ? t('common.guest') : accountEmail?.trim() || '—';

  const dismissForNow = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const openSurvey = useCallback(() => {
    onDismiss();
    navigateToBiomechSurvey();
  }, [onDismiss]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismissForNow}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.kicker}>{t('home.surveyPrompt.kicker')}</Text>
          <Text style={styles.title}>{t('home.surveyPrompt.title')}</Text>
          <Text style={styles.body}>{t('home.surveyPrompt.body')}</Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{t('home.surveyPrompt.accountLabel')}</Text>
            <Text style={styles.codeValue} selectable>
              {accountDisplay}
            </Text>
            {!isGuest && accountEmail ? (
              <Text style={styles.codeHint}>{t('home.surveyPrompt.emailHint')}</Text>
            ) : null}
          </View>

          <PrimaryButton
            title={t('home.surveyPrompt.cta')}
            onPress={openSurvey}
            style={styles.cta}
          />
          <Pressable
            accessibilityRole="button"
            onPress={dismissForNow}
            style={styles.laterBtn}
          >
            <Text style={styles.laterTxt}>{t('home.surveyPrompt.later')}</Text>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.surface_v3,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border_subtle,
  },
  kicker: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 22,
    color: colors.text_primary,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  body: {
    marginTop: 12,
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  codeBox: {
    marginTop: 18,
    backgroundColor: colors.bg_elevated,
    borderRadius: 12,
    padding: 14,
  },
  codeLabel: {
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  codeValue: {
    marginTop: 6,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.2,
  },
  codeHint: {
    marginTop: 6,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  cta: { marginTop: 20 },
  laterBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  laterTxt: {
    color: colors.text_secondary,
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
  },
});
