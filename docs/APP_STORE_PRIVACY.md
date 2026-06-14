# App Store Connect — App Privacy

Use this checklist when completing **App Privacy** for RepRight (`com.unibe.repright`) in App Store Connect.

## Privacy Nutrition Labels — quick answers (current build)

Declare **Yes, we collect data** and link it to the user when signed in.

| Apple category | Data type | Collected? | Linked to user? | Used for tracking? | Purpose in App Store Connect |
|----------------|-----------|------------|-----------------|-------------------|------------------------------|
| **Contact Info** | Email Address | Yes | Yes | No | App Functionality, Account Management |
| **Contact Info** | Name | Yes (display name) | Yes | No | App Functionality |
| **Health & Fitness** | Fitness | Yes | Yes (when signed in) | No | App Functionality |
| **User Content** | Other User Content | Yes | Yes | No | App Functionality (workout summaries, form error types, display name) |
| **Identifiers** | User ID | Yes | Yes | No | App Functionality |
| **Usage Data** | Product Interaction | Yes | Yes | No | App Functionality (sessions, sets, scores) |
| **Diagnostics** | Crash Data / Performance | **No** (unless you add Sentry/Crashlytics) | — | No | — |

### Do NOT declare (current build)

- **Photos or Video** — camera frames are processed on-device only; nothing uploaded.
- **Precise Location** — not used.
- **HealthKit / Medical records** — not integrated.
- **Browsing history, contacts, financial info, advertising data** — not collected.

## What Supabase actually stores

When a user is **signed in**, Supabase receives:

- Email, user ID, auth provider
- Profile prefs: display name, language, weight unit, audio setting
- Workout session summaries: exercise, sets, reps, weights, form scores, timestamps, biomechanical error types (text/metadata — **not** camera frames)

When a user is in **guest mode**, cloud sync is minimal; anonymous guest IDs may be logged for participation counts only.

Supabase auth logs may include **IP address** and device/browser metadata as part of normal hosting — declare under service operation if App Store asks; it is not workout content.

## Third-party SDKs to disclose

| Service | Data shared | Purpose |
|---------|-------------|---------|
| Supabase | Email, user ID, workout session summaries, profile prefs | Auth + cloud sync |
| Apple Sign In | Apple-provided name/email (per Apple rules) | Authentication |
| Google Sign-In | Google account email/name | Authentication |

## Privacy Policy URL (required)

```
https://emmoscript.github.io/RepRight/legal/privacy.html
```

Override with `EXPO_PUBLIC_LEGAL_BASE_URL` if hosted elsewhere (e.g. custom landing page).

## Terms of Use URL (recommended)

```
https://emmoscript.github.io/RepRight/legal/terms.html
```

## Account deletion

Apple requires in-app deletion. RepRight: **Profile → Danger zone → Delete account** (logged-in users only).

## Camera permission (Info.plist)

`NSCameraUsageDescription` explains on-device form analysis — no upload. Rebuild iOS after changes.

## App Store review notes (suggested)

> RepRight uses the device camera for on-device pose estimation (MoveNet). No camera frames or video are uploaded to our servers. Academic research uses aggregated or de-identified data only. Test account: [email/password]. Account deletion: Profile → Danger zone → Delete account.

## Research disclosure tip

If App Store Connect asks about **research** or **health research**: explain that workout metrics may be analyzed in aggregate for UNIBE academic research; no identifiable camera video is collected; users can delete accounts in-app.
