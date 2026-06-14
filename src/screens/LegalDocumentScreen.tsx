import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LEGAL_URLS } from '@/constants/legal';
import { getLegalDocument, type LegalDocType } from '@/content/legalDocuments';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'LegalDocument'>;

export function LegalDocumentScreen() {
  const { t, i18n } = useTranslation();
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const docType: LegalDocType = route.params.type;

  const lang = i18n.language.startsWith('es') ? 'es' : 'en';
  const doc = useMemo(() => getLegalDocument(docType, lang), [docType, lang]);
  const publicUrl = docType === 'privacy' ? LEGAL_URLS.privacy : LEGAL_URLS.terms;

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {doc.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>
          {t('legal.lastUpdated', { date: doc.lastUpdated })}
        </Text>

        {doc.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((p) => (
              <Text key={p.slice(0, 40)} style={styles.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <Pressable
          style={styles.linkBtn}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(publicUrl)}
        >
          <Ionicons name="open-outline" size={18} color={colors.primary_green} />
          <Text style={styles.linkTxt}>{t('legal.openInBrowser')}</Text>
        </Pressable>
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
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  updated: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.captions,
    color: colors.text_muted,
    marginBottom: 20,
  },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.body,
    color: colors.text_primary,
    marginBottom: 10,
  },
  paragraph: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
    color: colors.text_secondary,
    lineHeight: 22,
    marginBottom: 10,
  },
  linkBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
  },
  linkTxt: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.body,
    color: colors.primary_green,
  },
});
