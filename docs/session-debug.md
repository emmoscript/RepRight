# Live session debugging (pose / reps / model)

Structured dev logs (`RR|…`) for debugging detection while you run a **wireless** session — **no USB required** (phone can sit on a tripod for camera framing).

## Quick start (Wi‑Fi only)

**Terminal A — Metro bundle (same as today):**

```bash
npm run start:lan
```

**Terminal B — trace receiver on your PC:**

```bash
npm run log:session
```

You should see:

```text
[session-log-server] Phone sends to http://10.0.0.93:8787/log
```

**Phone:** same Wi‑Fi as PC, dev client pointed at `http://<PC-IP>:8081`, then Workout → Live session.

Traces appear in Terminal B and in **`logs/session-live.log`** (gitignored). Cursor can read that file while you lift.

### Firewall

Allow inbound **TCP 8787** on the PC (same idea as **8081** for Metro). Windows: Defender Firewall → allow Node for private networks, or add port 8787.

## What gets logged

| Prefix | Meaning |
|--------|---------|
| `flow` | search → detected → countdown → active ↔ pose_lost |
| `rep` | setup/lockout phases, rep **COUNT** |
| `pose` | ~1 Hz hip Y, validity, keypoint scores |
| `infer` | model FPS, orientation, raw tensor sample |
| `analyzer` | ERR_001… when detected |
| `model` | TFLite ready / mock fallback |

## How it works

1. App logs `RR|…` via `console.log` (Metro still shows them).
2. App also **POSTs** each line to `http://<Metro-host>:8787/log` — derived from the bundle URL (`scriptURL`), so it always targets the same PC IP you use for `:8081`.
3. `session-log-server` on the PC prints + saves lines for the agent.

## USB fallback (optional)

If the phone is plugged in and you prefer adb:

```bash
npm run log:session:adb
```

## Agent workflow (Cursor)

1. You run `npm run log:session` + `npm run start:lan`.
2. You reproduce on device (wireless) and say what’s wrong.
3. Agent reads `logs/session-live.log` or the log-server terminal.
4. Agent patches rep logic / analyzer / LiveSession from evidence.

## Rep count check

After a set, compare your manual count to the log:

```bash
npm run eval:session -- --expected 5
```

See [`effectiveness-evaluation.md`](effectiveness-evaluation.md).

## Manual filter (Metro only)

If you skip the log server, Metro still prints `RR|` lines in the terminal running `start:lan` — but the dedicated server + file is easier for the agent to read reliably.
