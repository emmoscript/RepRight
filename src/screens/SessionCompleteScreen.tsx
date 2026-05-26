import { useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { calculateRepScore } from "@/modules/scoring";
import { saveSession, type SessionLog } from "@/modules/session";
import { useAuthStore } from "@/store/authStore";
import { useSessionConfigStore } from "@/store/sessionConfigStore";
import { useSessionResultStore } from "@/store/sessionResultStore";
import { useSessionSyncStore } from "@/store/sessionSyncStore";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

export function SessionCompleteScreen() {
  const nav = useNavigation();
  const { errors, startedAt, workoutSetSnapshots } = useSessionResultStore();
  const {
    setCount: numSets,
    weight,
    reset: resetConfig,
  } = useSessionConfigStore();
  const completeSession = useSessionSyncStore((s) => s.completeSession);
  const { participantId } = useAuthStore();
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { score, label } = useMemo(() => calculateRepScore(errors), [errors]);

  const onSave = async () => {
    if (saved) {
      resetConfig();
      nav.navigate("MainTabs" as never);
      return;
    }

    setIsSaving(true);
    try {
      console.log("\n=== SAVING SESSION ===");
      console.log("Score:", Math.round(score));
      console.log("Errors count:", errors.length);
      console.log("Sets:", numSets);
      console.log("Weight:", weight);
      console.log("Started at:", startedAt);

      // Get the current session ID from sync store
      const state = useSessionSyncStore.getState();
      const sessions = Array.from(state.sessions.values());
      console.log("Total sessions in store:", sessions.length);

      const currentSession = sessions[sessions.length - 1];

      if (currentSession) {
        console.log("Current session:", {
          id: currentSession.id,
          exercise: currentSession.exercise,
          errors_logged: currentSession.errors.length,
        });

        console.log("Calling completeSession with:", {
          sessionId: currentSession.id,
          setCount: numSets,
          weight: weight,
        });

        // Build SessionLog for local storage
        const sessionLog: SessionLog = {
          sessionId: currentSession.id,
          participantId: participantId,
          date: new Date(startedAt).toISOString(),
          sets: workoutSetSnapshots.map((snapshot) => ({
            setNumber: snapshot.setNumber,
            reps: [
              {
                repNumber: 1,
                startTimestamp: startedAt,
                endTimestamp: startedAt + snapshot.elapsedSec * 1000,
                score: snapshot.scoreRounded,
                errors: errors
                  .filter(
                    (e) =>
                      e.severity === "critical" || e.severity === "warning",
                  )
                  .map((e) => ({
                    errorId: e.errorId,
                    frameCount: 1,
                    totalFrames: 1,
                  })),
              },
            ],
          })),
          summary: {
            totalReps: workoutSetSnapshots.reduce((sum, s) => sum + s.reps, 0),
            avgScore: Math.round(score),
            mostFrequentError: errors.length > 0 ? errors[0].errorId : null,
          },
        };

        // Save to local AsyncStorage
        console.log("Saving session to local storage...");
        await saveSession(sessionLog);
        console.log("Session saved to local storage");

        // Sync with Supabase
        console.log("Syncing session with Supabase...");
        await completeSession(currentSession.id, numSets, weight);
        console.log("Session completed and sync initiated");
      } else {
        console.error("ERROR: No session found in store");
      }

      setSaved(true);
      useSessionResultStore.getState().clear();
      resetConfig();

      setTimeout(() => {
        nav.navigate("MainTabs" as never);
      }, 500);
    } catch (error) {
      console.error("\n=== SESSION SAVE ERROR ===");
      console.error(
        "Error message:",
        error instanceof Error ? error.message : String(error),
      );
      console.error(
        "Error type:",
        error instanceof Error ? error.constructor.name : typeof error,
      );
      console.error("Full error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Session complete</Text>
      <View style={styles.ring}>
        <Text style={[styles.score, { color: colors.score_excellent }]}>
          {Math.round(score)}
        </Text>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.muted}>
          {errors.length} issue frame(s) logged · {numSets} set(s) planned
          {weight ? ` · ${weight} kg` : ""}
        </Text>
      </View>
      <View style={styles.spacer} />
      <PrimaryButton
        title={isSaving ? "Saving..." : saved ? "Back to home" : "Save & home"}
        onPress={onSave}
        disabled={isSaving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3, padding: 24, paddingTop: 40 },
  h1: {
    color: colors.text_primary,
    fontSize: 24,
    fontFamily: typography.fontFamily.bold,
    marginBottom: 24,
  },
  ring: {
    alignItems: "center",
    padding: 32,
    borderRadius: 16,
    backgroundColor: colors.bg_surface,
  },
  score: { fontSize: 56, fontFamily: typography.fontFamily.bold },
  label: {
    color: colors.text_primary,
    fontSize: 18,
    marginTop: 8,
    fontFamily: typography.fontFamily.semibold,
  },
  muted: {
    color: colors.text_muted,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  spacer: { flex: 1 },
});
