#!/usr/bin/env bash
# Quick Test Reference - Weight Feature Integration
# Run these tests after deploying the implementation

echo "═══════════════════════════════════════════════════════════════"
echo "  Weight Feature - Quick Test Guide"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ───────────────────────────────────────────────────────────────────
echo "📋 TEST CASE 1: Session WITH Weight"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'
Steps:
  1. Open ConfigureSessionScreen
  2. Set: Sets = 3, Weight = 75.5 kg
  3. Tap "Start" → LiveSessionScreen
  4. Complete some reps
  5. Tap "Finish" → SessionCompleteScreen
  
Expected Results:
  ✅ Summary shows: "75.5 kg"
  ✅ Console shows: "Weight: 75.5"
  ✅ RPC parameters include: p_weight: 75.5
  ✅ Console shows: "Session synced successfully"
  
Verify in Supabase:
  SELECT weight FROM workout_sessions 
  ORDER BY created_at DESC LIMIT 1;
  
  Expected: weight = 75.5
EOF
echo ""

# ───────────────────────────────────────────────────────────────────
echo "📋 TEST CASE 2: Session WITHOUT Weight"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'
Steps:
  1. Open ConfigureSessionScreen
  2. Set: Sets = 3, Weight = (leave empty)
  3. Tap "Start" → LiveSessionScreen
  4. Complete some reps
  5. Tap "Finish" → SessionCompleteScreen

Expected Results:
  ✅ Summary shows: (no weight display)
  ✅ Console shows: "Weight: null"
  ✅ RPC parameters include: p_weight: null
  ✅ Console shows: "Session synced successfully"

Verify in Supabase:
  SELECT weight FROM workout_sessions 
  ORDER BY created_at DESC LIMIT 1;
  
  Expected: weight = NULL
EOF
echo ""

# ───────────────────────────────────────────────────────────────────
echo "📋 TEST CASE 3: Invalid Weight (Zero)"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'
Steps:
  1. Manually edit ConfigureSessionScreen weight to 0
  2. Complete session
  3. Try to save

Expected Results:
  ❌ Local validation: "❌ Invalid weight: must be greater than 0"
  ❌ No RPC call made (prevented client-side)
  ❌ Session NOT synced

Console Check:
  grep "Invalid weight: must be greater than 0"
EOF
echo ""

# ───────────────────────────────────────────────────────────────────
echo "📋 TEST CASE 4: Invalid Weight (Negative)"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'
Steps:
  1. Manually edit ConfigureSessionScreen weight to -10
  2. Complete session
  3. Try to save

Expected Results:
  ❌ Local validation: "❌ Invalid weight: must be greater than 0"
  ❌ No RPC call made
  ❌ Session NOT synced

Console Check:
  grep "Invalid weight: must be greater than 0"
EOF
echo ""

# ───────────────────────────────────────────────────────────────────
echo "📋 TEST CASE 5: Invalid Weight (NaN)"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'
Steps:
  1. If somehow NaN reaches validation
  2. Complete session
  3. Try to save

Expected Results:
  ❌ Local validation: "❌ Invalid weight: must be a valid number"
  ❌ No RPC call made
  ❌ Session NOT synced

Console Check:
  grep "Invalid weight: must be a valid number"
EOF
echo ""

# ───────────────────────────────────────────────────────────────────
echo "🔍 SUPABASE VERIFICATION QUERIES"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'

1. Check column exists:
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'workout_sessions'
     AND column_name = 'weight';
   
   Expected: weight | FLOAT | true


2. Check recent sessions with weights:
   SELECT id, exercise, weight, set_count, created_at
   FROM public.workout_sessions
   ORDER BY created_at DESC
   LIMIT 10;
   
   Expected: Mix of weight values and NULLs


3. Check sessions with weight > 50:
   SELECT id, exercise, weight
   FROM public.workout_sessions
   WHERE weight > 50
   ORDER BY created_at DESC;
   
   Expected: Only sessions with high weights


4. Verify index exists:
   SELECT indexname FROM pg_indexes
   WHERE schemaname = 'public'
   AND tablename = 'workout_sessions'
   AND indexname = 'idx_workout_sessions_weight';
   
   Expected: idx_workout_sessions_weight

EOF
echo ""

# ───────────────────────────────────────────────────────────────────
echo "📊 CONSOLE LOG CHECKLIST"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'

When session completes, check console for these logs (in order):

[ ] "=== SYNC STORE: COMPLETE SESSION ==="
[ ] "Session ID: [uuid]"
[ ] "Set count: [number]"
[ ] "Weight: [number or null]"
[ ] "Session found, updating: ..."
[ ] "Session updated to local status"
[ ] "Online status: true, initiating sync"
[ ] "Checking Supabase session..."
[ ] "Sessions to sync: 1"
[ ] "--- Syncing session: [uuid]"
[ ] "Session data: { exercise: ..., weight: ... }"
[ ] "Calling Supabase RPC: save_session_with_errors"
[ ] "RPC parameters: { weight: ... }"
[ ] "Supabase RPC response received"
[ ] "Response data: [uuid]" (session ID returned)
[ ] "Session synced successfully"

EOF
echo ""

# ───────────────────────────────────────────────────────────────────
echo "❌ ERROR SCENARIOS (Should NOT occur)"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'

1. CHECK constraint violation:
   Error: "new row for relation "workout_sessions" violates check constraint"
   → Should be prevented by local validation
   → If seen: Weight validation bypassed

2. Authentication error:
   Error: "Not authenticated"
   → User session expired
   → Check auth store state

3. Invalid weight at Supabase:
   Error: "CHECK constraint ... weight > 0"
   → Local validation failed
   → Check validation logic

EOF
echo ""

# ───────────────────────────────────────────────────────────────────
echo "✅ SUCCESS INDICATORS"
echo "───────────────────────────────────────────────────────────────"
cat << 'EOF'

✅ All tests passed when:
  1. Sessions WITH weight sync successfully
  2. Sessions WITHOUT weight sync with NULL
  3. Invalid weights rejected client-side
  4. Supabase contains weight data
  5. No CHECK constraint errors in Supabase
  6. Index created and performing well

✅ Implementation complete when:
  1. Zero breaking changes
  2. All existing sessions still work
  3. New sessions have weight data
  4. Stats screen can filter by weight (future feature)

EOF
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  End of Test Guide"
echo "═══════════════════════════════════════════════════════════════"
