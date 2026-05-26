import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useSessionConfigStore } from "@/store/sessionConfigStore";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export function ConfigureSessionScreen() {
  const nav = useNavigation();
  const numSets = useSessionConfigStore((s) => s.setCount);
  const currentWeight = useSessionConfigStore((s) => s.weight);
  const patch = useSessionConfigStore((s) => s.patch);
  const [sets, setSets] = useState(String(numSets));
  const [weight, setWeight] = useState(
    currentWeight ? String(currentWeight) : "",
  );

  return (
    <View style={styles.root}>
      <Text style={styles.label}>Conventional deadlift</Text>

      <Text style={styles.muted}>Number of sets (study template)</Text>
      <TextInput
        value={sets}
        onChangeText={setSets}
        keyboardType="number-pad"
        style={styles.input}
      />

      <Text style={[styles.muted, { marginTop: 24 }]}>Weight (kg)</Text>
      <TextInput
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder="e.g., 70.5"
        placeholderTextColor={colors.text_muted}
        style={styles.input}
      />

      <PrimaryButton
        title="Start live session"
        onPress={() => {
          const n = Math.max(1, Math.min(10, parseInt(sets, 10) || 3));
          const w = weight.trim() ? parseFloat(weight) : null;
          patch({ setCount: n, weight: w });
          nav.navigate("LiveSession" as never);
        }}
        style={{ marginTop: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3, padding: 24 },
  label: {
    color: colors.text_primary,
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 4,
  },
  muted: { color: colors.text_muted, fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border_medium,
    borderRadius: 10,
    padding: 14,
    color: colors.text_primary,
    fontSize: 18,
  },
});
