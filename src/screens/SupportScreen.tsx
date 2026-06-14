import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SUPPORT_EMAIL } from '@/constants/legal';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SupportScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();

  const openEmail = () => {
    const subject = encodeURIComponent('RepRight Support');
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => nav.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text_primary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('support.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Ionicons name="mail-outline" size={28} color={colors.primary_green} />
          <Text style={styles.cardTitle}>{t('support.emailTitle')}</Text>
          <Text style={styles.cardBody}>{t('support.emailBody')}</Text>
          <Pressable style={styles.emailBtn} accessibilityRole="link" onPress={openEmail}>
            <Text style={styles.emailTxt}>{SUPPORT_EMAIL}</Text>
            <Ionicons name="open-outline" size={16} color={colors.primary_green} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <Ionicons name="help-circle-outline" size={28} color={colors.primary_green} />
          <Text style={styles.cardTitle}>{t('support.helpTitle')}</Text>
          <Text style={styles.cardBody}>{t('support.helpBody')}</Text>
        </View>

        <View style={styles.card}>
          <Ionicons name="school-outline" size={28} color={colors.primary_green} />
          <Text style={styles.cardTitle}>{t('support.researchTitle')}</Text>
          <Text style={styles.cardBody}>{t('support.researchBody')}</Text>
        </View>

        <Text style={styles.footer}>{t('support.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg_v3 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodyLg,
    color: colors.text_primary,
  },
  headerSpacer: { width: 44 },
  scroll: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  card: {
    backgroundColor: colors.surface_low,
    borderRadius: 14,
    padding: 18,
  },
  cardTitle: {
    marginTop: 12,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
  },
  cardBody: {
    marginTop: 8,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    color: colors.text_secondary,
    lineHeight: 22,
  },
  emailBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emailTxt: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.body,
    color: colors.primary_green,
  },
  footer: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.captions,
    color: colors.text_muted,
    lineHeight: 18,
  },
});
