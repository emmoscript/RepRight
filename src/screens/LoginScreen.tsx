import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export function LoginScreen() {
  const nav = useNavigation();
  const { signIn, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    console.log("\n=== LOGIN BUTTON PRESSED ===");
    console.log("Email:", email);
    console.log("Email trimmed length:", email.trim().length);
    console.log("Password length:", password.length);

    if (!email.trim() || !password.trim()) {
      console.error("ERROR: Email or password is empty");
      return;
    }

    try {
      console.log("Calling signIn from auth store...");
      console.log("Current isLoading state:", isLoading);
      console.log("Current error state:", error);

      await signIn(email, password);

      console.log("Sign in successful, navigating to MainTabs");
      nav.navigate("MainTabs" as never);
    } catch (err) {
      console.error("Exception caught in handleLogin:", err);
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
      <Text style={styles.title}>Log in</Text>

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

      {error && <Text style={styles.errorText}>{error}</Text>}

      <PrimaryButton
        title={isLoading ? "Logging in..." : "Log in"}
        onPress={handleLogin}
        disabled={isLoading || !email.trim() || !password.trim()}
        style={{ marginTop: 24 }}
      />

      <Text style={styles.signupPrompt}>
        Don't have an account?{" "}
        <Text
          onPress={() => nav.navigate("Signup" as never)}
          style={styles.signupLink}>
          Sign up
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
  signupPrompt: {
    marginTop: 24,
    textAlign: "center",
    color: colors.text_secondary,
    fontSize: 14,
  },
  signupLink: {
    color: colors.primary_green,
    fontFamily: typography.fontFamily.semibold,
  },
});
