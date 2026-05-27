import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
  style?: StyleProp<ViewStyle>;
  /** Optional trailing node — absolutely positioned right; title stays visually centered. */
  trailing?: React.ReactNode;
};

export function PrimaryButton({ title, onPress, disabled, variant = 'primary', style, trailing }: Props) {
  const bg =
    variant === 'danger'
      ? colors.error_container
      : variant === 'ghost'
        ? 'transparent'
        : colors.primary_green;
  const borderColor = variant === 'ghost' ? colors.border_medium : 'transparent';

  const labelColor =
    variant === 'ghost'
      ? colors.text_primary
      : variant === 'danger'
        ? colors.text_on_error
        : colors.text_on_green;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        trailing ? styles.baseWithTrailing : undefined,
        { backgroundColor: bg, borderWidth: variant === 'ghost' ? 1 : 0, borderColor },
        pressed && { opacity: 0.9 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {trailing ? (
        <View style={styles.trailingWrap}>
          <Text style={[styles.label, styles.labelBold, styles.labelCentered, { color: labelColor }]}>{title}</Text>
          <View style={styles.trailingAbs} pointerEvents="none">
            {trailing}
          </View>
        </View>
      ) : (
        <Text style={[styles.label, styles.labelBold, { color: labelColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const ICON_GUTTER = 44;

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  baseWithTrailing: {
    paddingHorizontal: 22,
    position: 'relative',
  },
  trailingWrap: {
    width: '100%',
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ICON_GUTTER,
  },
  trailingAbs: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: ICON_GUTTER - 10,
  },
  label: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.bodySm,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.capsWide,
    textAlign: 'center',
  },
  labelBold: {
    fontWeight: '700',
  },
  labelCentered: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
});
