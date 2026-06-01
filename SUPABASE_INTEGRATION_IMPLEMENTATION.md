# Weight Feature - Supabase Integration Implementation

**Status:** ✅ Complete  
**Date:** June 1, 2026  
**Phase:** Local sync + Supabase backend integration

---

## 📋 Changes Implemented

### 1. **Type Definitions** (`src/lib/supabaseTypes.ts`)

✅ Created new file with:

- `WorkoutSession` - Database row type
- `BiomechanicalError` - Error tracking type
- `BiomechanicalErrorInput` - RPC input type
- `SaveSessionWithErrorsParams` - RPC parameter type
- `SaveSessionResponse` - RPC return type

**Location:** `src/lib/supabaseTypes.ts`

### 2. **Session Sync Store** (`src/store/sessionSyncStore.ts`)

✅ Updated with:

**Imports:**

```typescript
import type {
  BiomechanicalErrorInput,
  SaveSessionWithErrorsParams,
  SaveSessionResponse,
} from "@/lib/supabaseTypes";
```

**Weight Validation (in completeSession):**

- Rejects `weight <= 0` with error message
- Validates `Number.isFinite(weight)`
- Passes `null` as valid (optional weight)

**RPC Call Enhancement:**

```typescript
const rpcParams: SaveSessionWithErrorsParams = {
  p_exercise: session.exercise,
  p_set_count: session.set_count,
  p_started_at: new Date(session.started_at).toISOString(),
  p_weight: session.weight ?? null,
  p_errors: session.errors,
};

const { data, error } = await supabase.rpc<SaveSessionResponse>(
  "save_session_with_errors",
  rpcParams,
);
```

**Error Handling:**

- Detects CHECK constraint violations (weight > 0)
- Detects authentication failures
- Detects user ID mismatches
- Provides detailed error classification

---

## 🔄 Data Flow

```
ConfigureSessionScreen
  │ weight: 75.5 (user input)
  ├→ sessionConfigStore.weightAmount
  │
LiveSessionScreen
  ├→ startSession(exercise, weight)
  ├→ sessionSyncStore.sessions[id].weight = 75.5
  │
SessionCompleteScreen
  ├→ completeSession(sessionId, setCount, weight)
  ├→ Validation: weight > 0 ✓
  ├→ Status: "local"
  │
sessionSyncStore.syncSessions()
  ├→ Prepare RPC parameters
  ├→ Type-safe call with SaveSessionWithErrorsParams
  │
Supabase RPC (save_session_with_errors)
  ├→ INSERT workout_sessions (weight: 75.5)
  ├→ INSERT biomechanical_errors (per error)
  │
Database (workout_sessions table)
  └→ weight FLOAT CHECK (weight > 0) ✓
```

---

## ✔️ Validation Rules

| Scenario        | Input  | Validation               | Result              |
| --------------- | ------ | ------------------------ | ------------------- |
| With weight     | `75.5` | `75.5 > 0 && isFinite()` | ✅ Stored           |
| Without weight  | `null` | Allowed                  | ✅ NULL stored      |
| Zero weight     | `0`    | `0 > 0` fails            | ❌ Rejected locally |
| Negative weight | `-10`  | `< 0` fails              | ❌ Rejected locally |
| Non-numeric     | `NaN`  | `!isFinite()`            | ❌ Rejected locally |
| String weight   | `"75"` | TypeError                | ❌ Type error       |

---

## 🧪 Testing Scenarios

### Scenario 1: Complete with weight

```typescript
// ConfigureSessionScreen: user enters "75.5"
weight: 75.5

// LiveSessionScreen
startSession("conventional_deadlift", 75.5)
// → LocalSession { weight: 75.5 }

// SessionCompleteScreen
completeSession(sessionId, 3, 75.5)
// → Validation: 75.5 > 0 ✓
// → RPC call with p_weight: 75.5

// Supabase
INSERT workout_sessions (weight: 75.5)
// ✅ Success
```

### Scenario 2: Complete without weight

```typescript
// ConfigureSessionScreen: field empty
weight: null

// LiveSessionScreen
startSession("conventional_deadlift", null)
// → LocalSession { weight: null }

// SessionCompleteScreen
completeSession(sessionId, 3, null)
// → Validation: null is allowed ✓
// → RPC call with p_weight: null

// Supabase
INSERT workout_sessions (weight: null)
// ✅ Success
```

### Scenario 3: Invalid weight (rejected locally)

```typescript
// ConfigureSessionScreen: user tries negative
weight: -10;

// SessionCompleteScreen
completeSession(sessionId, 3, -10);
// → Validation: -10 > 0 ✗
// → Console: "❌ Invalid weight: must be greater than 0"
// → return null (no RPC call)

// ✅ Prevented before reaching Supabase
```

### Scenario 4: Invalid weight (Supabase constraint)

```typescript
// If somehow -10 reaches RPC (shouldn't happen)
const { data, error } = await supabase.rpc(..., { p_weight: -10 })
// → error.message includes "CHECK constraint"
// → Console: "❌ Weight validation failed (Supabase): must be > 0"
// → Session marked as "failed" for retry

// ✅ Caught by both validation layers
```

---

## 📊 Supabase Schema (Applied)

### Table: `workout_sessions`

```sql
-- Column added:
weight FLOAT CHECK (weight > 0)

-- Updated RPC function:
CREATE OR REPLACE FUNCTION save_session_with_errors(
  p_exercise    TEXT,
  p_set_count   INT,
  p_started_at  TIMESTAMPTZ,
  p_weight      FLOAT,         -- NEW
  p_errors      JSONB
) RETURNS UUID
```

### Index (for performance)

```sql
CREATE INDEX idx_workout_sessions_weight
  ON public.workout_sessions (weight)
  WHERE weight IS NOT NULL;
```

---

## 🔍 Verification Checklist

- [x] Type file created: `src/lib/supabaseTypes.ts`
- [x] sessionSyncStore imports types correctly
- [x] Weight validation added in `completeSession()`
- [x] RPC parameters type-safe with `SaveSessionWithErrorsParams`
- [x] Error handling distinguishes between validation types
- [x] RPC function accepts `p_weight` (Supabase-side ✅)
- [x] Database column created with CHECK constraint (Supabase-side ✅)
- [x] Index created for weight queries (Supabase-side ✅)

---

## 🚀 Next Steps

1. **Test locally:**
   - Configure session with weight: `75.5 kg`
   - Start live session
   - Complete session
   - Verify weight appears in summary

2. **Test sync:**
   - Check app console: "Session synced successfully"
   - Query Supabase: `SELECT weight FROM workout_sessions ORDER BY created_at DESC LIMIT 1`
   - Verify: `weight = 75.5`

3. **Test validation:**
   - Try weight: `-10` → Should reject locally
   - Try weight: `0` → Should reject locally
   - Try weight: `null` → Should sync with NULL

4. **Monitor production:**
   - All sessions now include weight data
   - Sessions with `weight: null` are valid
   - Stats screen can now filter/aggregate by weight

---

## 📝 Notes

- **Zero breaking changes:** Backward compatible with existing sessions
- **Type safety:** Full TypeScript support throughout data flow
- **Dual validation:** Client-side + server-side (Supabase constraint)
- **Error classification:** Distinguishes weight errors from auth/user errors
- **Performance:** Index on weight for future stats queries

---

## 🔗 Related Files

| File                                     | Purpose          | Status                   |
| ---------------------------------------- | ---------------- | ------------------------ |
| `src/lib/supabaseTypes.ts`               | Type definitions | ✅ Created               |
| `src/store/sessionSyncStore.ts`          | Local sync + RPC | ✅ Updated               |
| `src/store/sessionConfigStore.ts`        | Config state     | ✅ Has weight            |
| `src/screens/ConfigureSessionScreen.tsx` | Weight input UI  | ✅ Has input             |
| `src/screens/LiveSessionScreen.tsx`      | Session start    | ✅ Passes weight         |
| `src/screens/SessionCompleteScreen.tsx`  | Session end      | ✅ Completes with weight |

---

## 💡 Usage Example

```typescript
import type { BiomechanicalErrorInput } from "@/store/sessionSyncStore";
import { useSessionSyncStore } from "@/store/sessionSyncStore";
import { useSessionConfigStore } from "@/store/sessionConfigStore";

export function MyComponent() {
  const weight = useSessionConfigStore((s) => s.weightAmount);
  const completeSession = useSessionSyncStore((s) => s.completeSession);

  const handleSave = async () => {
    // Weight is automatically validated in completeSession
    await completeSession(sessionId, numSets, weight);
    // If weight is invalid, function returns null (no error thrown)
    // If weight is valid, session syncs to Supabase
  };
}
```
