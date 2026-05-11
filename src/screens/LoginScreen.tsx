import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RepRightHeader } from '@/components/RepRightHeader';
import { UnderlineField } from '@/components/UnderlineField';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { useAuthStore } from '@/store/authStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LoginScreen() {
  const nav = useNavigation<Nav>();
  const setSession = useAuthStore((s) => s.setSession);
  const participantId = useAuthStore((s) => s.participantId);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <RepRightHeader variant="auth" showBack />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Log in to track your progress and hit your goals.</Text>

          <View style={{ height: 20 }} />

          <UnderlineField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@university.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={{ marginBottom: 4 }}>
            <UnderlineField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <Pressable style={styles.forgotWrap} accessibilityRole="button">
            <Text style={styles.forgotTxt}>Forgot password?</Text>
          </Pressable>

          <PrimaryButton
            title="Log In →"
            style={{ marginTop: 28 }}
            onPress={() => {
              if (email.trim()) setSession(email.trim(), participantId);
              nav.navigate('MainTabs', { screen: 'HomeMain' });
            }}
          />

          <View style={styles.divWrap}>
            <View style={styles.divLine} />
            <Text style={styles.divTxt}>Or continue with</Text>
            <View style={styles.divLine} />
          </View>

          <View style={styles.socialRow}>
            <Pressable style={styles.socialChip} accessibilityRole="button">
              <Ionicons name="logo-google" size={20} color={colors.text_primary} />
              <Text style={styles.socialLab}>Google</Text>
            </Pressable>
            <Pressable style={styles.socialChip} accessibilityRole="button">
              <Ionicons name="logo-apple" size={22} color={colors.text_primary} />
              <Text style={styles.socialLab}>Apple</Text>
            </Pressable>
          </View>

          <View style={styles.foot}>
            <Text style={styles.footMuted}>{`Don't have an account? `}</Text>
            <Pressable onPress={() => nav.navigate('Signup')} accessibilityRole="link">
              <Text style={styles.footLink}>Sign up</Text>
            </Pressable>
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg_surface_alt },
  safeTop: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.screenTitle - 8,
    color: colors.text_primary,
    letterSpacing: -0.8,
    textTransform: 'capitalize',
  },
  sub: {
    marginTop: 12,
    color: colors.text_secondary,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 24,
  },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: -6 },
  forgotTxt: { color: colors.primary_green, fontFamily: typography.fontFamily.semibold, fontSize: typography.fontSize.captions },
  divWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border_subtle },
  divTxt: {
    color: colors.text_muted,
    marginHorizontal: 12,
    fontSize: typography.fontSize.captions,
    fontFamily: typography.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.surface_low,
    borderWidth: 1,
    borderColor: colors.border_subtle,
  },
  socialLab: { fontFamily: typography.fontFamily.semibold, color: colors.text_primary, fontSize: 14 },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 28,
    alignItems: 'center',
  },
  footMuted: { color: colors.text_muted, fontSize: typography.fontSize.bodySm },
  footLink: {
    fontFamily: typography.fontFamily.bold,
    color: colors.primary_green,
    fontSize: typography.fontSize.bodySm,
  },
});
