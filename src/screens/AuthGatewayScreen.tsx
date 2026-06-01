import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { RepRightHeader } from "@/components/RepRightHeader";
import { UnderlineField } from "@/components/UnderlineField";
import type { RootStackParamList } from "@/navigation/routeTypes";
import { resetToEmailConfirm } from "@/navigation/navigationRef";
import { useAuthStore } from "@/store/authStore";
import { isEmailNotConfirmedError } from "@/utils/authErrors";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AuthGatewayScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.flex}>
      <SafeAreaView edges={[]} style={styles.safeTop}>
        <RepRightHeader
          variant="auth"
          showBack
          rightSlot={
            <MaterialIcons
              name="fitness-center"
              size={22}
              color={colors.primary_green}
            />
          }
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>
          <View style={styles.modeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "login" }}
              onPress={() => setMode("login")}
              style={[styles.modeChip, mode === "login" && styles.modeChipOn]}>
              <Text
                style={[
                  styles.modeChipTxt,
                  mode === "login" && styles.modeChipTxtOn,
                ]}>
                {t('auth.logIn')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === "signup" }}
              onPress={() => setMode("signup")}
              style={[styles.modeChip, mode === "signup" && styles.modeChipOn]}>
              <Text
                style={[
                  styles.modeChipTxt,
                  mode === "signup" && styles.modeChipTxtOn,
                ]}>
                {t('auth.createAccount')}
              </Text>
            </Pressable>
          </View>

          {mode === "login" ? (
            <>
              <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
              <Text style={styles.sub}>
                {t('auth.loginSub')}
              </Text>
              <View style={{ height: 20 }} />
              <UnderlineField
                label={t('auth.email')}
                value={loginEmail}
                onChangeText={setLoginEmail}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={{ marginBottom: 4 }}>
                <UnderlineField
                  label={t('auth.password')}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
              <Pressable style={styles.forgotWrap} accessibilityRole="button">
                <Text style={styles.forgotTxt}>{t('auth.forgotPassword')}</Text>
              </Pressable>
              <PrimaryButton
                title={t('auth.loginBtn')}
                trailing={
                  <MaterialIcons
                    name="arrow-forward"
                    size={22}
                    color={colors.text_on_green}
                  />
                }
                style={{ marginTop: 28 }}
                onPress={async () => {
                  if (loginEmail.trim() && loginPassword.trim()) {
                    try {
                      await signIn(loginEmail.trim(), loginPassword.trim());
                      nav.navigate("MainTabs", { screen: "HomeMain" });
                    } catch (err) {
                      if (isEmailNotConfirmedError(err)) {
                        resetToEmailConfirm(loginEmail.trim());
                        nav.navigate("EmailConfirm", { email: loginEmail.trim() });
                      }
                    }
                  }
                }}
              />
              <View style={styles.divWrap}>
                <View style={styles.divLine} />
                <Text style={styles.divTxt}>{t('auth.orContinue')}</Text>
                <View style={styles.divLine} />
              </View>
              <View style={styles.socialRow}>
                <Pressable style={styles.socialChip} accessibilityRole="button">
                  <Ionicons
                    name="logo-google"
                    size={20}
                    color={colors.text_primary}
                  />
                  <Text style={styles.socialLab}>{t('auth.google')}</Text>
                </Pressable>
                <Pressable style={styles.socialChip} accessibilityRole="button">
                  <Ionicons
                    name="logo-apple"
                    size={22}
                    color={colors.text_primary}
                  />
                  <Text style={styles.socialLab}>{t('auth.apple')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('auth.createTitle')}</Text>
              <Text style={styles.sub}>
                {t('auth.createSub')}
              </Text>
              <View style={{ height: 20 }} />
              <UnderlineField
                label={t('auth.fullName')}
                value={name}
                onChangeText={setName}
                placeholder={t('auth.namePlaceholder')}
                autoCapitalize="words"
              />
              <UnderlineField
                label={t('auth.email')}
                value={signupEmail}
                onChangeText={setSignupEmail}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.pwOuter}>
                <Text style={styles.pwLbl}>{t('auth.password')}</Text>
                <View
                  style={[
                    styles.inputRow,
                    {
                      borderBottomColor: pwFocused
                        ? colors.primary_green
                        : colors.border_subtle,
                    },
                  ]}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('auth.passwordCreatePlaceholder')}
                    placeholderTextColor={colors.text_muted}
                    secureTextEntry={!showPw}
                    onFocus={() => setPwFocused(true)}
                    onBlur={() => setPwFocused(false)}
                    style={styles.pwInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowPw((v) => !v)}>
                    <Ionicons
                      name={showPw ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color={colors.text_secondary}
                    />
                  </Pressable>
                </View>
              </View>
              <PrimaryButton
                title={t('auth.signupBtn')}
                trailing={
                  <MaterialIcons
                    name="arrow-forward"
                    size={22}
                    color={colors.text_on_green}
                  />
                }
                style={{ marginTop: 32 }}
                onPress={async () => {
                  if (signupEmail.trim() && password.trim() && name.trim()) {
                    try {
                      const { needsEmailVerification } = await signUp(
                        signupEmail.trim(),
                        password.trim(),
                        name.trim(),
                      );
                      if (needsEmailVerification) {
                        nav.navigate("EmailConfirm", { email: signupEmail.trim() });
                      } else {
                        nav.navigate("MainTabs", { screen: "HomeMain" });
                      }
                    } catch {
                      // error in store
                    }
                  }
                }}
              />
            </>
          )}

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
  modeRow: {
    flexDirection: "row",
    marginBottom: 22,
    backgroundColor: colors.surface_low,
    borderRadius: 999,
    padding: 4,
  },
  modeChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 999,
  },
  modeChipOn: {
    backgroundColor: colors.primary_green,
  },
  modeChipTxt: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text_muted,
  },
  modeChipTxtOn: {
    color: colors.text_on_green,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: typography.fontSize.screenTitle - 8,
    color: colors.text_primary,
    letterSpacing: -0.8,
    textTransform: "capitalize",
  },
  sub: {
    marginTop: 12,
    color: colors.text_secondary,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 24,
  },
  forgotWrap: { alignSelf: "flex-end", paddingVertical: 8 },
  forgotTxt: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.medium,
  },
  divWrap: { flexDirection: "row", alignItems: "center", marginVertical: 22 },
  divLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border_subtle,
  },
  divTxt: {
    marginHorizontal: 12,
    color: colors.text_muted,
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
  },
  socialRow: { flexDirection: "row", justifyContent: "center" },
  socialChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.surface_v3,
    borderWidth: 1,
    borderColor: colors.border_subtle,
  },
  socialLab: {
    marginLeft: 8,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
    color: colors.text_primary,
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
    overflow: "hidden",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: colors.border_subtle,
    paddingVertical: 4,
  },
  pwInput: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    color: colors.text_primary,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.body,
  },
});
