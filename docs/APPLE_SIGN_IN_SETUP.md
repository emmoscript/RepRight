# Sign in with Apple — setup checklist

RepRight uses **native** Sign in with Apple on iOS (`expo-apple-authentication` → Supabase `signInWithIdToken`). Google OAuth stays as browser flow.

**Bundle ID:** `com.unibe.repright`

---

## 1. Apple Developer — App ID

1. [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Identifiers**
2. Open **com.unibe.repright** (or create it)
3. Enable capability: **Sign In with Apple** → **Save**

No Services ID required for native-only iOS sign-in with Supabase.

---

## 2. Supabase — Apple provider

1. Supabase Dashboard → **Authentication** → **Providers** → **Apple**
2. **Enable** Apple
3. **Client IDs:** add exactly:
   ```
   com.unibe.repright
   ```
4. **Secret Key:** leave empty if you only use native iOS sign-in (Supabase docs allow this when Client IDs includes the app bundle ID)
5. Save

If sign-in fails with “invalid client”, generate an Apple **Services ID + Key** (optional advanced) — see [Supabase Apple docs](https://supabase.com/docs/guides/auth/social-login/auth-apple).

---

## 3. Rebuild iOS binary

Sign in with Apple is a **native capability**. After pulling this code:

```bash
# Local Mac
npm run ios:rebuild

# TestFlight (EAS)
npm run eas:production:ios
```

Dev Client builds must be rebuilt too — Apple auth does not work in an old Dev Client without the entitlement.

---

## 4. Test on device

1. Physical iPhone (iOS 13+), signed into iCloud
2. Auth screen → **Continue with Apple** (official Apple button, right column)
3. First sign-in: Apple may share name/email once
4. Confirm user appears in Supabase → **Authentication** → **Users** with provider `apple`

---

## 5. App Store requirement

Because RepRight offers **Google** sign-in on iOS, **Sign in with Apple must remain available** (implemented). Do not remove the Apple button on iOS.

On **Android**, only Google is shown (Apple button hidden — not required there).

---

## Troubleshooting

| Error | Fix |
|--------|-----|
| `Apple Sign In is not available` | Simulator without Apple ID, or missing entitlement — rebuild app |
| Supabase `invalid request` / JWT | Add `com.unibe.repright` to Supabase Apple Client IDs |
| Button does nothing | Rebuild native app after adding `expo-apple-authentication` |
| No display name | Apple only sends name on **first** authorization; set in Profile manually |
