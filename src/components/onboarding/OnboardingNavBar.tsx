import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  onBack?: () => void;
  onContinue?: () => void;
  backDisabled?: boolean;
  continueDisabled?: boolean;
  showContinue?: boolean;
};

export function OnboardingNavBar({
  onBack,
  onContinue,
  backDisabled = false,
  continueDisabled = false,
  showContinue = true,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        disabled={backDisabled}
        onPress={onBack}
        style={({ pressed }) => [
          styles.btn,
          styles.backBtn,
          backDisabled && styles.btnDisabled,
          pressed && !backDisabled && styles.pressed,
        ]}
      >
        <Ionicons
          name="arrow-back"
          size={18}
          color={backDisabled ? colors.text_muted : colors.on_surface}
          style={styles.backIcon}
        />
        <Text style={[styles.label, backDisabled && styles.labelDisabled]}>{t('onboarding.back')}</Text>
      </Pressable>

      {showContinue ? (
        <Pressable
          accessibilityRole="button"
          disabled={continueDisabled}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.btn,
            styles.continueBtn,
            continueDisabled && styles.continueDisabled,
            pressed && !continueDisabled && styles.pressed,
          ]}
        >
          <Text style={[styles.label, styles.continueLabel]}>{t('onboarding.continue')}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.text_on_green} style={styles.fwdIcon} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    minHeight: 48,
  },
  backBtn: {
    borderWidth: 1,
    borderColor: colors.outline,
  },
  continueBtn: {
    backgroundColor: colors.primary_green,
  },
  continueDisabled: {
    opacity: 0.5,
  },
  btnDisabled: {
    opacity: 0.45,
    borderColor: 'rgba(132,149,133,0.35)',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodySm,
    letterSpacing: 0.3,
    color: colors.on_surface,
  },
  labelDisabled: {
    color: colors.text_muted,
  },
  continueLabel: {
    color: colors.text_on_green,
  },
  backIcon: { marginRight: 6 },
  fwdIcon: { marginLeft: 6 },
  spacer: { flex: 1 },
});
