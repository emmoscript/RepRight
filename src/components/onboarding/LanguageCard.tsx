import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  label: string;
  flag: string;
  selected: boolean;
  onPress: () => void;
};

export function LanguageCard({ label, flag, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : styles.cardIdle,
        pressed && styles.pressed,
      ]}
    >
      {selected ? (
        <View style={styles.checkWrap}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={14} color={colors.bg_v3} />
          </View>
        </View>
      ) : null}
      <Text style={styles.flag}>{flag}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.surface_card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    position: 'relative',
  },
  cardSelected: {
    borderColor: colors.primary_green,
  },
  cardIdle: {
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.92,
  },
  checkWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary_green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: {
    fontSize: 40,
    marginBottom: 8,
  },
  label: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.bodySm,
    color: colors.on_surface,
    letterSpacing: 0.3,
  },
});
