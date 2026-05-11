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
    variant === 'danger'
      ? colors.error_container
      : variant === 'ghost'
        ? 'transparent'
        : colors.primary_green;
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
          {
            color:
              variant === 'ghost'
                ? colors.text_primary
                : variant === 'danger'
                  ? colors.text_on_error
                  : colors.text_on_green,
          },
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
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.bodySm,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.capsWide,
  },
});
