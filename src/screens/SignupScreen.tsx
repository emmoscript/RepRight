import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export function SignupScreen() {
  const nav = useNavigation();
  const { signUp, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const handleSignup = async () => {
    console.log("\n=== SIGNUP BUTTON PRESSED ===");
    console.log("Email:", email);
    console.log("Email trimmed length:", email.trim().length);
    console.log("Password length:", password.length);
    console.log("Confirm Password length:", confirmPassword.length);
    console.log("Passwords match:", password === confirmPassword);

    if (!email.trim()) {
      console.error("ERROR: Email is empty");
      return;
    }

    if (password !== confirmPassword) {
      console.log("ERROR: Passwords do not match");
      setPasswordMismatch(true);
      return;
    }

    if (password.length < 6) {
      console.error("ERROR: Password is less than 6 characters");
      return;
    }

    setPasswordMismatch(false);

    try {
      console.log("Calling signUp from auth store...");
      console.log("Current isLoading state:", isLoading);
      console.log("Current error state:", error);

      await signUp(email, password);

      console.log("Sign up successful, navigating to MainTabs");
      nav.navigate("MainTabs" as never);
    } catch (err) {
      console.error("Exception caught in handleSignup:", err);
      console.error(
        "Error type:",
        err instanceof Error ? err.constructor.name : typeof err,
      );
      console.error(
        "Error message:",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Create Account</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@university.edu"
        placeholderTextColor={colors.text_muted}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
        style={styles.input}
      />

      <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor={colors.text_muted}
        secureTextEntry
        editable={!isLoading}
        style={styles.input}
      />

      <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
        placeholderTextColor={colors.text_muted}
        secureTextEntry
        editable={!isLoading}
        style={styles.input}
      />

      {passwordMismatch && (
        <Text style={styles.errorText}>Passwords do not match</Text>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <PrimaryButton
        title={isLoading ? "Creating account..." : "Sign up"}
        onPress={handleSignup}
        disabled={isLoading || !email.trim() || password !== confirmPassword}
        style={{ marginTop: 24 }}
      />

      <Text style={styles.loginPrompt}>
        Already have an account?{" "}
        <Text onPress={() => nav.goBack()} style={styles.loginLink}>
          Log in
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg_v3,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: typography.fontFamily.bold,
    color: colors.text_primary,
    marginBottom: 32,
  },
  label: {
    color: colors.text_secondary,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border_medium,
    borderRadius: 10,
    padding: 14,
    color: colors.text_primary,
    fontSize: 16,
  },
  errorText: { color: colors.accent_red, fontSize: 13, marginTop: 8 },
  loginPrompt: {
    marginTop: 24,
    textAlign: "center",
    color: colors.text_secondary,
    fontSize: 14,
  },
  loginLink: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.semibold,
  },
});
