import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
  style?: ViewStyle;
};

export function PrimaryButton({ title, onPress, disabled, variant = 'primary', style }: Props) {
  const bg =
    variant === 'danger' ? colors.accent_red : variant === 'ghost' ? 'transparent' : colors.primary_green;
  const borderColor = variant === 'ghost' ? colors.border_medium : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderWidth: variant === 'ghost' ? 1 : 0, borderColor },
        pressed && { opacity: 0.9 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: variant === 'ghost' ? colors.text_primary : '#0A0A0A' },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.lg,
  },
});
