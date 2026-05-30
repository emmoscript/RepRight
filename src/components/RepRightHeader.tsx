import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, ICONS } from '@/components/Icon';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Props = {
  variant?: 'main' | 'auth' | 'sessionComplete';
  showBack?: boolean;
  /** Auth: fitness_center style wordmark hint */
  rightSlot?: React.ReactNode;
};

export function RepRightHeader({
  variant = 'main',
  showBack = false,
  rightSlot,
}: Props) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const isSessionComplete = variant === 'sessionComplete';
  const topInset = Math.max(insets.top, 8);

  return (
    <View
      style={[
        styles.bar,
        variant === 'auth' && styles.barAuth,
        isSessionComplete && styles.barSessionComplete,
        { paddingTop: topInset + 2 },
      ]}
    >
      <View style={[styles.contentRow, isSessionComplete && styles.contentRowSessionComplete]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: colors.nav_bar_bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border_subtle,
  },
  barSessionComplete: {
    paddingBottom: 10,
  },
  barAuth: {
    backgroundColor: colors.bg_surface_alt,
    borderBottomWidth: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  contentRowSessionComplete: {
    minHeight: 36,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  right: {
    marginLeft: 12,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  wordmark: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.display,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: typography.letterSpacing.capsWide,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  wordmarkSm: {
    fontSize: 17,
    letterSpacing: 0,
  },
});
