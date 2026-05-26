import { useNavigation } from "@react-navigation/native";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuthStore } from "@/store/authStore";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export function ProfileScreen() {
  const nav = useNavigation();
  const { user, isLoading, signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    nav.navigate("Demo" as never);
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || "N/A"}</Text>

        <Text style={[styles.label, { marginTop: 16 }]}>Auth Provider</Text>
        <Text style={styles.value}>{user?.auth_provider || "N/A"}</Text>

        <Text style={[styles.label, { marginTop: 16 }]}>Status</Text>
        <Text style={styles.value}>Signed in</Text>
      </View>

      <View style={styles.spacer} />

      <PrimaryButton
        title={isLoading ? "Logging out..." : "Log out"}
        variant="ghost"
        onPress={handleLogout}
        disabled={isLoading}
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
  label: {
    color: colors.text_muted,
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
  },
  value: {
    color: colors.text_primary,
    fontSize: 16,
    marginTop: 4,
    fontFamily: typography.fontFamily.semibold,
  },
  spacer: { flex: 1 },
});
