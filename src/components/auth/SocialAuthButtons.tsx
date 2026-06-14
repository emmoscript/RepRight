import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  mode: 'login' | 'signup';
  disabled?: boolean;
  onGooglePress: () => void;
  onApplePress: () => void;
};

export function SocialAuthButtons({ mode, disabled = false, onGooglePress, onApplePress }: Props) {
  const { t } = useTranslation();
  const showApple = Platform.OS === 'ios';

  const oauthHint = mode === 'signup' ? t('auth.oauthHint') : null;
  const googleLabel = mode === 'signup' ? t('auth.googleSignUp') : t('auth.googleContinue');
  const appleLabel = mode === 'signup' ? t('auth.appleSignUp') : t('auth.appleContinue');

  return (
    <View style={styles.wrap}>
      {oauthHint ? <Text style={styles.hint}>{oauthHint}</Text> : null}

      <View style={[styles.row, !showApple && styles.rowSolo]}>
        <Pressable
          style={[styles.chip, styles.chipFlex, disabled && styles.chipDisabled]}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onGooglePress}
        >
          <Ionicons name="logo-google" size={20} color={colors.text_primary} />
          <Text style={styles.chipLab} numberOfLines={2}>
            {googleLabel}
          </Text>
        </Pressable>

        {showApple ? (
          <Pressable
            style={[styles.chip, styles.chipFlex, styles.appleChip, disabled && styles.chipDisabled]}
            accessibilityRole="button"
            disabled={disabled}
            onPress={onApplePress}
          >
            <Ionicons name="logo-apple" size={20} color={colors.text_primary} />
            <Text style={styles.chipLab} numberOfLines={2}>
              {appleLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  hint: {
    textAlign: 'center',
    color: colors.text_muted,
    fontSize: typography.fontSize.captions,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  rowSolo: {
    flexDirection: 'column',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface_v3,
    borderWidth: 1,
    borderColor: colors.border_subtle,
    minHeight: 48,
  },
  appleChip: {
    backgroundColor: colors.bg_high,
  },
  chipFlex: {
    flex: 1,
    minWidth: 0,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipLab: {
    marginLeft: 8,
    flexShrink: 1,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 12,
    color: colors.text_primary,
    textAlign: 'center',
  },
});
