import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getAllSessions, type SessionLog } from '@/modules/session';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export function StatsScreen() {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [refresh, setR] = useState(false);
  const load = useCallback(async () => {
    setR(true);
    const data = await getAllSessions();
    setSessions(data.sort((a, b) => b.date.localeCompare(a.date)));
    setR(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <FlatList
      data={sessions}
      keyExtractor={(it) => it.sessionId}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={load} tintColor={colors.primary_green} />}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <Text style={styles.empty}>No sessions yet — complete a live session to see history.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title}>{item.date.slice(0, 10)}</Text>
          <Text style={styles.muted}>
            {item.sets[0]?.reps.length ?? 0} rep(s) · Avg {item.summary.avgScore.toFixed(0)}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.bg_surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border_subtle,
  },
  title: { color: colors.text_primary, fontFamily: typography.fontFamily.semibold, fontSize: 16 },
  muted: { color: colors.text_muted, fontSize: 14, marginTop: 4 },
  empty: { color: colors.text_muted, textAlign: 'center', marginTop: 40, fontSize: 15 },
});
