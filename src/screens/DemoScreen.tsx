import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export function DemoScreen() {
  const nav = useNavigation();
  return (
    <ScrollView contentContainerStyle={styles.scroll} style={styles.root}>
      <Text style={[styles.title, { fontFamily: typography.fontFamily.display }]}>RepRight</Text>
      <Text style={styles.sub}>
        On-device deadlift form feedback using MoveNet — no data leaves your phone.
      </Text>
      <View style={styles.list}>
        <Text style={styles.li}>• 5 form parameters with live coaching</Text>
        <Text style={styles.li}>• 100% on-device (TensorFlow Lite)</Text>
        <Text style={styles.li}>• Built for the UNIBE 2026 thesis study</Text>
      </View>
      <PrimaryButton title="Go to home" onPress={() => nav.navigate('Home' as never)} />
      <PrimaryButton
        title="Log in (demo)"
        variant="ghost"
        onPress={() => nav.navigate('Login' as never)}
        style={{ marginTop: 12 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3 },
  scroll: { padding: 24, paddingTop: 64, paddingBottom: 40 },
  title: {
    color: colors.text_primary,
    fontSize: 32,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 8,
  },
  sub: { color: colors.text_secondary, fontSize: 16, lineHeight: 24, marginBottom: 24 },
  list: { marginBottom: 32 },
  li: { color: colors.text_primary, fontSize: 15, marginBottom: 8 },
});
