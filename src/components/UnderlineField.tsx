import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = TextInputProps & {
  label: string;
};

export function UnderlineField({ label, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.text_muted}
        style={[
          styles.input,
          { borderBottomColor: focused ? colors.primary_green : colors.border_subtle },
          style,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
    backgroundColor: colors.surface_low,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 0,
    borderRadius: 4,
    overflow: 'hidden',
  },
  label: {
    color: colors.text_secondary,
    fontSize: typography.fontSize.captions,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 8,
  },
  input: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily.regular,
    color: colors.text_primary,
    borderBottomWidth: 2,
    borderRadius: 0,
  },
});
