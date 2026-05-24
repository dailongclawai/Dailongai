# Portal iOS App — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of Đại Long Portal iOS app — Auth + Dealer flow — to TestFlight internal testers in ~2 weeks. 14 screens, native Sign in with Apple + Face ID + Push notifications, full i18n parity with web (vi/en).

**Architecture:** Expo SDK 54 + React Native 0.81 + TypeScript + Expo Router. Repo `~/Downloads/dai-long-portal-ios/` (separate from `dai-long-landing/`). Backend reuse Supabase project `lxrvvbmqrvrndkuycjje` 100%; only adds `device_tokens` table + `apple_user_id` column + `send-push` edge function. Tab bar bottom (4 tabs: Tổng quan, Đơn, Hoa hồng, Tài khoản); modal sheets for orders/new, dealer-qr, payout-info, inbox.

**Tech Stack:** Expo Router, NativeWind 4, TanStack Query 5, `@supabase/supabase-js`, `expo-apple-authentication`, `expo-local-authentication`, `expo-notifications`, `expo-secure-store`, `sonner-native`, `react-native-sfsymbols`. EAS Build + Submit. Supabase Postgres + Edge Functions (Deno).

**Reference:** Spec at `docs/superpowers/specs/2026-05-24-portal-ios-app-design.md`. Web portal source: `~/Downloads/dai-long-landing/src/app/portal/*` + `src/components/portal/*`. EAS lessons: memory `feedback_eas_ios_pitfalls.md`.

---

## Task 0: Prerequisites (Boss action required)

**Files:** none (manual external setup)

- [ ] **Step 1: Boss confirms Apple Developer account active**

Verify at https://developer.apple.com/account. Existing membership from Sen Messenger should cover this. If lapsed: renew ($99/year).

- [ ] **Step 2: Boss confirms availability for ONE interactive 2FA moment**

First EAS build will require interactive Apple ID + 2FA for cert generation (per memory `feedback_eas_ios_pitfalls.md`). Boss must be available at Task 12 start (~end of week 1). All subsequent builds non-interactive.

- [ ] **Step 3: Engineer registers bundle ID `ai.dailong.portal`**

At https://developer.apple.com/account/resources/identifiers/list → `+` → App IDs → App → Bundle ID `ai.dailong.portal`, Description "Đại Long Portal", capabilities: **Sign in with Apple**, **Push Notifications**.

- [ ] **Step 4: Engineer creates App Store Connect entry**

At https://appstoreconnect.apple.com/apps → `+` → New App. Bundle ID `ai.dailong.portal`, Name "Đại Long Portal", Primary Language Vietnamese, SKU `dailong-portal-ios-001`. Capture the 10-digit Apple App ID from URL for `eas.json` later.

---

## Task 1: Scaffold Expo repo + base config

**Files:**
- Create: `~/Downloads/dai-long-portal-ios/` (new directory + git repo)
- Create: `package.json`, `app.json`, `eas.json`, `.npmrc`, `tsconfig.json`, `.gitignore`, `.env.example`

- [ ] **Step 1: Scaffold Expo project**

```bash
cd ~/Downloads && npx create-expo-app@latest dai-long-portal-ios --template default
cd dai-long-portal-ios
git init && git add -A && git commit -m "chore: scaffold Expo app from template"
```

- [ ] **Step 2: Add `.npmrc` to fix EAS Cloud npm ci errors**

Create `.npmrc`:
```
legacy-peer-deps=true
```

Reason: EAS uses `npm ci --include=dev` (strict peer deps); Expo SDK 54 + React 19 has known peer dep mismatches. Per memory `feedback_eas_ios_pitfalls.md` item #1.

- [ ] **Step 3: Install runtime dependencies**

```bash
npx expo install \
  expo-router expo-linking expo-constants expo-secure-store \
  expo-apple-authentication expo-local-authentication expo-notifications \
  expo-haptics expo-image expo-blur \
  @supabase/supabase-js \
  @tanstack/react-query \
  nativewind tailwindcss@^3.4 \
  react-native-mmkv \
  sonner-native \
  react-native-svg \
  react-native-safe-area-context react-native-screens
```

- [ ] **Step 4: Configure `app.json`**

Replace `app.json` with:
```json
{
  "expo": {
    "name": "Đại Long Portal",
    "slug": "dai-long-portal",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "dailong",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "ios": {
      "bundleIdentifier": "ai.dailong.portal",
      "buildNumber": "1",
      "supportsTablet": false,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "NSFaceIDUsageDescription": "Đại Long Portal dùng Face ID để mở app nhanh và an toàn.",
        "NSCameraUsageDescription": "Đại Long Portal cần quyền camera để chụp ảnh sản phẩm (tính năng tương lai)."
      },
      "associatedDomains": ["applinks:dailongai.com"]
    },
    "plugins": [
      "expo-router",
      "expo-apple-authentication",
      "expo-local-authentication",
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#ff5625"
      }]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": { "origin": false },
      "eas": { "projectId": "WILL_BE_FILLED_BY_EAS_INIT" }
    }
  }
}
```

- [ ] **Step 5: Configure `eas.json`**

Create `eas.json`:
```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "resourceClass": "m-medium" }
    },
    "production": {
      "autoIncrement": true,
      "ios": { "resourceClass": "m-medium" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "REPLACE_WITH_APPLE_APP_ID_FROM_TASK_0_STEP_4",
        "appleTeamId": "REPLACE_WITH_APPLE_TEAM_ID"
      }
    }
  }
}
```

- [ ] **Step 6: Create `.env.example` and `.env.local`**

`.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=https://lxrvvbmqrvrndkuycjje.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=replace_me
```

`.env.local` (gitignored): copy `.env.example` and fill real anon key from `~/Downloads/dai-long-landing/.env.local`.

Update `.gitignore` to include `.env.local`, `.env*.local`, `ios/`, `android/`.

- [ ] **Step 7: Initialize EAS project**

```bash
npx eas-cli login    # Boss credentials (one-time)
npx eas-cli init     # populates extra.eas.projectId in app.json
```

Commit:
```bash
git add -A && git commit -m "chore: configure Expo + EAS + native modules"
```

---

## Task 2: Backend — migration + send-push edge function

**Files:**
- Create: `~/Downloads/dai-long-landing/supabase/migrations/20260601000000_ios_app_support.sql`
- Create: `~/Downloads/dai-long-landing/supabase/functions/send-push/index.ts`
- Create: `~/Downloads/dai-long-landing/supabase/functions/send-push/deno.json`

- [ ] **Step 1: Write migration**

`supabase/migrations/20260601000000_ios_app_support.sql`:
```sql
-- Apple Sign In identity mapping
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS apple_user_id text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_apple_user_id ON profiles(apple_user_id) WHERE apple_user_id IS NOT NULL;

-- Device tokens
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  device_name text,
  app_version text,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS device_tokens_own ON device_tokens;
CREATE POLICY device_tokens_own ON device_tokens
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger to enqueue push
CREATE OR REPLACE FUNCTION notify_portal_message_push()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('portal_message_push', json_build_object(
    'message_id', NEW.id,
    'recipient_user_id', NEW.recipient_user_id,
    'title', COALESCE(NEW.title, 'Đại Long Portal'),
    'body', COALESCE(NEW.body, ''),
    'type', NEW.type,
    'data', NEW.data
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_portal_messages_push ON portal_messages;
CREATE TRIGGER trg_portal_messages_push
AFTER INSERT ON portal_messages
FOR EACH ROW EXECUTE FUNCTION notify_portal_message_push();
```

- [ ] **Step 2: Apply migration to Supabase**

Use Supabase MCP tool `apply_migration` with the SQL above. Verify in Supabase Studio: `device_tokens` table exists, `profiles.apple_user_id` column exists, trigger `trg_portal_messages_push` exists.

- [ ] **Step 3: Write edge function `send-push`**

`supabase/functions/send-push/index.ts`:
```ts
import { Expo, ExpoPushMessage } from "npm:expo-server-sdk@3.10.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const expo = new Expo();
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Payload {
  message_id: string;
  recipient_user_id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
}

async function deliver(payload: Payload) {
  const { data: tokens, error } = await sb
    .from("device_tokens")
    .select("expo_token")
    .eq("user_id", payload.recipient_user_id)
    .eq("platform", "ios")
    .gte("last_active_at", new Date(Date.now() - 60 * 86400 * 1000).toISOString());
  if (error) { console.error("token lookup", error); return; }
  if (!tokens || tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.expo_token))
    .map((t) => ({
      to: t.expo_token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: { type: payload.type, message_id: payload.message_id, ...(payload.data ?? {}) },
    }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // Mark inactive tokens
      for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (t.status === "error" && t.details?.error === "DeviceNotRegistered") {
          await sb.from("device_tokens")
            .update({ last_active_at: new Date(0).toISOString() })
            .eq("expo_token", chunk[i].to as string);
        }
      }
    } catch (e) {
      console.error("send chunk fail", e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const payload = await req.json() as Payload;
  await deliver(payload);
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
```

`supabase/functions/send-push/deno.json`:
```json
{ "imports": {} }
```

- [ ] **Step 4: Deploy edge function**

Use Supabase MCP tool `deploy_edge_function` with the function name `send-push` and the file content above.

- [ ] **Step 5: Wire pg_notify → edge function via Database Webhook**

In Supabase Studio → Database → Webhooks → `+` Create webhook:
- Name: `portal_message_to_push`
- Table: `portal_messages`
- Events: Insert
- Type: Supabase Edge Functions
- Edge function: `send-push`
- HTTP headers: `Authorization: Bearer <service_role_key>`

This calls `send-push` for every INSERT on `portal_messages`, passing the row as `payload.record`. Update edge function to read `req.json().record` instead of using pg_notify channel (simpler). Edit `send-push/index.ts`:
```ts
const body = await req.json();
const row = body.record;
const payload: Payload = {
  message_id: row.id,
  recipient_user_id: row.recipient_user_id,
  title: row.title ?? "Đại Long Portal",
  body: row.body ?? "",
  type: row.type,
  data: row.data,
};
await deliver(payload);
```

Re-deploy. Remove the `pg_notify` block from migration (no longer needed) — apply a follow-up migration `20260601000001_drop_pg_notify_push.sql`:
```sql
DROP TRIGGER IF EXISTS trg_portal_messages_push ON portal_messages;
DROP FUNCTION IF EXISTS notify_portal_message_push();
```

- [ ] **Step 6: Smoke test edge function**

In Supabase SQL editor (as service role):
```sql
INSERT INTO portal_messages (recipient_user_id, type, title, body)
VALUES ('<a real user UUID>', 'test', 'Test push', 'Hello from edge function');
```

In Edge Function logs (Supabase Studio → Edge Functions → send-push → Logs), expect: invocation log, no errors, `tokens lookup` returns 0 rows (no devices registered yet — expected). Function does not crash.

- [ ] **Step 7: Commit (in `dai-long-landing` repo)**

```bash
cd ~/Downloads/dai-long-landing
git add supabase/migrations/20260601000000_ios_app_support.sql \
       supabase/migrations/20260601000001_drop_pg_notify_push.sql \
       supabase/functions/send-push/
git commit -m "feat(supabase): add device_tokens + send-push edge function for iOS app"
```

---

## Task 3: Foundation lib — Supabase client + auth context

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/auth.tsx`

- [ ] **Step 1: Write `lib/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) throw new Error('Missing EXPO_PUBLIC_SUPABASE_* env vars');

export const supabase = createClient(url, anon, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

Install missing dep:
```bash
npm install react-native-url-polyfill
```

- [ ] **Step 2: Write `lib/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: 'dealer' | 'supervisor' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  account_no: number | null;
  apple_user_id: string | null;
}

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, phone, role, status, account_no, apple_user_id')
      .eq('id', userId)
      .single();
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return <Ctx.Provider value={{ session, profile, loading, signOut, refreshProfile }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts lib/auth.tsx
git commit -m "feat(auth): Supabase client + AuthProvider context"
```

---

## Task 4: Foundation lib — i18n + biometric + apple-signin + notifications

**Files:**
- Create: `translations/vi.ts` (copy from web)
- Create: `translations/en.ts` (copy from web)
- Create: `lib/i18n.tsx`
- Create: `lib/apple-signin.ts`
- Create: `lib/biometric.ts`
- Create: `lib/notifications.ts`

- [ ] **Step 1: Copy translations from web**

```bash
cp ~/Downloads/dai-long-landing/src/lib/translations/vi.ts ./translations/vi.ts
cp ~/Downloads/dai-long-landing/src/lib/translations/en.ts ./translations/en.ts
```

Open `translations/vi.ts` — change top of file from any imports to standalone export. The web file already exports `const vi = { ... } as const; export default vi;` — no import changes needed.

Add iOS-specific keys at the bottom of both files (before `};`):

vi.ts:
```ts
    'ios.auth.face_id_prompt': 'Bật Face ID cho lần sau?',
    'ios.auth.face_id_enable': 'Bật Face ID',
    'ios.auth.face_id_skip': 'Để sau',
    'ios.auth.face_id_unlock_reason': 'Mở khoá Đại Long Portal',
    'ios.notification.permission_prompt': 'Bật thông báo để biết khi đơn được duyệt',
    'ios.notification.permission_allow': 'Bật thông báo',
    'ios.notification.permission_skip': 'Để sau',
```

en.ts:
```ts
    'ios.auth.face_id_prompt': 'Enable Face ID for next time?',
    'ios.auth.face_id_enable': 'Enable Face ID',
    'ios.auth.face_id_skip': 'Maybe later',
    'ios.auth.face_id_unlock_reason': 'Unlock Đại Long Portal',
    'ios.notification.permission_prompt': 'Turn on notifications to know when orders are approved',
    'ios.notification.permission_allow': 'Enable notifications',
    'ios.notification.permission_skip': 'Maybe later',
```

- [ ] **Step 2: Write `lib/i18n.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import vi from '../translations/vi';
import en from '../translations/en';

export type Locale = 'vi' | 'en';
const dicts: Record<Locale, Record<string, string>> = { vi, en };
const validLocales: Locale[] = ['vi', 'en'];
const STORE_KEY = 'dl-locale';

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}
const Context = createContext<Ctx | null>(null);

function detect(): Locale {
  const device = Localization.getLocales()[0]?.languageCode?.toLowerCase();
  if (device === 'vi') return 'vi';
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('vi');

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((saved) => {
      if (saved && (validLocales as string[]).includes(saved)) setLocaleState(saved as Locale);
      else setLocaleState(detect());
    });
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    SecureStore.setItemAsync(STORE_KEY, l);
  };

  const t = (key: string) => dicts[locale][key] ?? key;

  return <Context.Provider value={{ locale, setLocale, t }}>{children}</Context.Provider>;
}

export function useI18n() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
```

Install missing dep:
```bash
npx expo install expo-localization
```

- [ ] **Step 3: Write `lib/apple-signin.ts`**

```ts
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

export async function signInWithApple(): Promise<{ ok: boolean; error?: string }> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) return { ok: false, error: 'No identity token from Apple' };

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) return { ok: false, error: error.message };

    // Persist apple_user_id + displayName on first sign-in
    if (data.user && credential.user) {
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : null;
      await supabase
        .from('profiles')
        .update({
          apple_user_id: credential.user,
          ...(fullName ? { full_name: fullName } : {}),
        })
        .eq('id', data.user.id)
        .is('apple_user_id', null);
    }
    return { ok: true };
  } catch (e: any) {
    if (e.code === 'ERR_REQUEST_CANCELED') return { ok: false, error: 'cancelled' };
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}
```

- [ ] **Step 4: Write `lib/biometric.ts`**

```ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const ENABLED_KEY = 'biometric_enabled';

export async function hasBiometricHardware(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function setBiometricEnabled(enabled: boolean) {
  if (enabled) await SecureStore.setItemAsync(ENABLED_KEY, '1');
  else await SecureStore.deleteItemAsync(ENABLED_KEY);
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === '1';
}

export async function biometricGate(reason: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Huỷ',
    fallbackLabel: 'Dùng mật khẩu thiết bị',
    disableDeviceFallback: false,
  });
  return result.success;
}
```

- [ ] **Step 5: Write `lib/notifications.ts`**

```ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushAsync(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const { status: requested } = await Notifications.requestPermissionsAsync();
    status = requested;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) { console.warn('Missing EAS projectId'); return null; }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  await supabase.from('device_tokens').upsert({
    user_id: userId,
    expo_token: token,
    platform: 'ios',
    device_name: Device.modelName ?? null,
    app_version: Constants.expoConfig?.version ?? null,
    last_active_at: new Date().toISOString(),
  }, { onConflict: 'expo_token' });
  return token;
}

export async function deregisterPushAsync(token: string) {
  await supabase.from('device_tokens').delete().eq('expo_token', token);
}
```

Install missing dep:
```bash
npx expo install expo-device
```

- [ ] **Step 6: Commit**

```bash
git add translations/ lib/i18n.tsx lib/apple-signin.ts lib/biometric.ts lib/notifications.ts package.json package-lock.json
git commit -m "feat: i18n + Apple Sign In + Face ID + push notification libs"
```

---

## Task 5: Design system — Material 3 (light, teal) NativeWind + UI primitives

**UPDATED 2026-05-25**: Boss replaced "Hybrid C dark" with M3 light teal palette per attached mockup. Now uses Inter font, Material Symbols icons, light surface with teal primary + red secondary FAB accent.

**Files:**
- Create: `tailwind.config.js`, `metro.config.js`, `babel.config.js`, `global.css`, `nativewind-env.d.ts`
- Create: `components/ui/Button.tsx`, `Card.tsx`, `Input.tsx`, `Sheet.tsx`, `Skeleton.tsx`, `Fab.tsx`, `MIcon.tsx`, `StatusChip.tsx`, `MemberBadge.tsx`, `GlassCard.tsx`, `FilterChipRow.tsx`
- Create: `components/portal/HeroProgressCard.tsx`, `TierLadder.tsx`, `StatScrollRow.tsx`, `MetallicTierCard.tsx`

- [ ] **Step 1: Setup NativeWind 4 + Inter font + Material Icons**

Follow https://www.nativewind.dev/docs/getting-started/installation (Expo Router section).

Install fonts + icons:
```bash
npx expo install @expo-google-fonts/inter expo-font expo-splash-screen
npm install react-native-vector-icons
npx expo install react-native-svg
```

`tailwind.config.js` (full M3 light teal palette):
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary teal
        primary: '#005c55',
        'primary-container': '#0f766e',
        'primary-fixed': '#9cf2e8',
        'primary-fixed-dim': '#80d5cb',
        'on-primary': '#ffffff',
        'on-primary-container': '#a3faef',
        'on-primary-fixed': '#00201d',
        'on-primary-fixed-variant': '#00504a',
        'inverse-primary': '#80d5cb',
        // Secondary red (CTA)
        secondary: '#bb0112',
        'secondary-container': '#e02928',
        'secondary-fixed': '#ffdad6',
        'secondary-fixed-dim': '#ffb4ab',
        'on-secondary': '#ffffff',
        'on-secondary-container': '#fffbff',
        'on-secondary-fixed': '#410002',
        'on-secondary-fixed-variant': '#93000b',
        // Tertiary amber
        tertiary: '#7d4200',
        'tertiary-container': '#a15600',
        'tertiary-fixed': '#ffdcc3',
        'tertiary-fixed-dim': '#ffb77d',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#ffe6d5',
        'on-tertiary-fixed': '#2f1500',
        'on-tertiary-fixed-variant': '#6e3900',
        // Surface scale
        background: '#faf8ff',
        surface: '#faf8ff',
        'surface-bright': '#faf8ff',
        'surface-dim': '#d2d9f4',
        'surface-variant': '#dae2fd',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#eaedff',
        'surface-container-high': '#e2e7ff',
        'surface-container-highest': '#dae2fd',
        'on-background': '#131b2e',
        'on-surface': '#131b2e',
        'on-surface-variant': '#3e4947',
        'inverse-surface': '#283044',
        'inverse-on-surface': '#eef0ff',
        // Border + status
        outline: '#6e7977',
        'outline-variant': '#bdc9c6',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error': '#ffffff',
        'on-error-container': '#93000a',
      },
      fontFamily: {
        sans: ['Inter_400Regular', '-apple-system', 'system-ui'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
      },
      fontSize: {
        'label-sm':   ['11px', { lineHeight: '14px', fontWeight: '600' }],
        'label-md':   ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        'body-md':    ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-lg':    ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'title-lg':   ['18px', { lineHeight: '26px', fontWeight: '500' }],
        'headline-sm':['20px', { lineHeight: '28px', fontWeight: '600' }],
        'headline-md':['24px', { lineHeight: '32px', fontWeight: '600' }],
        'headline-lg':['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        display:      ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      spacing: {
        'stack-sm': '8px',
        'stack-md': '16px',
        'stack-lg': '24px',
        gutter: '24px',
        'margin-mobile': '16px',
      },
      borderRadius: {
        DEFAULT: '4px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
```

`global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Hide scrollbars for horizontal scroll rows (StatScrollRow, FilterChipRow) */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

`babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
```

`metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: './global.css' });
```

`nativewind-env.d.ts`:
```ts
/// <reference types="nativewind/types" />
```

Load Inter fonts in root layout (modify `app/_layout.tsx` Task 6): add `useFonts` hook with `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold` from `@expo-google-fonts/inter`; show splash until fonts loaded.

- [ ] **Step 2: Write MIcon (Material Symbols wrapper)**

`components/ui/MIcon.tsx`:
```tsx
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { ViewStyle } from 'react-native';

interface Props {
  name: string;     // e.g. 'home', 'receipt_long', 'notifications', 'workspace_premium'
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function MIcon({ name, size = 24, color = '#3e4947', style }: Props) {
  return <MaterialIcons name={name} size={size} color={color} style={style} />;
}
```

Note: `react-native-vector-icons` ships Material Icons (legacy) set covering ~95% of Material Symbols names. For names missing (e.g. `workspace_premium`, `military_tech`), use `MaterialCommunityIcons` from same package as fallback. Document any swaps in component file headers.

- [ ] **Step 3: Write Button component (M3 primary + secondary + outlined)**

`components/ui/Button.tsx`:
```tsx
import { Pressable, Text, ActivityIndicator, View, type PressableProps } from 'react-native';
import { MIcon } from './MIcon';

interface Props extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary-outlined' | 'tonal' | 'text';
  icon?: string;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({ label, variant = 'primary', icon, loading, disabled, fullWidth, ...rest }: Props) {
  const base = `h-12 rounded-xl px-stack-lg flex-row items-center justify-center gap-2 active:scale-[0.98] ${fullWidth ? 'w-full' : ''}`;
  const variantClass = {
    primary: 'bg-primary',
    'secondary-outlined': 'border-2 border-secondary bg-transparent',
    tonal: 'bg-surface-container-low',
    text: 'bg-transparent',
  }[variant];
  const textClass = {
    primary: 'text-on-primary',
    'secondary-outlined': 'text-secondary',
    tonal: 'text-primary',
    text: 'text-primary',
  }[variant];
  const iconColor = {
    primary: '#ffffff',
    'secondary-outlined': '#bb0112',
    tonal: '#005c55',
    text: '#005c55',
  }[variant];
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${variantClass} ${(disabled || loading) ? 'opacity-50' : ''}`}
    >
      {loading
        ? <ActivityIndicator size="small" color={iconColor} />
        : icon && <MIcon name={icon} size={18} color={iconColor} />}
      <Text className={`${textClass} font-sans-bold text-label-md`} style={{ fontFamily: 'Inter_700Bold' }}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Write Card + GlassCard**

`components/ui/Card.tsx`:
```tsx
import { View, type ViewProps } from 'react-native';

export function Card({ className = '', ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`bg-surface rounded-2xl p-stack-lg border border-outline-variant ${className}`}
      style={[{ shadowColor: '#131b2e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 2 }, (rest.style as object) ?? {}]}
    />
  );
}
```

`components/ui/GlassCard.tsx`:
```tsx
import { BlurView } from 'expo-blur';
import { View, type ViewProps } from 'react-native';

export function GlassCard({ children, className = '' }: ViewProps & { className?: string }) {
  return (
    <View className={`rounded-2xl overflow-hidden border border-white/30 ${className}`}>
      <BlurView intensity={40} tint="light" style={{ padding: 16 }}>
        {children}
      </BlurView>
    </View>
  );
}
```

- [ ] **Step 5: Write Input with leading icon**

`components/ui/Input.tsx`:
```tsx
import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { useState } from 'react';
import { MIcon } from './MIcon';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  leadingIcon?: string;
}

export function Input({ label, error, leadingIcon, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const borderClass = error ? 'border-error' : focused ? 'border-primary' : 'border-outline-variant';
  return (
    <View className="gap-stack-sm">
      {label && <Text className="text-on-surface-variant font-sans-medium text-label-md" style={{ fontFamily: 'Inter_500Medium' }}>{label}</Text>}
      <View className="relative">
        {leadingIcon && (
          <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <MIcon name={leadingIcon} size={20} color="#6e7977" />
          </View>
        )}
        <TextInput
          {...rest}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          placeholderTextColor="#6e7977"
          className={`h-14 ${leadingIcon ? 'pl-12' : 'pl-4'} pr-4 bg-white rounded-xl text-on-surface text-body-md border-2 ${borderClass}`}
          style={{ fontFamily: 'Inter_400Regular' }}
        />
      </View>
      {error && <Text className="text-error text-label-md" style={{ fontFamily: 'Inter_500Medium' }}>{error}</Text>}
    </View>
  );
}
```

- [ ] **Step 6: Write StatusChip + MemberBadge**

`components/ui/StatusChip.tsx`:
```tsx
import { View, Text } from 'react-native';

type Variant = 'pending' | 'processing' | 'done' | 'rejected' | 'paid' | 'voided';

const STYLE: Record<Variant, { bg: string; text: string; border: string }> = {
  pending:    { bg: 'bg-blue-50',           text: 'text-blue-600',                  border: 'border-blue-100' },
  processing: { bg: 'bg-secondary-container/15', text: 'text-on-secondary-fixed-variant', border: 'border-secondary-container/30' },
  done:       { bg: 'bg-primary-fixed',     text: 'text-on-primary-fixed',          border: 'border-primary-fixed-dim' },
  paid:       { bg: 'bg-green-50',          text: 'text-green-600',                 border: 'border-green-100' },
  rejected:   { bg: 'bg-error-container',   text: 'text-on-error-container',        border: 'border-error/30' },
  voided:     { bg: 'bg-surface-container', text: 'text-on-surface-variant',        border: 'border-outline-variant' },
};

export function StatusChip({ variant, label }: { variant: Variant; label: string }) {
  const s = STYLE[variant];
  return (
    <View className={`px-3 py-1 rounded-full border ${s.bg} ${s.border}`}>
      <Text className={`text-label-sm ${s.text}`} style={{ fontFamily: 'Inter_600SemiBold' }}>{label}</Text>
    </View>
  );
}
```

`components/ui/MemberBadge.tsx`:
```tsx
import { View, Text } from 'react-native';

export function MemberBadge({ accountNo }: { accountNo: number | null }) {
  if (!accountNo) return null;
  return (
    <View className="px-2 py-0.5 rounded-full bg-surface-container-highest w-fit">
      <Text className="text-on-surface-variant text-label-md" style={{ fontFamily: 'Inter_500Medium' }}>
        MS: {accountNo}
      </Text>
    </View>
  );
}
```

- [ ] **Step 7: Write FAB**

`components/ui/Fab.tsx`:
```tsx
import { Pressable } from 'react-native';
import { MIcon } from './MIcon';

export function Fab({ icon = 'add', onPress }: { icon?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="fixed bottom-20 right-6 w-14 h-14 bg-secondary rounded-full items-center justify-center active:scale-90"
      style={{ shadowColor: '#bb0112', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6, position: 'absolute' }}
    >
      <MIcon name={icon} size={32} color="#ffffff" />
    </Pressable>
  );
}
```

- [ ] **Step 8: Write FilterChipRow (horizontal scroll)**

`components/ui/FilterChipRow.tsx`:
```tsx
import { ScrollView, Pressable, Text } from 'react-native';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function FilterChipRow<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-margin-mobile">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={active
              ? 'px-5 py-2 rounded-full bg-primary'
              : 'px-5 py-2 rounded-full bg-white border border-outline-variant'}
            style={active ? { shadowColor: '#005c55', shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 } : undefined}
          >
            <Text
              className={active ? 'text-white text-label-md' : 'text-on-surface-variant text-label-md'}
              style={{ fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium' }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 9: Write Skeleton + Sheet wrappers**

`components/ui/Skeleton.tsx`:
```tsx
import { View, type ViewProps } from 'react-native';

export function Skeleton({ className = '', ...rest }: ViewProps & { className?: string }) {
  return <View {...rest} className={`bg-surface-container rounded-lg ${className}`} />;
}
```

`components/ui/Sheet.tsx`:
```tsx
import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Sheet({ children, ...rest }: ViewProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View {...rest} className="flex-1 px-margin-mobile pt-4">{children}</View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 10: Write HeroProgressCard (premium gradient card pattern)**

`components/portal/HeroProgressCard.tsx`:
```tsx
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MIcon } from '../ui/MIcon';

interface Props {
  label: string;
  value: number;
  unit: string;
  tierName: string;        // "BẠC", "VÀNG"
  tierHint: string;        // "Đang tiến đến hạng VÀNG"
  goalLabel: string;       // "Tiến trình mục tiêu"
  goalValue: string;       // "47/50 máy"
  progressPct: number;     // 0..100
}

export function HeroProgressCard({ label, value, unit, tierName, tierHint, goalLabel, goalValue, progressPct }: Props) {
  return (
    <View className="relative overflow-hidden rounded-3xl">
      <LinearGradient
        colors={['#0f766e', '#005c55']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 24 }}
      >
        {/* Decorative blur dot */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: -48, right: -48,
            width: 192, height: 192, borderRadius: 96,
            backgroundColor: 'rgba(255,255,255,0.10)',
          }}
        />
        <View className="flex-row justify-between items-start mb-6">
          <View>
            <Text className="text-on-primary opacity-80 text-label-md mb-1" style={{ fontFamily: 'Inter_500Medium' }}>{label}</Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="text-on-primary text-display" style={{ fontFamily: 'Inter_700Bold' }}>{value}</Text>
              <Text className="text-on-primary text-body-lg" style={{ fontFamily: 'Inter_400Regular' }}>{unit}</Text>
            </View>
          </View>
          <View className="items-end">
            <View className="flex-row items-center gap-1 px-4 py-1.5 rounded-xl bg-white/20 border border-white/30">
              <MIcon name="stars" size={18} color="#ffffff" />
              <Text className="text-white text-label-md" style={{ fontFamily: 'Inter_700Bold' }}>{tierName}</Text>
            </View>
            <Text className="text-on-primary opacity-80 text-label-sm italic mt-2" style={{ fontFamily: 'Inter_400Regular' }}>{tierHint}</Text>
          </View>
        </View>
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-on-primary text-label-md" style={{ fontFamily: 'Inter_500Medium' }}>{goalLabel}</Text>
            <Text className="text-on-primary text-label-md" style={{ fontFamily: 'Inter_500Medium' }}>{goalValue}</Text>
          </View>
          <View className="h-3 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <View
              className="h-full bg-white rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
                shadowColor: '#ffffff', shadowOpacity: 0.6, shadowRadius: 12,
              }}
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
```

Install missing dep:
```bash
npx expo install expo-linear-gradient
```

- [ ] **Step 11: Write TierLadder (Đồng / Bạc / Vàng ranking)**

`components/portal/TierLadder.tsx`:
```tsx
import { View, Text, Pressable } from 'react-native';
import { MIcon } from '../ui/MIcon';

type Tier = 'bronze' | 'silver' | 'gold';

interface Props {
  current: Tier;
  onSelect?: (t: Tier) => void;
}

const TIER_META: Record<Tier, { name: string; rate: string; iconBg: string; iconColor: string; icon: string }> = {
  bronze: { name: 'ĐỒNG', rate: 'Chiết khấu 15%', iconBg: 'bg-orange-100',  iconColor: '#9a3412', icon: 'military_tech' },
  silver: { name: 'BẠC',  rate: 'Chiết khấu 20%', iconBg: 'bg-slate-100',   iconColor: '#475569', icon: 'military_tech' },
  gold:   { name: 'VÀNG', rate: 'Chiết khấu 25%', iconBg: 'bg-yellow-100',  iconColor: '#a16207', icon: 'stars' },
};

const ORDER: Tier[] = ['bronze', 'silver', 'gold'];

export function TierLadder({ current, onSelect }: Props) {
  return (
    <View className="gap-3">
      {ORDER.map((t) => {
        const meta = TIER_META[t];
        const active = t === current;
        const reachedOrLower = ORDER.indexOf(t) <= ORDER.indexOf(current);
        return (
          <Pressable
            key={t}
            onPress={() => onSelect?.(t)}
            className={active
              ? 'bg-white p-4 rounded-2xl border-2 border-primary flex-row items-center justify-between relative overflow-hidden'
              : 'bg-white p-4 rounded-2xl border border-outline-variant flex-row items-center justify-between'}
            style={{ shadowColor: '#131b2e', shadowOpacity: active ? 0.08 : 0.03, shadowRadius: 8, elevation: active ? 3 : 1 }}
          >
            {active && (
              <View className="absolute right-0 top-0 bg-primary px-3 py-1 rounded-bl-xl">
                <Text className="text-white text-[10px] uppercase" style={{ fontFamily: 'Inter_700Bold' }}>Đang áp dụng</Text>
              </View>
            )}
            <View className="flex-row items-center gap-4">
              <View className={`w-12 h-12 rounded-xl items-center justify-center ${meta.iconBg}`}>
                <MIcon name={meta.icon} size={24} color={meta.iconColor} />
              </View>
              <View>
                <Text className={active ? 'text-primary' : 'text-on-surface'} style={{ fontFamily: 'Inter_700Bold' }}>{meta.name}</Text>
                <Text className={active ? 'text-primary/80 text-label-sm' : 'text-on-surface-variant text-label-sm'} style={{ fontFamily: 'Inter_500Medium' }}>{meta.rate}</Text>
              </View>
            </View>
            {active
              ? <MIcon name="check_circle" size={24} color="#005c55" />
              : <MIcon name={reachedOrLower ? 'chevron_right' : 'lock'} size={24} color="#bdc9c6" />}
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 12: Write StatScrollRow (horizontal stat cards)**

`components/portal/StatScrollRow.tsx`:
```tsx
import { ScrollView, View, Text } from 'react-native';
import { MIcon } from '../ui/MIcon';

interface Stat {
  icon: string;
  iconBg: string;       // tailwind bg color e.g. 'bg-tertiary-fixed'
  iconColor: string;    // hex color e.g. '#6e3900'
  label: string;
  value: string;
  unit?: string;
  deltaPct?: string;    // e.g. '18%' (positive = green badge with trending_up)
  primary?: boolean;    // first stat in row gets wider min-width
}

export function StatScrollRow({ stats }: { stats: Stat[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-stack-md px-margin-mobile"
      className="-mx-margin-mobile hide-scrollbar"
    >
      {stats.map((s, i) => (
        <View
          key={`${s.label}-${i}`}
          className={`p-5 rounded-2xl bg-surface border border-outline-variant ${s.primary ? 'min-w-[240px]' : 'min-w-[180px]'}`}
          style={{ shadowColor: '#131b2e', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className={`p-2 rounded-xl ${s.iconBg}`}>
              <MIcon name={s.icon} size={20} color={s.iconColor} />
            </View>
            {s.deltaPct && (
              <View className="flex-row items-center">
                <MIcon name="trending_up" size={16} color="#005c55" />
                <Text className="text-primary text-label-md" style={{ fontFamily: 'Inter_700Bold' }}>{s.deltaPct}</Text>
              </View>
            )}
          </View>
          <Text className="text-on-surface-variant text-label-md" style={{ fontFamily: 'Inter_500Medium' }}>{s.label}</Text>
          <Text className="text-on-surface text-headline-sm mt-2" style={{ fontFamily: 'Inter_600SemiBold' }}>
            {s.value}
            {s.unit && <Text className="text-on-surface-variant text-body-md" style={{ fontFamily: 'Inter_400Regular' }}> {s.unit}</Text>}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 13: Write MetallicTierCard (Profile circular progress badge)**

`components/portal/MetallicTierCard.tsx`:
```tsx
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { MIcon } from '../ui/MIcon';

interface Props {
  tier: 'bronze' | 'silver' | 'gold';
  currentUnits: number;
  targetUnits: number;
  heading: string;     // "Hạng hiện tại: Bạc"
  subtitle: string;    // "Chỉ còn 153 máy nữa để đạt cấp bậc VÀNG..."
  callout: string;     // "Đạt VÀNG khi bán 200 máy"
}

const GRADIENT: Record<Props['tier'], string[]> = {
  bronze: ['#fed7aa', '#c2410c', '#fdba74'],
  silver: ['#e2e8f0', '#94a3b8', '#cbd5e1'],
  gold:   ['#fde68a', '#a16207', '#fcd34d'],
};

export function MetallicTierCard({ tier, currentUnits, targetUnits, heading, subtitle, callout }: Props) {
  const r = 42; const c = 2 * Math.PI * r;
  const pct = Math.min(1, currentUnits / Math.max(1, targetUnits));
  const offset = c * (1 - pct);
  return (
    <View className="relative overflow-hidden rounded-3xl">
      <LinearGradient
        colors={GRADIENT[tier] as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ padding: 32 }}
      >
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: -48, right: -48, width: 192, height: 192, borderRadius: 96, backgroundColor: 'rgba(255,255,255,0.10)' }}
        />
        <View className="flex-row items-center gap-8">
          <View className="w-40 h-40 items-center justify-center relative">
            <Svg width="160" height="160" viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r={r} stroke="rgba(0,0,0,0.05)" strokeWidth="8" fill="transparent" />
              <Circle
                cx="50" cy="50" r={r} stroke="#005c55" strokeWidth="8" fill="transparent"
                strokeDasharray={c} strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </Svg>
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <MIcon name="workspace_premium" size={32} color="#131b2e" />
              <Text className="text-headline-md text-on-surface" style={{ fontFamily: 'Inter_600SemiBold' }}>
                {currentUnits}/{targetUnits}
              </Text>
              <Text className="text-label-sm uppercase text-on-surface" style={{ fontFamily: 'Inter_600SemiBold' }}>máy</Text>
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-headline-md text-on-surface mb-2" style={{ fontFamily: 'Inter_600SemiBold' }}>{heading}</Text>
            <Text className="text-body-lg text-on-surface opacity-80 mb-4" style={{ fontFamily: 'Inter_400Regular' }}>{subtitle}</Text>
            <View className="flex-row items-center gap-2 bg-primary px-4 py-2 rounded-full self-start">
              <MIcon name="trending_up" size={20} color="#ffffff" />
              <Text className="text-on-primary text-label-md" style={{ fontFamily: 'Inter_500Medium' }}>{callout}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
```

- [ ] **Step 14: Commit**

```bash
git add tailwind.config.js metro.config.js babel.config.js global.css nativewind-env.d.ts components/ui/ components/portal/HeroProgressCard.tsx components/portal/TierLadder.tsx components/portal/StatScrollRow.tsx components/portal/MetallicTierCard.tsx package.json package-lock.json
git commit -m "feat(design): M3 light teal palette + UI primitives + portal hero/tier/stat patterns"
```

---

## Task 6: Root layout + providers + splash routing

**Files:**
- Modify: `app/_layout.tsx`
- Create: `app/index.tsx` (splash/router)
- Create: `app/(auth)/_layout.tsx`

- [ ] **Step 1: Write root layout**

`app/_layout.tsx` (M3 light + Inter font loading):
```tsx
import '../global.css';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider } from '../lib/auth';
import { I18nProvider } from '../lib/i18n';

SplashScreen.preventAutoHideAsync();
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView className="flex-1 bg-background">
      <SafeAreaProvider>
        <QueryClientProvider client={qc}>
          <I18nProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#faf8ff' } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="orders/new" options={{ presentation: 'modal' }} />
                <Stack.Screen name="orders/confirm" options={{ presentation: 'modal' }} />
                <Stack.Screen name="dealer-qr" options={{ presentation: 'modal' }} />
                <Stack.Screen name="payout-info" options={{ presentation: 'modal' }} />
                <Stack.Screen name="inbox" options={{ presentation: 'modal' }} />
              </Stack>
              <Toaster position="top-center" theme="light" />
            </AuthProvider>
          </I18nProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Also update `app.json` (back in Task 1 config): change `userInterfaceStyle` from `"dark"` to `"light"`, change splash `backgroundColor` from `"#000000"` to `"#faf8ff"`.

```bash
npx expo install react-native-gesture-handler
```

- [ ] **Step 2: Write index.tsx — splash routing**

`app/index.tsx`:
```tsx
import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { isBiometricEnabled, biometricGate, hasBiometricHardware } from '../lib/biometric';
import { useState } from 'react';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const { t } = useI18n();
  const [bioPassed, setBioPassed] = useState(false);
  const [bioChecked, setBioChecked] = useState(false);

  useEffect(() => {
    (async () => {
      if (!session) { setBioChecked(true); return; }
      const enabled = await isBiometricEnabled();
      if (!enabled || !(await hasBiometricHardware())) {
        setBioPassed(true); setBioChecked(true); return;
      }
      const ok = await biometricGate(t('ios.auth.face_id_unlock_reason'));
      setBioPassed(ok);
      setBioChecked(true);
    })();
  }, [session]);

  if (loading || !bioChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-base">
        <ActivityIndicator color="#ff5625" />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!bioPassed) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-base gap-4 px-8">
        <Text className="text-textc-primary text-lg">{t('ios.auth.face_id_unlock_reason')}</Text>
        <Text className="text-textc-secondary text-sm text-center">Tap to try again — or sign out and use password.</Text>
      </View>
    );
  }
  if (!profile) return <Redirect href="/(auth)/login" />;
  if (profile.status === 'pending') return <Redirect href="/(auth)/pending" />;
  if (!profile.phone) return <Redirect href="/(auth)/onboarding" />;
  if (profile.role === 'dealer') return <Redirect href="/(tabs)" />;
  // supervisor/admin in Phase 1: show "coming soon" placeholder
  return <Redirect href="/(auth)/role-not-supported-yet" />;
}
```

- [ ] **Step 3: Write `app/(auth)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }} />;
}
```

- [ ] **Step 4: Run dev simulator + verify boot**

```bash
npx expo start --ios
```

Expected: simulator boots, shows splash spinner, redirects to `/(auth)/login` (which will 404 until Task 7 — that's expected).

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx app/index.tsx app/\(auth\)/_layout.tsx package.json package-lock.json
git commit -m "feat(app): root layout with providers + splash routing"
```

---

## Task 7: Auth screens — login, register, forgot, reset, onboarding, pending, role-not-supported

**Files (create all 7):**
- `app/(auth)/login.tsx`, `register.tsx`, `forgot.tsx`, `reset.tsx`, `onboarding.tsx`, `pending.tsx`, `role-not-supported-yet.tsx`

**Pattern reference:** web equivalents at `~/Downloads/dai-long-landing/src/app/portal/{login,register,forgot-password,reset-password,onboarding,pending}/page.tsx`. Reuse i18n keys `portal.auth.*` (already in translations).

- [ ] **Step 1: Write `login.tsx` (most complex — full code below)**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { Link, router } from 'expo-router';
import { toast } from 'sonner-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { signInWithApple, isAppleAuthAvailable } from '../../lib/apple-signin';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect } from 'react';

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvail, setAppleAvail] = useState(false);

  useEffect(() => { isAppleAuthAvailable().then(setAppleAvail); }, []);

  const onPasswordLogin = async () => {
    if (!email.includes('@')) return toast.error(t('portal.auth.login.error_email_invalid'));
    if (password.length < 8) return toast.error(t('portal.auth.login.error_password_min'));
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    router.replace('/');
  };

  const onApple = async () => {
    setLoading(true);
    const r = await signInWithApple();
    setLoading(false);
    if (!r.ok && r.error !== 'cancelled') return toast.error(r.error ?? 'Apple sign in failed');
    if (r.ok) router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <ScrollView contentContainerClassName="flex-1 px-6 py-8 justify-center gap-6">
        <View className="items-center gap-2 mb-4">
          <Image source={require('../../assets/logo.png')} className="w-16 h-16" resizeMode="contain" />
          <Text className="text-textc-primary text-2xl font-bold">{t('portal.auth.login.title')}</Text>
          <Text className="text-textc-tertiary text-xs uppercase tracking-widest">{t('portal.auth.common.portal_badge')}</Text>
        </View>

        {appleAvail && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={{ width: '100%', height: 50 }}
            onPress={onApple}
          />
        )}

        <View className="flex-row items-center gap-3">
          <View className="flex-1 h-px bg-white/10" />
          <Text className="text-textc-tertiary text-xs">{t('portal.auth.common.or')}</Text>
          <View className="flex-1 h-px bg-white/10" />
        </View>

        <Input
          label={t('portal.auth.common.email_label')}
          placeholder={t('portal.auth.common.email_placeholder')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label={t('portal.auth.common.password_label')}
          placeholder={t('portal.auth.common.password_min_placeholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Link href="/(auth)/forgot" className="text-orange-500 text-sm text-right">{t('portal.auth.login.forgot_link')}</Link>

        <Button label={loading ? t('portal.auth.login.submitting') : t('portal.auth.login.submit')} onPress={onPasswordLogin} loading={loading} />

        <View className="flex-row justify-center gap-2">
          <Text className="text-textc-secondary text-sm">{t('portal.auth.login.no_account')}</Text>
          <Link href="/(auth)/register" className="text-orange-500 text-sm font-semibold">{t('portal.auth.login.signup_link')}</Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Write `register.tsx`**

Template: same structure as login. Fields: email, password. After `supabase.auth.signUp` success → toast `portal.auth.register.confirm_sent` + navigate `/(auth)/pending`. Read full logic from web: `~/Downloads/dai-long-landing/src/app/portal/register/page.tsx` and port to RN. Same Apple button placement.

- [ ] **Step 3: Write `forgot.tsx`**

Email field + `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'dailong://reset' })`. On success, show "Email sent" state. Port from `~/Downloads/dai-long-landing/src/app/portal/forgot-password/page.tsx`.

- [ ] **Step 4: Write `reset.tsx`**

Deep-link target. Read `code` from URL search params via `useLocalSearchParams()`. Call `supabase.auth.exchangeCodeForSession(code)` first to establish session, then show new password + confirm fields. After `supabase.auth.updateUser({ password })` success → redirect `/`.

- [ ] **Step 5: Write `onboarding.tsx`**

Single phone input. After validation regex `/^0\d{9}$/`, call `supabase.from('profiles').update({ phone }).eq('id', session.user.id)`. On success → `await refreshProfile()` → `router.replace('/')`.

- [ ] **Step 6: Write `pending.tsx`**

Read-only status page. Big icon (`SfIcon name="clock.fill"`), `t('portal.auth.pending.title')` heading, `body` paragraph, `tip_1/2/3` list. Sign out button at bottom.

- [ ] **Step 7: Write `role-not-supported-yet.tsx`**

Placeholder for Phase 1 supervisor/admin users. Heading: "App for supervisor/admin coming soon". Show user role badge + role-specific intro: "Use the web portal at dailongai.com/portal for now." Link button opens web in Safari via `expo-linking`. Sign out button.

- [ ] **Step 8: Smoke test in simulator**

```bash
npx expo start --ios
```

Manually navigate login → forgot → reset (paste a real token from email after triggering forgot password against staging). Test Apple Sign In flow.

- [ ] **Step 9: Commit**

```bash
git add app/\(auth\)/
git commit -m "feat(auth): login + register + forgot + reset + onboarding + pending screens"
```

---

## Task 8: Tab bar + Dashboard tab (Dealer)

**UPDATED 2026-05-25 (M3 mockup):** Dashboard now uses `HeroProgressCard` (premium gradient + tier badge + progress bar) + `StatScrollRow` (horizontal scroll stat cards) from Task 5. Replaces basic `CommissionPendingCard` + `TierCard` flat layout. Top app bar shows avatar + greeting + member badge chip; bell icon opens inbox.

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx` (Dashboard)
- Create: `components/portal/PortalAppBar.tsx` (shared top bar with avatar + greeting + member badge + bell)
- Create: `lib/queries/dealer.ts`

- [ ] **Step 1: Write tab layout (M3 light, Material Icons, primary teal active)**

`app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from 'expo-router';
import { MIcon } from '../../components/ui/MIcon';
import { useI18n } from '../../lib/i18n';

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#005c55',
        tabBarInactiveTintColor: '#6e7977',
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        tabBarStyle: {
          height: 72,
          paddingTop: 6,
          paddingBottom: 14,
          backgroundColor: '#faf8ff',
          borderTopWidth: 0.5,
          borderTopColor: '#bdc9c6',
        },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: t('portal.shell.nav.dashboard'),
        tabBarIcon: ({ color }) => <MIcon name="home" color={color} size={24} />,
      }} />
      <Tabs.Screen name="orders" options={{
        title: t('portal.shell.nav.orders'),
        tabBarIcon: ({ color }) => <MIcon name="receipt-long" color={color} size={24} />,
      }} />
      <Tabs.Screen name="commission" options={{
        title: t('portal.shell.nav.commission'),
        tabBarIcon: ({ color }) => <MIcon name="account-balance-wallet" color={color} size={24} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: t('portal.shell.nav.profile'),
        tabBarIcon: ({ color }) => <MIcon name="person" color={color} size={24} />,
      }} />
    </Tabs>
  );
}
```

Note: `react-native-vector-icons/MaterialIcons` uses kebab-case names (`receipt-long`, `account-balance-wallet`) not underscored. Confirm by `import Icon from 'react-native-vector-icons/MaterialIcons'; Icon.getRawGlyphMap()` in dev.

- [ ] **Step 2: Write `lib/queries/dealer.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useDealerSummary(userId?: string) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['dealer.summary', userId],
    queryFn: async () => {
      // Reuse RPC from web portal: get_dealer_summary(p_user_id)
      const { data, error } = await supabase.rpc('get_dealer_summary', { p_user_id: userId });
      if (error) throw error;
      return data;
    },
  });
}

export function useDealerTierStatus(userId?: string) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['dealer.tier', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dealer_tier_status', { p_user_id: userId });
      if (error) throw error;
      return data;
    },
  });
}
```

NOTE: Verify these RPC names exist by checking memory `project_dailongai_tier_badge.md`. If a different RPC name is used, update accordingly. If summary RPC doesn't exist, replace with direct SELECT from `dealer_summary` view (web uses one of these — confirm by `grep -rn "get_dealer" ~/Downloads/dai-long-landing/src/lib/portal-queries.ts`).

- [ ] **Step 3: Write `PortalAppBar` shared component**

`components/portal/PortalAppBar.tsx`:
```tsx
import { View, Text, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { MIcon } from '../ui/MIcon';
import { MemberBadge } from '../ui/MemberBadge';
import type { ReactNode } from 'react';

interface Props {
  greeting: string;            // "Xin chào, Đại Long"
  subline?: ReactNode;         // role label or member badge
  avatarUri?: string | null;
  hasUnread?: boolean;
}

export function PortalAppBar({ greeting, subline, avatarUri, hasUnread }: Props) {
  return (
    <View className="flex-row justify-between items-center px-margin-mobile h-16 bg-surface">
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-fixed">
          {avatarUri
            ? <Image source={{ uri: avatarUri }} className="w-full h-full" resizeMode="cover" />
            : <View className="w-full h-full bg-primary-container items-center justify-center">
                <MIcon name="person" size={20} color="#ffffff" />
              </View>}
        </View>
        <View>
          <Text className="text-headline-sm text-primary" style={{ fontFamily: 'Inter_600SemiBold' }}>{greeting}</Text>
          {subline}
        </View>
      </View>
      <Pressable
        onPress={() => router.push('/inbox')}
        className="w-10 h-10 items-center justify-center rounded-full active:bg-surface-container-low relative"
      >
        <MIcon name="notifications" size={24} color="#005c55" />
        {hasUnread && (
          <View className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-surface" />
        )}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Write Dashboard screen (M3 hero + stat scroll)**

`app/(tabs)/index.tsx`:
```tsx
import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useDealerSummary, useDealerTierStatus } from '../../lib/queries/dealer';
import { PortalAppBar } from '../../components/portal/PortalAppBar';
import { HeroProgressCard } from '../../components/portal/HeroProgressCard';
import { StatScrollRow } from '../../components/portal/StatScrollRow';
import { MemberBadge } from '../../components/ui/MemberBadge';
import { Button } from '../../components/ui/Button';
import { router } from 'expo-router';

export default function Dashboard() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const summary = useDealerSummary(profile?.id);
  const tier = useDealerTierStatus(profile?.id);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([summary.refetch(), tier.refetch()]);
    setRefreshing(false);
  }, []);

  // Derive hero card props from tier query
  const heroProps = {
    label: t('portal.components.dealerDashboard.units_ytd'),
    value: tier.data?.current_units ?? 0,
    unit: t('portal.components.dealerDashboard.unit_short'),
    tierName: tier.data?.current_name?.toUpperCase() ?? 'CƠ BẢN',
    tierHint: tier.data?.next_name
      ? `Đang tiến đến hạng ${tier.data.next_name.toUpperCase()}`
      : t('portal.components.dealerDashboard.top_tier_label'),
    goalLabel: 'Tiến trình mục tiêu',
    goalValue: `${tier.data?.current_units ?? 0}/${tier.data?.next_threshold ?? 0} máy`,
    progressPct: tier.data?.next_threshold
      ? Math.min(100, (tier.data.current_units / tier.data.next_threshold) * 100)
      : 100,
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <PortalAppBar
        greeting={`Xin chào, ${profile?.full_name?.split(' ').slice(-1)[0] ?? 'Đại lý'}`}
        subline={<MemberBadge accountNo={profile?.account_no ?? null} />}
        hasUnread={summary.data?.unread_count > 0}
      />
      <ScrollView
        contentContainerClassName="pb-32 pt-2 gap-stack-lg px-margin-mobile"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#005c55" />}
      >
        {/* Hero progress card */}
        <HeroProgressCard {...heroProps} />

        {/* Horizontal scroll stat row (full-bleed) */}
        <View className="-mx-margin-mobile">
          <StatScrollRow
            stats={[
              {
                icon: 'account-balance-wallet',
                iconBg: 'bg-tertiary-fixed',
                iconColor: '#6e3900',
                label: 'Hoa hồng tháng này',
                value: `${(summary.data?.commission_this_month ?? 0).toLocaleString('vi-VN')} ₫`,
                deltaPct: summary.data?.commission_delta_pct,
                primary: true,
              },
              {
                icon: 'sync',
                iconBg: 'bg-surface-container-highest',
                iconColor: '#005c55',
                label: 'Đơn đang xử lý',
                value: String(summary.data?.orders_processing ?? 0),
                unit: 'đơn',
              },
              {
                icon: 'check-circle',
                iconBg: 'bg-primary-fixed',
                iconColor: '#00504a',
                label: 'Đơn đã thanh toán',
                value: String(summary.data?.orders_paid ?? 0),
                unit: 'đơn',
              },
            ]}
          />
        </View>

        <Button
          label={t('portal.shell.cta.new_order')}
          icon="add-circle"
          fullWidth
          onPress={() => router.push('/orders/new')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
```

Note: `tier.data` shape assumed; verify against `get_dealer_tier_status` RPC (see memory `project_dailongai_tier_badge.md`). Map field names accordingly. If `summary` RPC doesn't include `unread_count`/`commission_delta_pct`/`orders_processing`/`orders_paid`, add a small RPC `get_dealer_summary_v2` or compute client-side from 2 extra queries.

- [ ] **Step 5: Smoke test**

```bash
npx expo start --ios
```

Sign in with a real dealer account. Expected: dashboard loads with role badge "Đại lý", commission pending card, tier card, "Đơn mới" button. Pull-to-refresh works.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/ components/portal/CommissionPendingCard.tsx components/portal/TierCard.tsx lib/queries/dealer.ts
git commit -m "feat(dealer): tab bar + Dashboard screen with commission + tier cards"
```

---

## Task 9: Order flow — orders tab + new + confirm

**Files:**
- Create: `app/(tabs)/orders.tsx` (list + FAB)
- Create: `app/orders/new.tsx` (modal)
- Create: `app/orders/confirm.tsx` (post-submit success)
- Create: `lib/queries/orders.ts`

- [ ] **Step 1: Write `lib/queries/orders.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export function useDealerOrders(userId?: string) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['orders.dealer', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, serial_no, customer_name, sale_price, status, created_at')
        .eq('dealer_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

interface CreateOrderInput {
  product_id: string;
  quantity: number;
  customer_name: string;
  customer_phone: string;
  province: string;
  ward: string;
  address_detail: string;
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const { data, error } = await supabase.rpc('create_dealer_order', input as any);
      if (error) throw error;
      return data as { order_id: string; serial_no: string };
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders.dealer'] }); },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ['products.active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, price, description')
        .eq('status', 'active')
        .order('price', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
```

NOTE: RPC name `create_dealer_order` may differ — check web equivalent in `~/Downloads/dai-long-landing/src/lib/portal-queries.ts` or `submit_public_order` pattern. Adjust accordingly.

- [ ] **Step 2: Write orders list screen (M3 sticky filter + order card + FAB)**

`app/(tabs)/orders.tsx`:
```tsx
import { ScrollView, View, Text, Pressable, RefreshControl, Image } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { useDealerOrders } from '../../lib/queries/orders';
import { Input } from '../../components/ui/Input';
import { FilterChipRow } from '../../components/ui/FilterChipRow';
import { StatusChip } from '../../components/ui/StatusChip';
import { Fab } from '../../components/ui/Fab';
import { MIcon } from '../../components/ui/MIcon';
import { Button } from '../../components/ui/Button';

type Filter = 'all' | 'pending' | 'paid' | 'done' | 'voided';

export default function OrdersList() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const { data, isLoading, refetch } = useDealerOrders(profile?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (filter !== 'all') {
      rows = rows.filter((o: any) => {
        if (filter === 'pending') return o.status === 'pending';
        if (filter === 'paid') return o.status === 'paid';
        if (filter === 'done') return o.status === 'approved' || o.status === 'paid';
        if (filter === 'voided') return o.status === 'rejected' || o.status === 'voided';
        return true;
      });
    }
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((o: any) =>
        (o.serial_no ?? '').toLowerCase().includes(s) ||
        (o.customer_name ?? '').toLowerCase().includes(s)
      );
    }
    return rows;
  }, [data, filter, search]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Sticky filter bar */}
      <View className="bg-surface/95 border-b border-outline-variant py-stack-md gap-stack-md">
        <View className="px-margin-mobile">
          <Input
            leadingIcon="search"
            placeholder="Tìm mã đơn, khách hàng..."
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <FilterChipRow<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all',     label: 'Tất cả' },
            { value: 'pending', label: 'Chờ TT' },
            { value: 'paid',    label: 'Đã TT' },
            { value: 'done',    label: 'Hoàn thành' },
            { value: 'voided',  label: 'Huỷ' },
          ]}
        />
      </View>

      <ScrollView
        contentContainerClassName="px-margin-mobile pb-32 gap-stack-md pt-stack-md"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#005c55" />}
      >
        {isLoading && <Text className="text-on-surface-variant text-center mt-8" style={{ fontFamily: 'Inter_400Regular' }}>Đang tải…</Text>}
        {filtered.map((o: any) => <OrderCard key={o.id} order={o} t={t} />)}
        {!isLoading && filtered.length === 0 && (
          <Text className="text-on-surface-variant text-center mt-12" style={{ fontFamily: 'Inter_400Regular' }}>
            Không có đơn phù hợp với bộ lọc.
          </Text>
        )}
      </ScrollView>

      <Fab icon="add" onPress={() => router.push('/orders/new')} />
    </SafeAreaView>
  );
}

function OrderCard({ order: o, t }: { order: any; t: (k: string) => string }) {
  const statusVariant: any = ({
    pending: 'pending', approved: 'done', paid: 'paid',
    rejected: 'rejected', voided: 'voided',
  } as const)[o.status] ?? 'pending';
  const statusLabel = t(`portal.components.activityFeed.status_${o.status}`);
  const dt = new Date(o.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.id } } as any)}
      className="bg-surface rounded-2xl p-stack-lg border border-outline-variant active:scale-[0.98] gap-stack-md"
      style={{ shadowColor: '#131b2e', shadowOpacity: 0.05, shadowRadius: 20, elevation: 2 }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="text-label-sm text-outline uppercase" style={{ fontFamily: 'Inter_600SemiBold' }}>Mã đơn hàng</Text>
          <Text className="text-title-lg text-on-surface" style={{ fontFamily: 'Inter_700Bold' }}>#{o.serial_no}</Text>
          <Text className="text-label-md text-outline mt-0.5" style={{ fontFamily: 'Inter_500Medium' }}>{dt}</Text>
        </View>
        <StatusChip variant={statusVariant} label={statusLabel} />
      </View>

      {/* Customer info block */}
      <View className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-stack-md gap-stack-sm">
        <View className="flex-row items-center gap-2">
          <MIcon name="person" size={20} color="#005c55" />
          <Text className="text-on-surface text-body-md" style={{ fontFamily: 'Inter_600SemiBold' }}>{o.customer_name}</Text>
        </View>
        {o.customer_phone && (
          <View className="flex-row items-center gap-2">
            <MIcon name="call" size={18} color="#3e4947" />
            <Text className="text-on-surface-variant text-body-md" style={{ fontFamily: 'Inter_400Regular' }}>{o.customer_phone}</Text>
          </View>
        )}
        {o.product_name && (
          <View className="flex-row items-center gap-2">
            <MIcon name="medical-services" size={18} color="#3e4947" />
            <Text className="text-on-surface-variant text-body-md flex-1" style={{ fontFamily: 'Inter_400Regular' }} numberOfLines={1}>{o.product_name}</Text>
          </View>
        )}
      </View>

      {/* Footer: total + commission */}
      <View className="flex-row justify-between items-end">
        <View>
          <Text className="text-label-sm text-outline" style={{ fontFamily: 'Inter_500Medium' }}>Tổng thanh toán</Text>
          <Text className="text-headline-sm text-secondary" style={{ fontFamily: 'Inter_700Bold' }}>
            {Number(o.sale_price ?? 0).toLocaleString('vi-VN')} ₫
          </Text>
        </View>
        {o.commission_preview != null && (
          <View className="items-end">
            <Text className="text-label-sm text-outline" style={{ fontFamily: 'Inter_500Medium' }}>
              {o.status === 'paid' ? 'Hoa hồng đã nhận' : 'Hoa hồng dự kiến'}
            </Text>
            <Text className="text-body-md text-primary" style={{ fontFamily: 'Inter_700Bold' }}>
              + {Number(o.commission_preview).toLocaleString('vi-VN')} ₫
            </Text>
          </View>
        )}
      </View>

      {/* Action grid */}
      {(o.status === 'pending' || o.status === 'approved') && (
        <View className="flex-row gap-3 pt-1">
          <View className="flex-1">
            <Button label="Xem chi tiết" variant="tonal" icon="visibility" fullWidth onPress={() => router.push({ pathname: '/orders/[id]', params: { id: o.id } } as any)} />
          </View>
          <View className="flex-1">
            <Button label="Sao chép QR" variant="secondary-outlined" icon="qr-code-2" fullWidth onPress={() => { /* copy QR via Clipboard.setStringAsync */ }} />
          </View>
        </View>
      )}
    </Pressable>
  );
}
```

Notes:
- Status variant mapping uses `StatusChip` from Task 5 (5 variants: pending/processing/done/paid/rejected/voided)
- "Sao chép QR" button uses red `secondary-outlined` variant matching mockup (clinical contrast vs teal primary)
- `useMemo` filter avoids re-renders on chip toggle
- Search debouncing: defer to follow-up (Task 12 polish); current immediate filter is fine for ~50 orders

- [ ] **Step 3: Write `orders/new.tsx` (modal)**

Port form from `~/Downloads/dai-long-landing/src/components/portal/OrderForm.tsx`. Fields: product picker (Picker), quantity stepper, customer name, phone, address (3 fields province/ward/detail). Submit calls `useCreateOrder().mutateAsync(...)`. On success: `router.replace({ pathname: '/orders/confirm', params: { order_id, serial_no } })`.

- [ ] **Step 4: Write `orders/confirm.tsx` (modal)**

Receive `order_id` + `serial_no` via `useLocalSearchParams()`. Show success state with order code. CTA buttons: "Ghi đơn khác" → `router.replace('/orders/new')`; "Xem sổ hoa hồng" → `router.replace('/(tabs)/commission')`; close X dismisses to tabs.

- [ ] **Step 5: Smoke test**

Open dev simulator. Sign in. Navigate to Đơn tab. Tap FAB. Fill form. Submit. Expected: order created in DB (verify in Supabase Studio), navigate to confirm screen, navigate back shows new order at top of list.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/orders.tsx app/orders/ lib/queries/orders.ts
git commit -m "feat(orders): order list + new order modal + confirm screen"
```

---

## Task 10: Commission + Profile tabs + modal screens (dealer-qr, payout-info, inbox)

**Files:**
- Create: `app/(tabs)/commission.tsx`
- Create: `app/(tabs)/profile.tsx`
- Create: `app/dealer-qr.tsx`
- Create: `app/payout-info.tsx`
- Create: `app/inbox.tsx`
- Create: `lib/queries/commission.ts`, `lib/queries/inbox.ts`

- [ ] **Step 1: Write `lib/queries/commission.ts`**

Port query from web `dealer/commission/page.tsx` — SELECT from `dealer_commissions` table joined with orders. Include filter by status + date range.

- [ ] **Step 2: Write `commission.tsx`**

Tab screen. List of commission rows with status badge. Each row: serial, customer, sale price, commission amount, status. Sort by date desc. Pull-to-refresh. Filter chips at top (All, Pending, Approved, Paid, Rejected). "Yêu cầu tất toán" button at top opens modal (Phase 1 = simple sheet with note "Tính năng đang phát triển" — full request UI in P1.5 if Boss wants).

- [ ] **Step 3: Write `profile.tsx`**

Tab screen. Sections:
- Account: email, full_name, phone (read-only display)
- Bank/payout: open `payout-info` modal
- QR code: open `dealer-qr` modal
- Language: open language picker (reuse pattern from LanguageSwitcher web)
- Face ID toggle: switch
- Notifications: toggle (system settings deep link)
- Sign out button (danger)

Use Card primitive with rows of `Pressable` rows that navigate or toggle.

- [ ] **Step 4: Write `dealer-qr.tsx` (modal)**

Show QR code generated from URL `https://dailongai.com/dat-don?d=<dealer_slug>`. Use `react-native-qrcode-svg`:
```bash
npm install react-native-qrcode-svg
```
Buttons: Copy link, Share (native share sheet via `expo-sharing`).

- [ ] **Step 5: Write `payout-info.tsx` (modal)**

Port from web `~/Downloads/dai-long-landing/src/app/portal/payout-info/page.tsx`. Bank picker (reuse `vn-banks.json` data), account number input, account holder input. Save → UPDATE `dealer_bank_info` table. Same validation logic as web.

- [ ] **Step 6: Write `inbox.tsx` (modal)**

Port from web `~/Downloads/dai-long-landing/src/app/portal/inbox/page.tsx`. List of `portal_messages` for current user. Filter "All / Unread". Tap row → mark read + show detail. Pull-to-refresh.

- [ ] **Step 7: Smoke test all 3 tabs + 3 modals**

Manual flow: sign in → dashboard → switch to commission tab (loads list) → profile tab (rows render) → open dealer-qr modal (QR shows) → open payout-info modal (form renders) → open inbox modal from dashboard bell icon → sign out.

- [ ] **Step 8: Commit**

```bash
git add app/\(tabs\)/commission.tsx app/\(tabs\)/profile.tsx app/dealer-qr.tsx app/payout-info.tsx app/inbox.tsx lib/queries/commission.ts lib/queries/inbox.ts package.json package-lock.json
git commit -m "feat(dealer): commission + profile tabs + dealer-qr + payout-info + inbox modals"
```

---

## Task 11: Push notification integration + deep linking

**Files:**
- Modify: `app/index.tsx` (register push after profile loaded)
- Modify: `app/_layout.tsx` (deep link handler)
- Modify: `app/(tabs)/profile.tsx` (sign out should deregister token)

- [ ] **Step 1: Register push token after first meaningful load**

Edit `app/index.tsx` — add this effect after profile loads:
```ts
useEffect(() => {
  if (!session?.user || !profile || profile.status !== 'approved') return;
  // Register asynchronously, don't block UI
  import('../lib/notifications').then(({ registerForPushAsync }) => {
    registerForPushAsync(session.user.id).catch((e) => console.warn('push register fail', e));
  });
}, [session?.user?.id, profile?.status]);
```

- [ ] **Step 2: Wire deep link from notification tap**

Edit `app/_layout.tsx` — add inside `RootLayout()`:
```tsx
useEffect(() => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { type?: string; message_id?: string; data?: any };
    if (data.type === 'order_approved' || data.type === 'order_rejected') {
      router.push('/(tabs)/orders');
    } else if (data.type === 'commission_paid') {
      router.push('/(tabs)/commission');
    } else {
      router.push('/inbox');
    }
  });
  return () => sub.remove();
}, []);
```

Add imports:
```tsx
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
```

- [ ] **Step 3: Deregister token on sign out**

Edit `lib/auth.tsx` — modify `signOut` to:
```ts
const signOut = async () => {
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user) {
      // Best-effort deregister: read current Expo token and delete
      const Notifications = await import('expo-notifications');
      const Constants = await import('expo-constants');
      const projectId = Constants.default.expoConfig?.extra?.eas?.projectId;
      if (projectId) {
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (token) await supabase.from('device_tokens').delete().eq('expo_token', token);
      }
    }
  } catch (e) { console.warn('deregister fail', e); }
  await supabase.auth.signOut();
  setProfile(null);
};
```

- [ ] **Step 4: End-to-end push test**

Build dev client + install on physical iPhone:
```bash
npx eas-cli build --profile development --platform ios
```

Wait for build. Install via TestFlight or direct link. Sign in on device, grant notification permission. From Supabase SQL editor:
```sql
INSERT INTO portal_messages (recipient_user_id, type, title, body)
VALUES ('<your-dealer-uuid>', 'order_approved', 'Đơn được duyệt', 'Đơn #SN-TEST-001 đã được Đại Long duyệt.');
```

Expected: within 5 seconds, iPhone shows banner notification. Tap → app opens to Orders tab.

- [ ] **Step 5: Commit**

```bash
git add app/index.tsx app/_layout.tsx lib/auth.tsx
git commit -m "feat(push): register token + deep link from notification + deregister on sign out"
```

---

## Task 12: EAS build + TestFlight internal upload

**Files:** (config files modified)
- Modify: `eas.json` (with real Apple App ID from Task 0 Step 4)

- [ ] **Step 1: Push env vars to EAS (CRITICAL — easy to miss)**

```bash
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://lxrvvbmqrvrndkuycjje.supabase.co" --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key-value>" --visibility plaintext
# Also for preview environment
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://lxrvvbmqrvrndkuycjje.supabase.co" --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key-value>" --visibility plaintext

# Verify
npx eas-cli env:list production --format long
```

Per memory `feedback_eas_ios_pitfalls.md` item #4: local `.env.local` does NOT get bundled — must push to EAS.

- [ ] **Step 2: Trigger first production build (interactive)**

```bash
npx eas-cli build --profile production --platform ios
```

**Boss action required** here: prompt asks Apple ID + 2FA code for cert generation (one-time only). Per memory `feedback_eas_ios_pitfalls.md` "Bonus".

Wait ~10-15 minutes for build. Expect: success with IPA URL.

- [ ] **Step 3: Submit to App Store Connect (TestFlight)**

```bash
npx eas-cli submit --profile production --platform ios --latest --non-interactive
```

Wait ~5-10 minutes. Build appears in App Store Connect under TestFlight tab as "Processing".

- [ ] **Step 4: Create internal tester group with isInternalGroup=true (CRITICAL — create-time only)**

Per memory `feedback_eas_ios_pitfalls.md` item #5: cannot flip via PATCH later.

Use App Store Connect API:
```bash
# Generate ASC API JWT (use existing key from Sen Messenger)
# POST /v1/betaGroups with isInternalGroup: true
```

Or via App Store Connect UI: TestFlight → Internal Testing → `+` to add a Group. Make sure it's INTERNAL (under "Internal Testing" section, NOT "External Testing").

Group name: "Đại Long Dealers (Internal)".

- [ ] **Step 5: Add testers + assign build**

Add Boss + 5-10 trusted dealer Apple ID emails as internal testers (these need to be on the Apple Developer team — for first round, just Boss + Sen Coder + 1-2 sample dealer accounts).

Once build finishes processing (≤10 min after upload), assign it to the internal group:
- Via API: `POST /v1/betaGroups/{group_id}/relationships/builds`
- Via UI: TestFlight → Build → click → enable for group

Apple sends email invites automatically.

- [ ] **Step 6: Install + smoke test on real iPhone**

Boss installs TestFlight from email link. Opens Đại Long Portal. Sign in with Apple. Verify:
- App launches without crash
- Sign in with Apple succeeds (creates profile if first time, or links to existing)
- Face ID prompt appears after first login
- Dashboard loads with real data
- Create a test order
- Receive push notification when admin approves order

- [ ] **Step 7: Tag release + commit final config**

```bash
git tag -a v0.1.0-p1 -m "Phase 1: Auth + Dealer ready for TestFlight"
git add eas.json
git commit -m "chore: lock Apple App ID + Team ID in eas.json"
git push --tags
```

---

---

## Task 13: Final verification gate (Multi-task verification — CLAUDE.md §8.5)

**Why:** Phase 1 = 12 sequential code tasks (≥2 task gate triggered). Before reporting "Phase 1 done" to Boss, MUST run real verification commands and confirm tool output in the response.

- [ ] **Step 1: Invoke `superpowers:verification-before-completion` skill**

This loads the gate rules into the agent's context before claiming success.

- [ ] **Step 2: Type check (RN/TypeScript stack)**

```bash
cd ~/Downloads/dai-long-portal-ios
npx tsc --noEmit
```

Expected: exit 0, zero errors. If non-zero → fix before claiming done.

- [ ] **Step 3: ESLint pass**

```bash
npx expo lint
```

Expected: zero errors (warnings OK).

- [ ] **Step 4: Smoke test build (dev simulator)**

```bash
npx expo start --ios --no-dev --minify=false
```

Expected: simulator launches, app boots to splash → login. No red error screen, no metro bundle errors.

- [ ] **Step 5: Build verification (EAS preview)**

```bash
npx eas-cli build --profile preview --platform ios --non-interactive
```

Expected: build completes successfully (~10 min). IPA URL returned. If FAIL → DO NOT claim done; debug build log.

- [ ] **Step 6: Backend smoke test (push pipeline)**

In Supabase SQL editor, with a real dealer user UUID that has registered device token:
```sql
INSERT INTO portal_messages (recipient_user_id, type, title, body)
VALUES ('<real-uuid>', 'order_approved', 'Test push from final verification', 'If you see this on your iPhone, Phase 1 ships.');
```

Expected within 10 seconds: notification banner on test iPhone. If notification doesn't arrive → check Supabase Edge Function logs for `send-push`, fix, retry.

- [ ] **Step 7: TestFlight upload verification**

In App Store Connect → TestFlight tab → Builds: confirm latest build appears with status "Ready to Test" (not "Missing Compliance" or "Invalid Binary"). If issues → resolve before claiming done.

- [ ] **Step 8: Report with evidence**

Write final report to Boss with **actual tool output excerpts** (not summaries) for:
1. `tsc --noEmit` output (or `Exit: 0`)
2. EAS build URL + status line
3. TestFlight build status from ASC
4. Smoke test push timestamp + receipt confirmation

No tool output as evidence = NOT done. Per CLAUDE.md §8.5, Boss will reject any "done" claim without verification artifacts.

---

## Self-Review

Spec coverage check:
- ✅ Section 4 Architecture → Task 1 (scaffold) + Task 2 (backend)
- ✅ Section 5 Auth flow → Task 3+4 (libs) + Task 7 (screens)
- ✅ Section 6 Screen map → Tasks 7, 8, 9, 10
- ✅ Section 7 Push pipeline → Task 2 (backend) + Task 11 (client)
- ✅ Section 8 Visual style → Task 5
- ✅ Section 9 i18n → Task 4
- ✅ Section 10 Phasing (Phase 1 portion) → all tasks above
- ✅ Section 12 Risks → Task 0 (prerequisites), EAS lessons applied throughout

Placeholder scan:
- Task 8 Step 2 + Task 9 Step 1 + Task 10 Step 1: noted "verify RPC names against web" — these are necessary lookups, not placeholders; engineer must read 1 file before implementing.
- Task 9 Steps 3-4 + Task 10 Steps 4-6: "port from web {file}" — port pattern is intentional, engineer references real existing file.

Type consistency:
- `Profile.role` consistent: `'dealer' | 'supervisor' | 'admin'` everywhere
- `Profile.status` consistent: `'pending' | 'approved' | 'rejected'`
- Auth hook `useAuth()` exposes same shape across all consumers

## Open follow-ups (NOT in Phase 1, for next plan)

- App version check + force-update screen
- Native share sheet for dealer QR
- Notification Center grouping by category
- Apple App Review demo video vs text instructions
- iPad-optimized layouts (auto via SafeArea)
- Reset password deep link domain verification (associated domains for `dailongai.com`)
