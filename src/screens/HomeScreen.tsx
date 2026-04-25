import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';

export function HomeScreen() {
  const nav = useNavigation();
  const { participantId } = useAuthStore();
  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Train</Text>
      <Text style={styles.meta}>Participant {participantId}</Text>
      <View style={styles.spacer} />
      <PrimaryButton
        title="Start session"
        onPress={() => nav.navigate('ConfigureSession' as never)}
      />
      <View style={styles.row}>
        <PrimaryButton
          title="Stats"
          variant="ghost"
          onPress={() => nav.navigate('Stats' as never)}
          style={{ flex: 1, marginTop: 12 }}
        />
        <View style={{ width: 12 }} />
        <PrimaryButton
          title="Profile"
          variant="ghost"
          onPress={() => nav.navigate('Profile' as never)}
          style={{ flex: 1, marginTop: 12 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3, padding: 24, paddingTop: 48 },
  h1: { color: colors.text_primary, fontSize: 28, fontFamily: typography.fontFamily.bold },
  meta: { color: colors.text_muted, marginTop: 8, fontSize: 14 },
  spacer: { flex: 1, minHeight: 24 },
  row: { flexDirection: 'row' },
});
