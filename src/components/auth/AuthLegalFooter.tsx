import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '@/navigation/routeTypes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function LegalLinkRow(props: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={props.onPress}
      style={[styles.linkRow, props.last && styles.linkRowLast]}
    >
      <Text style={styles.linkLabel}>{props.label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.text_muted} />
    </Pressable>
  );
}

export function AuthLegalFooter() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  return (
    <View style={styles.wrap}>
      <Text style={styles.disclaimer}>{t('auth.legalAgreeDisclaimer')}</Text>
      <View style={styles.linksCard}>
        <LegalLinkRow
          label={t('profile.termsOfUse')}
          onPress={() => nav.navigate('LegalDocument', { type: 'terms' })}
        />
        <LegalLinkRow
          label={t('profile.privacyPolicy')}
          onPress={() => nav.navigate('LegalDocument', { type: 'privacy' })}
          last
        />
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => nav.navigate('Support')}
        style={styles.supportLink}
      >
        <Text style={styles.supportTxt}>{t('profile.supportContact')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border_subtle,
  },
  disclaimer: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.captions,
    color: colors.text_muted,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  linksCard: {
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border_subtle,
  },
  linkRowLast: {
    borderBottomWidth: 0,
  },
  linkLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.bodySm,
    color: colors.text_primary,
  },
  supportLink: {
    marginTop: 14,
    alignSelf: 'center',
  },
  supportTxt: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captions,
    color: colors.primary_green,
  },
});
