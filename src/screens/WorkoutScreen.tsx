import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EXERCISE_CATALOG } from '@/constants/exercises';
import { RepRightHeader } from '@/components/RepRightHeader';
import type { WorkoutStackNav } from '@/navigation/routeTypes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export function WorkoutScreen() {
  const nav = useNavigation<WorkoutStackNav>();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <RepRightHeader />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Workout</Text>
          <Text style={styles.meta}>Choose an exercise to configure and start</Text>

          <Text style={styles.sectionLab}>Exercises</Text>
          {EXERCISE_CATALOG.map((ex) => {
            const locked = !ex.available;
            return (
              <Pressable
                key={ex.id}
                disabled={locked}
                onPress={() => {
                  if (ex.configureScreen) nav.navigate(ex.configureScreen);
                }}
                style={[styles.card, locked ? styles.cardLocked : styles.cardActive]}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, locked && styles.cardTitleMuted]}>{ex.title}</Text>
                  {locked ? (
                    <Ionicons name="lock-closed-outline" color={colors.text_muted} size={22} />
                  ) : (
                    <Ionicons name="chevron-forward" color={colors.primary_green} size={22} />
                  )}
                </View>
                <Text
                  style={[
                    styles.trackLab,
                    locked ? styles.trackLabMuted : styles.trackLabLive,
                  ]}
                >
                  {ex.trackingLabel}
                </Text>
                <Text style={[styles.cardSub, locked && styles.cardSubMuted]}>{ex.subtitle}</Text>
                {!locked && <Text style={styles.cardCta}>Configure session →</Text>}
              </Pressable>
            );
          })}

          <View style={{ height: 104 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3 },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  title: {
    marginTop: 8,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.screenTitle,
    letterSpacing: -2,
    textTransform: 'uppercase',
  },
  meta: {
    marginTop: 8,
    color: colors.text_secondary,
    fontSize: typography.fontSize.bodySm,
    lineHeight: 20,
  },
  sectionLab: {
    marginTop: 28,
    marginBottom: 4,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.captionCaps + 2,
    letterSpacing: typography.letterSpacing.capsWide,
    textTransform: 'uppercase',
  },
  card: {
    marginTop: 12,
    borderRadius: 14,
    padding: 18,
    backgroundColor: colors.bg_elevated,
  },
  cardActive: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary_green,
  },
  cardLocked: {
    opacity: 0.48,
    borderLeftWidth: 4,
    borderLeftColor: colors.border_subtle,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.text_primary,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodyLg,
  },
  cardTitleMuted: { color: colors.text_secondary },
  trackLab: {
    marginTop: 10,
    letterSpacing: typography.letterSpacing.capsWide,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.captionCaps + 1,
    textTransform: 'uppercase',
  },
  trackLabLive: { color: colors.primary_green },
  trackLabMuted: { color: colors.text_muted },
  cardSub: {
    marginTop: 8,
    color: colors.text_secondary,
    fontSize: typography.fontSize.captions,
    lineHeight: 18,
  },
  cardSubMuted: { color: colors.text_muted },
  cardCta: {
    marginTop: 12,
    color: colors.primary_green,
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.bodySm,
  },
});
