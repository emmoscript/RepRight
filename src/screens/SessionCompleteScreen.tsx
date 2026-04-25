import { useNavigation } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { calculateRepScore } from '@/modules/scoring';
import { saveSession, type SessionLog } from '@/modules/session';
import { useSessionResultStore } from '@/store/sessionResultStore';
import { useAuthStore } from '@/store/authStore';
import { useSessionConfigStore } from '@/store/sessionConfigStore';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export function SessionCompleteScreen() {
  const nav = useNavigation();
  const { errors, startedAt } = useSessionResultStore();
  const { participantId } = useAuthStore();
  const { setCount: numSets } = useSessionConfigStore();
  const [saved, setSaved] = useState(false);

  const { score, label } = useMemo(() => calculateRepScore(errors), [errors]);

  const onSave = async () => {
    if (saved) {
      nav.navigate('Home' as never);
      return;
    }
    const sessionId = randomUUID();
    const log: SessionLog = {
      sessionId,
      participantId,
      date: new Date().toISOString(),
      sets: [
        {
          setNumber: 1,
          reps: [
            {
              repNumber: 1,
              startTimestamp: startedAt,
              endTimestamp: Date.now(),
              score,
              errors: Array.from(
                new Map(
                  errors.map((e) => [e.errorId, { errorId: e.errorId, frameCount: 1, totalFrames: 1 }]),
                ).values(),
              ),
            },
          ],
        },
      ],
      summary: {
        totalReps: 1,
        avgScore: score,
        mostFrequentError: errors[0]?.errorId ?? null,
      },
    };
    await saveSession(log);
    setSaved(true);
    useSessionResultStore.getState().clear();
    nav.navigate('Home' as never);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.h1}>Session complete</Text>
      <View style={styles.ring}>
        <Text style={[styles.score, { color: colors.score_excellent }]}>{Math.round(score)}</Text>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.muted}>
          {errors.length} issue frame(s) logged · {numSets} set(s) planned
        </Text>
      </View>
      <View style={styles.spacer} />
      <PrimaryButton title={saved ? 'Back to home' : 'Save & home'} onPress={onSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg_v3, padding: 24, paddingTop: 40 },
  h1: { color: colors.text_primary, fontSize: 24, fontFamily: typography.fontFamily.bold, marginBottom: 24 },
  ring: { alignItems: 'center', padding: 32, borderRadius: 16, backgroundColor: colors.bg_surface },
  score: { fontSize: 56, fontFamily: typography.fontFamily.bold },
  label: { color: colors.text_primary, fontSize: 18, marginTop: 8, fontFamily: typography.fontFamily.semibold },
  muted: { color: colors.text_muted, fontSize: 14, marginTop: 8, textAlign: 'center' },
  spacer: { flex: 1 },
});
