import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/theme/colors';
export function EmailConfirmScreen() {
  const nav = useNavigation();
  const [code, setCode] = useState('');
  return (
    <View style={styles.root}>
      <Text style={styles.p}>Enter the 6-digit code sent to your email.</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="000000"
        placeholderTextColor={colors.text_muted}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.input}
      />
      <PrimaryButton title="Verify" onPress={() => nav.navigate('Home' as never)} style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3, padding: 24 },
  p: { color: colors.text_secondary, fontSize: 16, lineHeight: 24, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border_medium,
    borderRadius: 10,
    padding: 14,
    color: colors.text_primary,
    fontSize: 22,
    letterSpacing: 4,
  },
});
