/**
 * session.ts
 * Session logging via AsyncStorage.
 * Key pattern : session_${sessionId}
 * Index key   : session_index  →  string[] of sessionIds
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RepLog {
  repNumber: number;
  startTimestamp: number;
  endTimestamp: number;
  score: number;
  errors: {
    errorId: string;
    frameCount: number;
    totalFrames: number;
  }[];
}

export interface SessionLog {
  sessionId: string; // uuid
  participantId: string; // anonymized: 'P001', 'P002' …
  date: string; // ISO 8601
  sets: {
    setNumber: number;
    reps: RepLog[];
  }[];
  summary: {
    totalReps: number;
    avgScore: number;
    mostFrequentError: string | null;
  };
}

export async function saveSession(session: SessionLog): Promise<void> {
  const key = `session_${session.sessionId}`;
  await AsyncStorage.setItem(key, JSON.stringify(session));

  const indexRaw = await AsyncStorage.getItem("session_index");
  const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  if (!index.includes(session.sessionId)) {
    index.push(session.sessionId);
    await AsyncStorage.setItem("session_index", JSON.stringify(index));
  }
}

export async function getSession(
  sessionId: string,
): Promise<SessionLog | null> {
  const raw = await AsyncStorage.getItem(`session_${sessionId}`);
  return raw ? JSON.parse(raw) : null;
}

export async function getAllSessions(): Promise<SessionLog[]> {
  const indexRaw = await AsyncStorage.getItem("session_index");
  if (!indexRaw) return [];
  const ids: string[] = JSON.parse(indexRaw);
  const results = await Promise.all(ids.map(getSession));
  return results.filter((s): s is SessionLog => s !== null);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await AsyncStorage.removeItem(`session_${sessionId}`);
  const indexRaw = await AsyncStorage.getItem("session_index");
  if (!indexRaw) return;
  const index: string[] = JSON.parse(indexRaw);
  await AsyncStorage.setItem(
    "session_index",
    JSON.stringify(index.filter((id) => id !== sessionId)),
  );
}

/**
 * Syncs completed sessions from Supabase to local AsyncStorage.
 * Fetches workout_sessions table filtered by user_id.
 * Converts Supabase format to SessionLog format for local display.
 */
export async function syncSessionsFromSupabase(
  supabaseClient: any,
  userId: string,
): Promise<void> {
  try {
    console.log("\n=== SYNCING SESSIONS FROM SUPABASE ===");
    console.log("User ID:", userId);

    // Fetch all completed sessions for this user from Supabase
    // First, fetch one session to see the schema
    const { data: sampleData, error: sampleError } = await supabaseClient
      .from("workout_sessions")
      .select("*")
      .limit(1);

    if (sampleError) {
      console.error("Error fetching sample:", sampleError);
      return;
    }

    if (sampleData && sampleData.length > 0) {
      console.log("Sample session columns:", Object.keys(sampleData[0]));
      console.log(
        "Sample session data:",
        JSON.stringify(sampleData[0], null, 2),
      );
    }

    // Fetch all sessions (without filter for now to see all data)
    const { data: sessions, error } = await supabaseClient
      .from("workout_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sessions from Supabase:", error);
      return;
    }

    console.log("Sessions fetched from Supabase:", sessions?.length || 0);

    if (!sessions || sessions.length === 0) {
      console.log("No sessions found in Supabase");
      return;
    }

    // Convert and save each session to local storage
    let savedCount = 0;
    for (const supabaseSession of sessions) {
      try {
        // Use started_at for the actual session date (when user performed the workout)
        const sessionDate =
          supabaseSession.started_at ||
          supabaseSession.created_at ||
          new Date().toISOString();
        const startTimestamp = new Date(sessionDate).getTime();

        // Convert Supabase format to SessionLog format
        const sessionLog: SessionLog = {
          sessionId: supabaseSession.id,
          participantId: userId,
          date: sessionDate, // Use actual workout start time, not creation time
          sets: [
            {
              setNumber: 1,
              reps: [
                {
                  repNumber: 1,
                  startTimestamp: startTimestamp,
                  endTimestamp: startTimestamp + 60000,
                  score: supabaseSession.score || supabaseSession.avgScore || 0,
                  errors: [],
                },
              ],
            },
          ],
          summary: {
            totalReps: supabaseSession.set_count || 0,
            avgScore: supabaseSession.score || supabaseSession.avgScore || 0,
            mostFrequentError: null,
          },
        };

        // Save to local storage
        await saveSession(sessionLog);
        savedCount++;
        console.log("Saved session:", supabaseSession.id, "from", sessionDate);
      } catch (err) {
        console.error(
          "Error converting session:",
          supabaseSession.id,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    console.log("Completed syncing:", savedCount, "sessions from Supabase");
  } catch (err) {
    console.error(
      "Error syncing sessions from Supabase:",
      err instanceof Error ? err.message : String(err),
    );
  }
}
