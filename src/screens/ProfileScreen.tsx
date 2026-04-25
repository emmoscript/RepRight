import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export function ProfileScreen() {
  const nav = useNavigation();
  const { email, participantId, logout, isLoggedIn } = useAuthStore();
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.label}>Participant ID</Text>
        <Text style={styles.v}>{participantId}</Text>
        {email && (
          <>
            <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
            <Text style={styles.v}>{email}</Text>
          </>
        )}
        <Text style={[styles.label, { marginTop: 16 }]}>Session</Text>
        <Text style={styles.v}>{isLoggedIn ? 'Signed in' : 'Guest'}</Text>
      </View>
      <View style={styles.spacer} />
      <PrimaryButton
        title="Log out"
        variant="ghost"
        onPress={() => {
          logout();
          nav.navigate('Demo' as never);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3, padding: 24 },
  card: {
    backgroundColor: colors.bg_surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border_subtle,
  },
  label: { color: colors.text_muted, fontSize: 13, fontFamily: typography.fontFamily.medium },
  v: { color: colors.text_primary, fontSize: 16, marginTop: 4, fontFamily: typography.fontFamily.semibold },
  spacer: { flex: 1 },
});
