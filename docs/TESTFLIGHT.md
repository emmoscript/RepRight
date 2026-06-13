# RepRight — TestFlight (iOS)

First internal beta via **EAS Build** (cloud). You develop on Windows; the iOS binary is built on Expo’s Mac workers.

**Bundle ID:** `com.unibe.repright`  
**Version:** `1.0.0` (marketing) · **Build:** increment each upload (`CFBundleVersion`)

---

## Prerequisites

1. **Apple Developer Program** (paid) — you have this.
2. **Expo account** — project already linked (`extra.eas.projectId` in `app.config.ts`).
3. **EAS CLI** on your PC:
   ```bash
   npm install -g eas-cli
   eas login
   ```
4. **App Store Connect**
   - [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → New App
   - Platform: iOS · Name: **RepRight** · Bundle ID: **com.unibe.repright**
   - SKU: e.g. `repright-ios` · User access: Full Access

---

## One-time: Apple credentials in EAS

On first iOS production build, EAS will ask to manage credentials (recommended):

```bash
eas credentials
```

Choose **iOS** → **production**. Let EAS create:

- Distribution certificate  
- Provisioning profile (App Store)

Or sign in with Apple ID when prompted during `eas build`.

---

## Build for TestFlight

From repo root:

```bash
npm run eas:production:ios
```

Equivalent:

```bash
eas build --profile production --platform ios
```

- Profile `production` → **App Store** distribution (TestFlight + App Store).
- `autoIncrement: true` in `eas.json` bumps the iOS build number each build.

Wait for the build on [expo.dev](https://expo.dev) (~15–25 min). Download `.ipa` optional; submit can be done from EAS directly.

---

## Upload to TestFlight

### Option A — EAS Submit (recommended)

After a successful build:

```bash
eas submit --platform ios --profile production --latest
```

EAS will prompt for:

- Apple ID (developer account email)  
- App-specific password ([appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords)  
- ASC app (select **RepRight**)

### Option B — Transporter (Mac)

Download the `.ipa` from Expo → open **Transporter** on a Mac → deliver to App Store Connect.

---

## App Store Connect → TestFlight

1. **App Store Connect** → your app → **TestFlight**.
2. Wait for **Processing** (5–30 min).
3. If asked, complete **Export Compliance**:
   - RepRight uses HTTPS only for auth/Supabase — typically **No** for custom encryption beyond Apple’s stack.
   - No end-to-end encryption of user video (on-device ML only).
4. **Internal testing** — up to 100 team members (same App Store Connect team). Add testers under **Users and Access** first.
5. **External testing** — requires **Beta App Review** (short); add group + testers by email.

---

## Before you ship — checklist

- [ ] `npm run tsc` passes  
- [ ] `.env` / Supabase URL + anon key set in EAS **Secrets** if needed (`eas secret:create`)  
- [ ] Google OAuth redirect URLs include production bundle / scheme if used on iOS  
- [ ] Camera + Photo Library usage strings in `Info.plist` (already set)  
- [ ] **Sign in with Apple** enabled on App ID + Supabase — see [`docs/APPLE_SIGN_IN_SETUP.md`](APPLE_SIGN_IN_SETUP.md)  
- [ ] Test on a **physical iPhone**  
- [ ] Privacy manifest: `ios/RepRight/PrivacyInfo.xcprivacy` present  

---

## EAS environment variables (if using Supabase)

If the app reads `EXPO_PUBLIC_*` at build time:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://....supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
```

Rebuild after adding secrets.

---

## Common issues

| Issue | Fix |
|--------|-----|
| Bundle ID mismatch | ASC app must use `com.unibe.repright` exactly |
| Missing compliance | Answer encryption questionnaire in TestFlight tab |
| Build fails on Vision Camera / TFLite | Use `production` profile; native `ios/` folder is committed — EAS runs `pod install` |
| Dev client vs TestFlight | TestFlight needs **production** build, not `development` / Dev Client |

---

## Commands quick reference

```bash
npm run tsc
npm run eas:production:ios
eas submit --platform ios --profile production --latest
eas build:list
```

---

## After TestFlight

- Collect feedback → iterate → bump **build** for each new upload; bump **version** (e.g. `1.0.1`) for App Store releases.
- Form Guide tutorial → post-v1 update (not required for first TestFlight).
