import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

const HERO_IMAGE = require('../../../assets/images/man-deadlifting.jpg');

type Props = {
  onCreate: () => void;
  onLogin: () => void;
  onGuest: () => void;
};

export function GetStartedPanel({ onCreate, onLogin, onGuest }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Image source={HERO_IMAGE} style={styles.heroImg} resizeMode="cover" />
        <View style={styles.heroOverlay} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{t('onboarding.getStartedTitle')}</Text>
        <Text style={styles.sub}>{t('onboarding.getStartedSub')}</Text>
      </View>

      <View style={styles.actions}>
        <PillButton label={t('onboarding.createAccount')} variant="primary" onPress={onCreate} />
        <PillButton label={t('onboarding.logIn')} variant="outline" onPress={onLogin} />
        <View style={styles.guestBlock}>
          <Pressable onPress={onGuest} hitSlop={8}>
            <Text style={styles.guestLink}>{t('onboarding.continueGuest')}</Text>
          </Pressable>
          <Text style={styles.guestHint}>{t('onboarding.guestHint')}</Text>
        </View>
      </View>
    </View>
  );
}

function PillButton({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: 'primary' | 'outline';
  onPress: () => void;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        primary ? styles.pillPrimary : styles.pillOutline,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.pillLabel, primary ? styles.pillLabelPrimary : styles.pillLabelOutline]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
  },
  hero: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface_container,
    marginBottom: 24,
  },
  heroImg: { width: '100%', height: '100%', opacity: 0.55 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,13,0.55)',
  },
  copy: {
    gap: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: colors.on_surface,
  },
  sub: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    lineHeight: 24,
    color: colors.text_secondary,
    maxWidth: 340,
  },
  actions: {
    gap: 12,
  },
  guestBlock: {
    alignItems: 'center',
    paddingTop: 8,
    gap: 6,
  },
  guestLink: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_secondary,
    letterSpacing: 0.3,
  },
  guestHint: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 10,
    color: colors.text_muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  pill: {
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  pillPrimary: {
    backgroundColor: colors.primary_green,
  },
  pillOutline: {
    borderWidth: 1,
    borderColor: colors.outline,
  },
  pillLabel: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodySm,
    letterSpacing: 0.3,
  },
  pillLabelPrimary: {
    color: colors.text_on_green,
  },
  pillLabelOutline: {
    color: colors.on_surface,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
