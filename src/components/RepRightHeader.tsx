import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, ICONS } from '@/components/Icon';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  variant?: 'main' | 'auth';
  showBack?: boolean;
  /** Auth: fitness_center style wordmark hint */
  rightSlot?: React.ReactNode;
};

export function RepRightHeader({ variant = 'main', showBack = false, rightSlot }: Props) {
  const nav = useNavigation();
  return (
    <View style={[styles.bar, variant === 'auth' && styles.barAuth]}>
      <View style={styles.left}>
        {showBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => nav.goBack()}
            style={styles.backHit}
          >
            <Icon name={ICONS.arrowBack} size={20} color={colors.text_primary} />
          </Pressable>
        )}
        <Icon name={ICONS.flash} size={20} color={colors.primary_green} />
        <Text style={[styles.wordmark, variant === 'auth' && styles.wordmarkSm]} numberOfLines={1}>
          {variant === 'auth' ? 'RepRight' : 'REPRIGHT'}
        </Text>
      </View>
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 72,
    backgroundColor: colors.nav_bar_bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border_subtle,
  },
  barAuth: {
    backgroundColor: colors.bg_surface_alt,
    borderBottomWidth: 0,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  right: { marginLeft: 12 },
  backHit: {
    marginRight: 12,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
    borderRadius: 9999,
    backgroundColor: 'rgba(38,38,38,0.82)',
  },
  backArrow: {
    color: colors.text_primary,
    fontSize: 20,
    fontFamily: typography.fontFamily.semibold,
    lineHeight: 22,
  },
  wordmark: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    letterSpacing: typography.letterSpacing.capsWide,
  },
  wordmarkSm: {
    fontSize: 17,
    letterSpacing: 0,
  },
});
