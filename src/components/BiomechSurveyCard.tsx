import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { navigateToBiomechSurvey } from '@/lib/openBiomechSurvey';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  variant: 'home' | 'profile';
  isGuest: boolean;
  accountEmail: string | null;
};

export function BiomechSurveyCard({ variant, isGuest, accountEmail }: Props) {
  const { t } = useTranslation();

  const accountDisplay = isGuest ? t('common.guest') : accountEmail?.trim() || '—';

  const handleOpen = useCallback(() => {
    navigateToBiomechSurvey();
  }, []);

  if (variant === 'profile') {
    return (
      <Pressable
        style={styles.profileCard}
        accessibilityRole="button"
        onPress={handleOpen}
      >
        <Ionicons name="clipboard-outline" size={22} color={colors.primary_green} />
        <View style={styles.profileBody}>
          <Text style={styles.profileTitle}>{t('home.surveyCard.profileTitle')}</Text>
          <Text style={styles.profileSub}>{t('home.surveyCard.profileBody')}</Text>
          {!isGuest && accountEmail ? (
            <Text style={styles.profileEmail}>{accountDisplay}</Text>
          ) : isGuest ? (
            <Text style={styles.profileEmail}>{t('home.surveyCard.guestHint')}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary_green} />
      </Pressable>
    );
  }

  return (
    <View style={styles.homeCard}>
      <View style={styles.homeTop}>
        <View style={styles.homeIconWrap}>
          <Ionicons name="school-outline" size={20} color={colors.primary_green} />
        </View>
        <View style={styles.homeText}>
          <Text style={styles.homeKicker}>{t('home.surveyPrompt.kicker')}</Text>
          <Text style={styles.homeTitle}>{t('home.surveyCard.homeTitle')}</Text>
          <Text style={styles.homeBody}>{t('home.surveyCard.homeBody')}</Text>
          {!isGuest && accountEmail ? (
            <Text style={styles.homeEmailHint}>{t('home.surveyPrompt.emailHint')}</Text>
          ) : isGuest ? (
            <Text style={styles.homeEmailHint}>{t('home.surveyCard.guestHint')}</Text>
          ) : null}
        </View>
      </View>
      <Pressable
        style={styles.homeCta}
        accessibilityRole="button"
        onPress={handleOpen}
      >
        <Text style={styles.homeCtaTxt}>{t('home.surveyCard.cta')}</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.text_on_green} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  homeCard: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: colors.green_subtle_bg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary_green,
    padding: 16,
  },
  homeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  homeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bg_v3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  homeText: { flex: 1 },
  homeKicker: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  homeTitle: {
    marginTop: 4,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
  },
  homeBody: {
    marginTop: 6,
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.text_secondary,
    lineHeight: 19,
  },
  homeEmailHint: {
    marginTop: 8,
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.text_muted,
    lineHeight: 16,
  },
  homeCta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary_green,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  homeCtaTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_on_green,
  },
  profileCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.green_subtle_bg,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary_green,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  profileBody: { flex: 1 },
  profileTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
  },
  profileSub: {
    marginTop: 4,
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.text_secondary,
    lineHeight: 17,
  },
  profileEmail: {
    marginTop: 6,
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    color: colors.text_muted,
  },
});
