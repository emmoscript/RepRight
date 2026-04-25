import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';

export function LoginScreen() {
  const nav = useNavigation();
  const setSession = useAuthStore((s) => s.setSession);
  const participantId = useAuthStore((s) => s.participantId);
  const [email, setEmail] = useState('');

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@university.edu"
        placeholderTextColor={colors.text_muted}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />
      <PrimaryButton
        title="Log in"
        onPress={() => {
          if (email.trim()) setSession(email.trim(), participantId);
          nav.navigate('Home' as never);
        }}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3, padding: 24, paddingTop: 24 },
  label: { color: colors.text_secondary, fontSize: 14, fontFamily: typography.fontFamily.medium },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border_medium,
    borderRadius: 10,
    padding: 14,
    color: colors.text_primary,
    fontSize: 16,
  },
});
