# App Store Connect — App Privacy

Use this checklist when completing **App Privacy** for RepRight (`com.unibe.repright`) in App Store Connect.

## Data linked to the user

| Category | Data types | Purpose | Collected | Linked to identity | Used for tracking |
|----------|------------|---------|-----------|-------------------|-------------------|
| Contact Info | Email address, Name | App functionality, account | Yes | Yes | No |
| Health & Fitness | Fitness | App functionality (workout stats, form scores) | Yes | Yes (when signed in) | No |
| User Content | Other user content (display name, optional profile photo on device) | App functionality | Yes | Yes | No |
| Identifiers | User ID | App functionality | Yes | Yes | No |
| Usage Data | Product interaction (session counts, error types) | Analytics / app functionality | Yes | Yes | No |
| Diagnostics | Crash data, performance (if enabled later) | App functionality | Optional | No* | No |

\* Only declare diagnostics if you add Sentry/Crashlytics. Current build: **no third-party crash SDK** — skip or answer “No” unless added.

## Data NOT collected

- **Photos or videos uploaded to servers** — camera frames stay on-device.
- **Precise location** — not used.
- **HealthKit / Clinical health records** — not integrated.
- **Browsing history, contacts, financial info** — not collected.

## Third-party SDKs to disclose

| Service | Data shared | Purpose |
|---------|-------------|---------|
| Supabase | Email, user ID, workout session summaries, profile prefs | Auth + cloud sync |
| Apple Sign In | Apple-provided name/email (per Apple rules) | Authentication |
| Google Sign-In | Google account email/name | Authentication |

## Privacy Policy URL (required)

Set in App Store Connect → App Information:

```
https://emmoscript.github.io/RepRight/legal/privacy.html
```

Override with `EXPO_PUBLIC_LEGAL_BASE_URL` if you host elsewhere.

## Terms of Use URL (recommended)

```
https://emmoscript.github.io/RepRight/legal/terms.html
```

## Account deletion

Apple requires in-app deletion. RepRight: **Profile → Delete account** (logged-in users only).

## Camera permission (Info.plist)

`NSCameraUsageDescription` explains on-device form analysis — already set in `app.config.ts` / `Info.plist`. Rebuild iOS after changes.

## Hosting legal pages (GitHub Pages)

1. Repo **Settings → Pages**
2. Source: **Deploy from branch** → `main` → folder **`/docs`**
3. URLs become `https://<user>.github.io/RepRight/legal/privacy.html`
4. Update `EXPO_PUBLIC_LEGAL_BASE_URL` in EAS secrets if the username differs from `emmoscript`

## App Store review notes (suggested)

> RepRight uses the device camera for on-device pose estimation (MoveNet). Video is not uploaded. Test account: [provide email/password]. Account deletion: Profile → Delete account.
