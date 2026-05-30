import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RepRightHeader } from '@/components/RepRightHeader';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const LEN = 6;

export function EmailConfirmScreen() {
  const nav = useNavigation<Nav>();
  const [code, setCode] = useState('');
  const [focusIdx, setFocusIdx] = useState<number | null>(0);
  const inputRef = useRef<TextInput>(null);

  const cells = [...code.padEnd(LEN, ' ')];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <SafeAreaView edges={[]} style={styles.flex}>
        <RepRightHeader
          variant="auth"
          rightSlot={<Ionicons name="mail-outline" size={22} color={colors.primary_green} />}
        />
        <View style={styles.body}>
          <View style={styles.mailIcon}>
            <Ionicons name="mail-outline" size={42} color={colors.text_primary} />
          </View>

          <Text style={styles.title}>Verify email</Text>
          <Text style={styles.sub}>We sent a code to your email.</Text>

          <Pressable style={styles.otpOuter} onPress={() => inputRef.current?.focus()}>
            {cells.slice(0, LEN).map((ch, i) => (
              <View
                key={i}
                style={[
                  styles.cell,
                  focusIdx === i && styles.cellFocus,
                  ch.trim().length === 1 && styles.cellFilled,
                ]}
              >
                <Text style={[styles.cellTxt, ch.trim().length === 1 ? styles.cellTxtActive : styles.cellTxtPh]}>
                  {ch.trim() ? ch : '·'}
                </Text>
              </View>
            ))}
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, LEN))}
              keyboardType="number-pad"
              style={styles.hiddenInput}
              onFocus={() => setFocusIdx(Math.min(code.length, LEN - 1))}
              onBlur={() => setFocusIdx(null)}
              maxLength={LEN}
              caretHidden
            />
          </Pressable>

          <PrimaryButton
            title="Verify & Continue →"
            style={{ marginTop: 28 }}
            onPress={() => nav.navigate('MainTabs', { screen: 'HomeMain' })}
          />

          <Pressable style={styles.resendWrap} accessibilityRole="button">
            <Text style={styles.resend}>
              Didn&apos;t receive the code?{' '}
              <Text style={styles.resendBold}>Resend code</Text>
            </Text>
          </Pressable>

          <View style={styles.infoRow}>
            <View style={styles.infoChip}>
              <Ionicons name="shield-checkmark-outline" color={colors.primary_green} size={20} />
              <Text style={styles.infoTxt}>Encrypted on device</Text>
            </View>
            <View style={styles.infoChip}>
              <Ionicons name="timer-outline" color={colors.primary_green} size={20} />
              <Text style={styles.infoTxt}>Expires soon</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg_surface_alt },
  body: { paddingHorizontal: 24, alignItems: 'center' },
  mailIcon: {
    marginTop: 12,
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: colors.bg_high,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border_subtle,
  },
  title: {
    marginTop: 28,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.titleSm + 10,
    color: colors.text_primary,
    letterSpacing: -1,
    textTransform: 'capitalize',
  },
  sub: {
    marginTop: 12,
    textAlign: 'center',
    color: colors.text_secondary,
    fontSize: typography.fontSize.body,
    lineHeight: 24,
    fontFamily: typography.fontFamily.regular,
    paddingHorizontal: 12,
  },
  otpOuter: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    paddingVertical: 4,
  },
  cell: {
    flex: 1,
    minWidth: 40,
    maxHeight: 56,
    backgroundColor: colors.surface_low,
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: colors.border_subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellFocus: { borderBottomColor: colors.primary_green },
  cellFilled: { borderBottomColor: colors.primary_green },
  cellTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.bodyLg,
  },
  cellTxtPh: { color: colors.text_muted },
  cellTxtActive: { color: colors.primary_green },
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  resendWrap: { marginTop: 20 },
  resend: { color: colors.text_muted, fontSize: typography.fontSize.captions, textAlign: 'center' },
  resendBold: { color: colors.primary_green, fontFamily: typography.fontFamily.bold },
  infoRow: { flexDirection: 'row', gap: 12, marginTop: 40, alignSelf: 'stretch' },
  infoChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface_low,
    borderRadius: 12,
    padding: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.border_subtle,
  },
  infoTxt: { flex: 1, color: colors.text_secondary, fontSize: typography.fontSize.captions },
});
