import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RepRightHeader } from '@/components/RepRightHeader';
import { UnderlineField } from '@/components/UnderlineField';
import type { RootStackParamList } from '@/navigation/routeTypes';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SignupScreen() {
  const nav = useNavigation<Nav>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <SafeAreaView edges={[]} style={styles.safeTop}>
        <RepRightHeader
          variant="auth"
          showBack
          rightSlot={<MaterialIcons name="fitness-center" size={22} color={colors.primary_green} />}
        />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.sub}>Join the thesis study cohort and unlock form tracking.</Text>

          <View style={{ height: 20 }} />

          <UnderlineField
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />
          <UnderlineField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@university.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.pwOuter}>
            <Text style={styles.pwLbl}>Password</Text>
            <View
              style={[
                styles.inputRow,
                { borderBottomColor: pwFocused ? colors.primary_green : colors.border_subtle },
              ]}
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create password"
                placeholderTextColor={colors.text_muted}
                secureTextEntry={!showPw}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                style={styles.pwInput}
              />
              <Pressable accessibilityRole="button" onPress={() => setShowPw((v) => !v)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.text_secondary} />
              </Pressable>
            </View>
          </View>

          <PrimaryButton
            title="Sign Up →"
            style={{ marginTop: 32 }}
            onPress={() => nav.navigate('EmailConfirm')}
          />

          <View style={styles.foot}>
            <Text style={styles.footMuted}>Already have an account? </Text>
            <Pressable onPress={() => nav.navigate('Login')} accessibilityRole="link">
              <Text style={styles.footLink}>Log in</Text>
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
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.screenTitle - 4,
    color: colors.text_primary,
    letterSpacing: -0.9,
    textTransform: 'capitalize',
  },
  sub: {
    marginTop: 12,
    color: colors.text_secondary,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 24,
  },
  pwLbl: {
    color: colors.text_secondary,
    fontSize: typography.fontSize.captions,
    fontFamily: typography.fontFamily.medium,
    marginBottom: 8,
  },
  pwOuter: {
    marginBottom: 20,
    backgroundColor: colors.surface_low,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.border_subtle,
    gap: 8,
    paddingVertical: 4,
  },
  pwInput: {
    flex: 1,
    paddingVertical: 10,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
  },
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
