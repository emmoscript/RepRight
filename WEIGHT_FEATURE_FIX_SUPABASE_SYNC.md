# Fix: Weight Feature - Supabase Sync Not Working

**Issue:** Workouts were not being saved to Supabase backend after "Save Workout" button was clicked.

**Root Cause:** The weight feature was implemented in `useSessionSyncStore`, but `SessionCompleteScreen` was still using the old `saveSession()` function which only saves to local AsyncStorage and does NOT sync to Supabase.

**Architecture Mismatch:**

- Old System: `modules/session.ts` → AsyncStorage only (no Supabase sync)
- New System: `useSessionSyncStore` → AsyncStorage + Supabase sync with weight data
- Problem: Screens were using the old system, not the new one

---

## Fix Applied

**File Modified:** `src/screens/SessionCompleteScreen.tsx`

### Change 1: Import Sync Store

```typescript
import { useSessionSyncStore } from "@/store/sessionSyncStore";
```

### Change 2: Updated `onSave` Function

The function now:

1. Saves to local AsyncStorage (backward compatibility)
2. **NEW:** Creates session in sync store with `startSession()`
3. **NEW:** Completes and syncs session to Supabase with `completeSession()`
4. **NEW:** Passes weight data from `sessionConfigStore.weightAmount`

```typescript
const onSave = async () => {
  if (saved) {
    goHome();
    return;
  }

  // ... existing session log creation ...

  // Save to local AsyncStorage for backward compatibility
  await saveSession(log);

  // NEW: Sync to Supabase with weight data
  try {
    console.log("\n=== SESSION COMPLETE: Syncing to Supabase ===");
    console.log("Exercise:", exercise);
    console.log("Set count:", plannedSetCount);
    console.log("Weight amount:", weightAmount);

    const {
      startSession: syncStartSession,
      completeSession: completeSessionSync,
    } = useSessionSyncStore.getState();

    // Create session in sync store
    const syncStoreSessionId = await syncStartSession(
      exercise,
      weightAmount || null,
    );
    console.log("Sync store session created:", syncStoreSessionId);

    // Complete the session and sync to Supabase
    await completeSessionSync(
      syncStoreSessionId,
      plannedSetCount,
      weightAmount || null,
    );
    console.log("✅ Session synced to Supabase successfully");
  } catch (err) {
    console.error(
      "⚠️ Error syncing to Supabase:",
      err instanceof Error ? err.message : String(err),
    );
    // Don't block the UI if Supabase sync fails - session is still saved locally
  }

  setSaved(true);
  useSessionResultStore.getState().clear();
  goHome();
};
```

---

## How It Works Now

1. **User taps "Save Workout"**
   - `onSave()` is called

2. **Local Storage**
   - Session is saved to AsyncStorage via `saveSession(log)`

3. **Sync Store Creation**
   - Session is created in `useSessionSyncStore` via `startSession()`
   - Returns a sessionId for tracking

4. **Supabase Sync**
   - `completeSession()` is called with:
     - `sessionId` (from sync store)
     - `plannedSetCount` (set count)
     - `weightAmount` (from sessionConfigStore, or null if not provided)

   This triggers:
   - Validation: weight > 0 if provided
   - RPC call to Supabase function: `save_session_with_errors`
   - INSERT into `workout_sessions` with weight data
   - INSERT errors into `biomechanical_errors` table

5. **Response Handling**
   - If sync succeeds: "✅ Session synced to Supabase successfully"
   - If sync fails: "⚠️ Error syncing to Supabase" (but session still saved locally)
   - Either way: UI navigates home with `goHome()`

---

## Data Flow (Complete)

```
SessionCompleteScreen
  ├─ Exercise: "conventional_deadlift"
  ├─ Set Count: 3
  ├─ Weight Amount: 75.5 kg (from sessionConfigStore)
  │
  ├─ saveSession(log) → AsyncStorage
  │   └─ Backward compatibility ✓
  │
  └─ useSessionSyncStore.startSession(exercise, weight)
     └─ Creates: LocalSession { id, exercise, set_count: 1, weight, errors: [], status: "local" }
     │
     └─ useSessionSyncStore.completeSession(sessionId, plannedSetCount, weight)
        ├─ Validation: weight > 0 ✓
        ├─ Status: "local" → "syncing"
        │
        └─ Supabase RPC: save_session_with_errors
           ├─ Parameters:
           │  ├─ p_exercise: "conventional_deadlift"
           │  ├─ p_set_count: 3
           │  ├─ p_started_at: timestamp
           │  ├─ p_weight: 75.5
           │  └─ p_errors: [...]
           │
           └─ Database
              ├─ INSERT workout_sessions (weight: 75.5)
              └─ INSERT biomechanical_errors (per error)

              Status: "synced" ✓
```

---

## Console Output When Saving

When user taps "Save Workout", console will show:

```
=== SESSION COMPLETE: Syncing to Supabase ===
Exercise: conventional_deadlift
Set count: 3
Weight amount: 75.5

=== SYNC STORE: SYNC SESSIONS ===
Auth state: { isLoggedIn: true, user: {...}, userId: "..." }

Sync store session created: [uuid]

Checking Supabase session...
Supabase session check: { hasSession: true, sessionUser: "..." }

--- Syncing session: [uuid]
Session data: { exercise: "conventional_deadlift", set_count: 3, weight: 75.5, errors_count: 0 }

RPC parameters: { exercise: "conventional_deadlift", set_count: 3, weight: 75.5, errors_count: 0 }

Supabase RPC response received
Response data: [uuid]
Response error: null

Session synced successfully

✅ Session synced to Supabase successfully
```

---

## Verification

### In App:

1. Open ConfigureSessionScreen
2. Set weight to 75.5 kg
3. Start LiveSession
4. Complete some reps
5. Tap "Save Workout"
6. Check console for "✅ Session synced to Supabase successfully"

### In Supabase Dashboard:

```sql
SELECT id, exercise, weight, created_at
FROM workout_sessions
ORDER BY created_at DESC
LIMIT 1;
```

Expected: `weight = 75.5`

---

## Status

✅ **FIXED**

- Supabase sync is now integrated into SessionCompleteScreen
- Weight data flows from UI → sync store → Supabase
- Backward compatibility maintained (AsyncStorage still updated)
- Error handling prevents blocking UI if sync fails

---

## Related Files

| File                                    | Change         | Impact                      |
| --------------------------------------- | -------------- | --------------------------- |
| `src/screens/SessionCompleteScreen.tsx` | ✅ Updated     | Now syncs to Supabase       |
| `src/store/sessionSyncStore.ts`         | ✓ Already done | Powers the sync mechanism   |
| `src/lib/supabaseTypes.ts`              | ✓ Already done | Type definitions used       |
| `modules/session.ts`                    | Unchanged      | Still saves to AsyncStorage |
