# Đại Long Portal — iOS app design

**Date:** 2026-05-24
**Status:** Approved by Boss, ready for implementation plan
**Brand:** Đại Long Portal (bundle ID `ai.dailong.portal`)

## 1. Problem

Portal hiện tại chỉ chạy web tại `dailongai.com/portal/*`. Đại lý + supervisor + admin phải mở browser, không có:
- Native push notification (đại lý không biết đơn được duyệt)
- Face ID re-auth (phải nhập password mỗi lần)
- App Store presence (kém chuyên nghiệp với đối tác quốc tế)
- Mobile UX tối ưu (web responsive nhưng vẫn feel "web")

Cần đóng gói portal thành iOS app với 3 role parity, ship qua App Store.

## 2. Scope

**In scope (Phase 1-3):**
- iOS app native cho 3 role: dealer, supervisor, admin
- Full parity với web portal (31 routes hiện tại)
- Reuse 100% Supabase backend + 824 i18n keys
- Sign in with Apple + Face ID + Push notification
- App Store public submission

**Out of scope:**
- Android (sẽ là phase 4 sau khi iOS validated)
- Camera QR scan (Boss skip)
- Offline mode (Phase 1 require online)
- iPad-optimized layouts (iPhone only, iPad sẽ scale tự nhiên)
- Light mode (dark only Phase 1)

## 3. Decisions

| Decision | Choice | Reason |
|---|---|---|
| Stack | Expo SDK 54 + React Native + TypeScript | Reuse infra Sen Messenger EAS pipeline + share TS/Supabase code với web |
| Platform | iOS-only trước, Android Phase 4 | Focus + Apple HIG fidelity + ship nhanh |
| Phasing | P1 Dealer → P2 Supervisor → P3 Admin+submit | Feedback Boss sớm sau mỗi 1.5-2 tuần |
| Visual style | **Material Design 3 light — teal palette (UPDATED 2026-05-25)** | Per Boss mockup; medical-clinical aesthetic, premium feel, distinct from generic iOS apps |
| Auth | Apple + Google + Email/password | Apple required by guideline 4.8 |
| Re-auth | Face ID gate (sau session restore) | Quick unlock, KHÔNG thay thế Supabase JWT |
| Push | Expo Push API → APNS | Free, proxy, miễn config APNS cert tay |
| Repo | Tách riêng `dai-long-portal-ios/` | Tránh config xung đột với Next.js web |
| Bundle ID | `ai.dailong.portal` | Match pattern `ai.dailong.*` |
| App name | "Đại Long Portal" | 12 ký tự, brand + role rõ ràng |

## 4. Architecture

```
┌─────────────────────────────────────────┐
│  iOS app (Expo / React Native)         │
│  ┌───────────────────────────────────┐ │
│  │  Expo Router (file-based)        │ │
│  │  /(auth)  /(tabs)  /modals       │ │
│  └────────────┬──────────────────────┘ │
│  ┌────────────┴──────────────────────┐ │
│  │  TanStack Query + Context        │ │
│  │  AuthProvider, I18nProvider      │ │
│  └────────────┬──────────────────────┘ │
│  ┌────────────┴──────────────────────┐ │
│  │  Native modules:                  │ │
│  │  • expo-apple-authentication      │ │
│  │  • expo-local-authentication      │ │
│  │  • expo-notifications             │ │
│  │  • expo-secure-store              │ │
│  └────────────┬──────────────────────┘ │
└───────────────┼─────────────────────────┘
                │ HTTPS
                ↓
┌─────────────────────────────────────────┐
│  Supabase (shared with web portal)     │
│  • Auth (JWT, Apple/Google providers)   │
│  • Postgres + RLS                       │
│  • Realtime (portal_messages listen)    │
│  • Edge functions:                      │
│    - existing: submit_public_order, ...│
│    - NEW: send-push                     │
│  • Storage (later phases)               │
└─────────────────────────────────────────┘
                │ pg_notify
                ↓
        Edge: send-push
                │
                ↓
        Expo Push API → APNS → iPhone
```

### Repo structure

```
~/Downloads/dai-long-portal-ios/        # repo Git riêng
├── app/                                 # Expo Router pages
│   ├── (auth)/
│   │   ├── login.tsx                   # Sign in (Apple + Google + Email)
│   │   ├── register.tsx
│   │   ├── forgot.tsx
│   │   ├── reset.tsx                   # deep link target
│   │   ├── onboarding.tsx
│   │   ├── pending.tsx
│   │   └── _layout.tsx                 # stack
│   ├── (tabs)/
│   │   ├── index.tsx                   # Dashboard (Dealer)
│   │   ├── orders.tsx                  # Order list + FAB
│   │   ├── commission.tsx              # Ledger
│   │   ├── profile.tsx                 # + nav to payout-info, dealer-qr
│   │   └── _layout.tsx                 # tab bar
│   ├── orders/
│   │   ├── new.tsx                     # modal sheet
│   │   └── confirm.tsx
│   ├── dealer-qr.tsx                   # modal
│   ├── payout-info.tsx                 # modal
│   ├── inbox.tsx                       # accessed via bell icon
│   ├── 403.tsx
│   └── _layout.tsx                     # root: AuthProvider + I18nProvider
├── components/
│   ├── ui/                             # Button, Card, Input, Sheet, Toast
│   ├── portal/                         # mirrors web (DealerDashboard, OrderForm, ...)
│   └── icons/                          # SF Symbol wrappers
├── lib/
│   ├── supabase.ts                     # createClient, env vars
│   ├── auth.ts                         # AuthProvider, session restore
│   ├── apple-signin.ts                 # Sign in with Apple flow
│   ├── biometric.ts                    # Face ID gate
│   ├── notifications.ts                # register, deep link handler
│   ├── i18n.ts                         # useI18n (port from web)
│   └── queries.ts                      # TanStack Query hooks
├── translations/
│   ├── vi.ts                           # copy from web (824 keys + ios-specific additions)
│   └── en.ts
├── types/
│   └── supabase.ts                     # generated from supabase gen types
├── assets/
│   ├── icon.png                        # 1024×1024 app icon
│   ├── splash.png
│   └── flags/                          # nation flags (port from web)
├── eas.json                            # build profiles (dev/preview/production)
├── app.json                            # Expo config (bundle ID, Apple cap)
├── .env.local                          # SUPABASE_URL, SUPABASE_ANON_KEY
├── .npmrc                              # legacy-peer-deps=true (EAS fix)
└── package.json
```

### Backend changes (Supabase)

Migration `20260601000000_ios_app_support.sql`:

```sql
-- 1. Apple Sign In identity mapping
ALTER TABLE profiles ADD COLUMN apple_user_id text UNIQUE;
CREATE INDEX idx_profiles_apple_user_id ON profiles(apple_user_id) WHERE apple_user_id IS NOT NULL;

-- 2. Device tokens for push
CREATE TABLE device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  device_name text,
  app_version text,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now()
);
CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);

-- RLS: user only sees own tokens
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY device_tokens_own ON device_tokens
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Trigger to fire send-push
CREATE OR REPLACE FUNCTION notify_portal_message_push()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('portal_message_push', json_build_object(
    'message_id', NEW.id,
    'recipient_user_id', NEW.recipient_user_id,
    'title', NEW.title,
    'body', NEW.body,
    'type', NEW.type,
    'data', NEW.data
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_portal_messages_push
AFTER INSERT ON portal_messages
FOR EACH ROW EXECUTE FUNCTION notify_portal_message_push();
```

Edge function `send-push/index.ts` (Deno):
- Subscribe Supabase Realtime channel `pg_notify('portal_message_push')`
- Lookup `device_tokens WHERE user_id = recipient AND platform='ios' AND last_active_at > now() - interval '60 days'`
- Batch send qua `expo-server-sdk` (Expo Push API)
- Handle response: `DeviceNotRegistered` → mark token inactive (last_active_at = epoch); other errors → log + retry once

## 5. Authentication flow

### Login screen
```
[Logo Đại Long]
"Đăng nhập tài khoản"

[ Sign in with Apple ]   ← required by Apple 4.8
[ Continue with Google ]
─────────── hoặc ──────────
Email:    [_______________]
Password: [_______________]
[ Đăng nhập ]
"Chưa có tài khoản? Đăng ký"
"Quên mật khẩu?"
```

### Sign in with Apple
1. User tap → native iOS modal
2. Apple returns `appleUserId` + email (first time) + name (first time)
3. App calls `supabase.auth.signInWithIdToken({ provider: 'apple', token: appleIdToken })`
4. If `profiles.apple_user_id IS NULL` → UPDATE set apple_user_id = appleUserId
5. Continue to post-login flow

### Post-login flow
```
session received
  ↓
SELECT profiles WHERE id = auth.uid()
  ↓ status check
  ├─ pending           → /pending screen
  ├─ approved + no phone → /onboarding
  └─ approved + ready   → route by role:
       ├─ dealer     → /(tabs)/  (dealer dashboard)
       ├─ supervisor → /(tabs)/  (supervisor dashboard) [Phase 2]
       └─ admin      → /(tabs)/  (admin console)         [Phase 3]
  ↓
Prompt "Bật Face ID cho lần sau?" (first time, dismissible)
  ↓ if yes → SecureStore.set('faceid_enabled', 'true')
  ↓
Prompt "Bật thông báo?" (after first meaningful action, NOT immediate)
  ↓ if yes → Notifications.getExpoPushTokenAsync() → upsert device_tokens
```

### Re-auth on app re-open
```
app foreground
  ↓
restore session from SecureStore
  ├─ no session       → /login
  └─ session valid:
       ├─ faceid_enabled = true → biometric prompt
       │   ├─ success → enter app
       │   ├─ fail 3x  → fallback passcode (system PIN)
       │   └─ user cancel → /login (force re-password)
       └─ faceid_enabled = false → enter app directly
```

### Sign out
- `supabase.auth.signOut()`
- `SecureStore.deleteItemAsync('faceid_enabled')`
- DELETE `device_tokens WHERE user_id = me AND expo_token = current`
- Navigate `/login` (replace stack)

## 6. Screen map (Phase 1)

| Web route | iOS path | Type | Tab |
|---|---|---|---|
| /portal/login | `(auth)/login.tsx` | Stack | — |
| /portal/register | `(auth)/register.tsx` | Stack | — |
| /portal/forgot-password | `(auth)/forgot.tsx` | Stack | — |
| /portal/reset-password | `(auth)/reset.tsx` | Stack (deep link) | — |
| /portal/onboarding | `(auth)/onboarding.tsx` | Stack | — |
| /portal/pending | `(auth)/pending.tsx` | Stack | — |
| /portal/dashboard | `(tabs)/index.tsx` | Tab | 1 — Tổng quan |
| /portal/dealer/orders/new | `orders/new.tsx` | Modal sheet | (from tab 2 FAB) |
| /portal/dealer/orders/confirm | `orders/confirm.tsx` | Stack | (after new) |
| (new) order list | `(tabs)/orders.tsx` | Tab | 2 — Đơn |
| /portal/dealer/commission | `(tabs)/commission.tsx` | Tab | 3 — Hoa hồng |
| /portal/dealer/qr | `dealer-qr.tsx` | Modal | (from profile) |
| /portal/payout-info | `payout-info.tsx` | Modal | (from profile) |
| /portal/profile | `(tabs)/profile.tsx` | Tab | 4 — Tài khoản |
| /portal/inbox | `inbox.tsx` | Modal | (bell icon in header) |
| /portal/403 | `403.tsx` | Modal | — |

**Phase 1 also includes:** "App for supervisor/admin coming soon" placeholder screen if signed-in user has role ≠ dealer.

## 7. Push notifications

### Use cases (Phase 1)
- Đơn `approved` → "Đơn #SN1234 đã được duyệt" tap → /orders/{id}
- Đơn `rejected` → "Đơn #SN1234 bị từ chối: {reason}" tap → /orders/{id}
- Payment `paid` → "Hoa hồng 1.500.000đ đã chi trả" tap → /commission
- Inbox new message → "Thông báo mới từ Đại Long" tap → /inbox

### Pipeline
```
DB event → portal_messages INSERT
         → trigger trg_portal_messages_push
         → pg_notify('portal_message_push', payload)
         → Edge function send-push subscribed
         → lookup device_tokens
         → POST batches to https://exp.host/--/api/v2/push/send
         → Expo proxy → APNS → iPhone
         → user tap notification
         → Linking handler → router.push(deepLink)
```

### Deep link routing
- `dailong://orders/<id>` → `app/orders/[id].tsx` (Phase 1.5 add detail screen)
- `dailong://inbox` → `app/inbox.tsx`
- `dailong://commission` → `app/(tabs)/commission.tsx`
- `dailong://reset-password?token=<jwt>` → `app/(auth)/reset.tsx`

## 8. Visual style — Material Design 3 light (teal) [UPDATED 2026-05-25]

Per Boss mockup attached in conversation. Light theme with medical-clinical teal palette, distinct from generic iOS-orange. Inter typography + Material Symbols icon set.

### Design tokens (NativeWind preset)
```ts
// tailwind.config.js — M3 light theme
{
  colors: {
    // Primary teal scale
    primary: '#005c55',
    'primary-container': '#0f766e',
    'primary-fixed': '#9cf2e8',
    'primary-fixed-dim': '#80d5cb',
    'on-primary': '#ffffff',
    'on-primary-container': '#a3faef',
    'on-primary-fixed': '#00201d',
    'on-primary-fixed-variant': '#00504a',
    'inverse-primary': '#80d5cb',

    // Secondary red (FAB/CTA accent)
    secondary: '#bb0112',
    'secondary-container': '#e02928',
    'secondary-fixed': '#ffdad6',
    'secondary-fixed-dim': '#ffb4ab',
    'on-secondary': '#ffffff',
    'on-secondary-container': '#fffbff',
    'on-secondary-fixed': '#410002',
    'on-secondary-fixed-variant': '#93000b',

    // Tertiary amber (tier-bronze hint, decorative)
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
    sans: ['Inter', '-apple-system', 'system-ui'],
  },
  fontSize: {
    'label-sm':  ['11px', { lineHeight: '14px', fontWeight: '600' }],
    'label-md':  ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
    'body-md':   ['14px', { lineHeight: '20px', fontWeight: '400' }],
    'body-lg':   ['16px', { lineHeight: '24px', fontWeight: '400' }],
    'title-lg':  ['18px', { lineHeight: '26px', fontWeight: '500' }],
    'headline-sm':['20px', { lineHeight: '28px', fontWeight: '600' }],
    'headline-md':['24px', { lineHeight: '32px', fontWeight: '600' }],
    'headline-lg':['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
    display:     ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
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
}
```

### Component signatures
- **Card**: `bg-surface rounded-2xl p-stack-lg border border-outline-variant shadow-sm`
- **Glass card**: `bg-white/70 backdrop-blur-md border border-white/30` (overlay surfaces)
- **Button primary**: `h-12 bg-primary text-on-primary rounded-xl px-stack-lg font-semibold active:scale-[0.98]`
- **Button secondary**: `h-12 border-2 border-secondary text-secondary rounded-xl` (red accent for CTA actions)
- **FAB**: `w-14 h-14 bg-secondary text-on-secondary rounded-full shadow-lg fixed bottom-20 right-6 active:scale-90`
- **Tab bar**: bottom 16px height + 5 items, active = primary text + 2px primary top border + Material Symbol filled
- **App bar (top)**: 64px fixed, avatar (40px circle 2px primary-fixed border) + greeting + member badge chip + bell icon
- **Member badge chip**: `px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant text-label-md`
- **Status chip**: `px-3 py-1 rounded-full text-label-sm border` color combos:
  - Pending: `bg-blue-50 text-blue-600 border-blue-100`
  - Done: `bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim`
  - Rejected: `bg-error-container text-on-error-container border-error/30`
- **Input**: `h-14 pl-12 pr-4 bg-white border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-body-md` with left icon at `absolute left-4 top-1/2 -translate-y-1/2 text-outline`
- **Filter chip (active)**: `px-5 py-2 rounded-full bg-primary text-white text-label-md shadow-sm`
- **Filter chip (inactive)**: `px-5 py-2 rounded-full bg-white border border-outline-variant text-on-surface-variant text-label-md`
- **Modal sheet**: `pageSheet` presentation, drag-to-dismiss
- **Toast**: `sonner-native` top banner

### Iconography
- **Primary: Material Symbols Outlined** (Google) via `react-native-vector-icons/MaterialIcons` — matches mockup, weight/fill variations
- Active state in tab bar uses **filled** variant (`FILL` setting via `iconStyle: 'fill'` or use `MaterialCommunityIcons` filled variants)
- Common icons: `home`, `receipt_long`, `account_balance_wallet`, `notifications`, `person`, `medical_services`, `biotech`, `qr_code_2`, `workspace_premium`, `military_tech`, `stars`, `trending_up`, `check_circle`, `sync`, `add`, `chevron_right`

### Hero pattern — Premium gradient card (used on Dashboard)
- Gradient bg: `bg-gradient-to-br from-primary-container to-primary` + `text-on-primary`
- Decorative blur: absolute `-top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl` (group-hover intensify)
- Big metric: `text-display` for value + `text-body-lg` for unit
- Tier badge top-right: glass chip `px-4 py-1.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/30` with filled `stars` icon
- Progress bar: `h-3 bg-white/20 rounded-full` + filled `h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]`

### Tier ladder pattern (3 ranks Đồng / Bạc / Vàng)
- 3 stacked rows; active rank has `border-2 border-primary` + corner ribbon `bg-primary text-white text-[10px] px-3 py-1 rounded-bl-xl uppercase` reading "Đang áp dụng"
- Inactive ranks have `chevron_right` (locked → `lock` icon)
- Each row: icon tile `w-12 h-12 rounded-xl bg-{tier}-100 text-{tier}-700` + name + commission percentage

### Metallic tier card pattern (Profile hero — circular progress)
- Bg: `bg-gradient-to-br from-slate-200 via-slate-400 to-slate-300` (silver), or amber/yellow for gold variant
- Circular SVG progress (radius 42, stroke-width 8, stroke-dasharray 263.89, dynamic offset)
- Center: filled `workspace_premium` icon (32px) + `headline-md` value + `label-sm` label
- Sub-card "Đạt VÀNG khi bán 200 máy" with inline trending_up icon

### Stat scroll row (horizontal swipe)
- Container: `overflow-x-auto hide-scrollbar flex gap-stack-md -mx-margin-mobile px-margin-mobile`
- Each stat card: `min-w-[240px]` (first) or `min-w-[180px]` (subsequent), `p-5 rounded-2xl bg-surface border border-outline-variant shadow-sm`
- Top: icon tile (`p-2 rounded-xl bg-{tinted} text-{contrast}`) + delta badge (`text-primary text-label-md` with `trending_up` icon)
- Body: label + `text-headline-sm` value + sub-unit

### Order card pattern
- Container: `bg-surface rounded-2xl p-stack-lg border border-outline-variant order-card` with custom `box-shadow: 0 4px 20px rgba(15,23,42,0.05)` + `active:scale-[0.98]`
- Header row: order code (`text-primary font-bold text-body-md`) + timestamp + status chip
- Customer block: `bg-surface-container-lowest rounded-xl border border-slate-50 p-stack-md` with icon rows (person, call, medical_services)
- Product row: thumbnail (`w-16 h-16 rounded-lg`) + name + qty
- Footer: total + commission preview side-by-side
- Action grid: 2 buttons `grid grid-cols-2 gap-3` — "Xem chi tiết" (filled tonal primary) + "Sao chép QR" (outlined secondary red)

### Sticky filter bar pattern (Orders list)
- Container: `sticky top-16 z-40 bg-surface/80 backdrop-blur-md py-4 -mx-margin-mobile px-margin-mobile`
- Search input + chip row in flex column

### Motion
- Card hover: `translateY(-2px)` + shadow enhance
- Card press: `active:scale-[0.98]`
- FAB press: `active:scale-90`
- Filter chip toggle: color swap inline
- Ripple on press: dynamic absolute span with `bg-white/30 rounded-full animate-ping`, removed after 1s
- Tab transition: instant
- Toast enter/exit: slide top + fade 200ms

### Light mode only Phase 1
Same as before — dark mode deferred (Material 3 dark scheme would be Phase 3 polish if Boss requests).

## 9. i18n strategy

- Copy `vi.ts` + `en.ts` từ web (824 keys) sang `dai-long-portal-ios/translations/`
- Reuse hook pattern: `useI18n()` returns `{ t, locale, setLocale }`
- Persist locale qua `expo-secure-store` (replace `localStorage`)
- Default detect device locale, fallback `vi`
- iOS-specific additions in namespace `ios.*` (e.g. `ios.auth.face_id_prompt`, `ios.notification.permission_rationale`)
- Sync flow: when web `vi.ts/en.ts` updated, manual copy + diff merge (Phase 4 may automate)

## 10. Phasing

### Phase 1 (~2 tuần) — Auth + Dealer
**Deliverable:** TestFlight internal build, 5-10 dealer test

**Backend:** migration `20260601000000_ios_app_support.sql` + edge function `send-push` deployed

**Mobile:** 14 screens (auth + dealer + inbox + profile)

**Infrastructure:**
- Apple Developer enrollment confirm (existing for Sen Messenger)
- Bundle ID `ai.dailong.portal` register
- EAS project create + env push (SUPABASE_URL, SUPABASE_ANON_KEY as EXPO_PUBLIC_*)
- TestFlight internal group create at day 1 (`isInternalGroup: true`)
- First build: interactive Apple ID + 2FA for cert generation (Boss once)

### Phase 2 (~1.5 tuần) — Supervisor
**Deliverable:** TestFlight update with supervisor tab

**Mobile:** supervisor/index (dashboard), supervisor/qr, supervisor/team/[id], commission override modal, payout request modal

**Backend:** no changes (RLS covers supervisor scope)

### Phase 3 (~1.5 tuần) — Admin + App Store
**Deliverable:** App Store public listing

**Mobile:** 9 admin routes (orders board, payouts, products, supervisors, upgrade, reports, audit, registrations, AdminConsole)

**Polish:**
- Performance audit (60 FPS scroll, image lazy loading)
- VoiceOver accessibility pass
- App Store assets:
  - Screenshots: 5 sizes (iPhone 6.7"/6.5"/5.5"/iPad Pro 12.9"/11"), 5 screens each
  - App preview video (optional)
  - Description vi + en (max 4000 chars)
  - Keywords (max 100 chars)
  - Privacy policy URL: `https://dailongai.com/chinh-sach-bao-mat`
  - Support URL: `https://dailongai.com/lien-he`

**Apple review:**
- Demo accounts: 1 dealer + 1 supervisor + 1 admin (admin Boss-grade)
- Reviewer notes: B2B affiliate portal for medical device dealers; Sign in with Apple supported; no in-app purchase needed (commissions paid via bank transfer); requires authentication
- Submit category: **Business** (primary) + **Productivity** (secondary)

### Timeline summary
| Week | Phase | Output |
|---|---|---|
| 1 | P1 | Scaffold + auth + dashboard skeleton |
| 2 | P1 | Order/commission/profile + push pipeline → TestFlight |
| 3 | P2 | Supervisor screens → TestFlight v2 |
| 4 | P2/P3 | Polish supervisor + start admin |
| 5 | P3 | Admin screens + assets + submit App Store |
| 6-7 | Review | Apple review (typical 1-3 days, plus iteration) |

## 11. Testing strategy

### Phase 1
- **Manual**: 5-10 dealer test trên TestFlight, daily feedback Telegram
- **Unit**: lib/auth.ts, lib/biometric.ts, lib/notifications.ts (Jest)
- **Integration**: Supabase RLS test (RPC create order from app → verify trigger fires push)
- **E2E**: defer Phase 3 (Maestro or Detox)

### Phase 3
- **Accessibility**: VoiceOver pass critical paths (login, place order, view commission)
- **Performance**: Hermes profiler, scroll 60 FPS, JS bundle < 5MB
- **Network**: airplane mode handling, slow 3G simulation

## 12. Risks + mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Apple reject 4.2 (web wrapper) | Low | High | Visual C native iOS + Face ID + Push + SF Symbols → clear native value |
| Apple reject 4.8 (no Sign in with Apple) | Mitigated | High | P1 ships with Apple OAuth from day 1 |
| Apple email link conflict (same email signed in via Google) | Medium | Medium | Test in P1; build "Link account" flow if conflict |
| Push permission denied | High | Low | App works fine without; inbox tab is fallback |
| Expo SDK breaking change | Low | Medium | Pin SDK 54, no upgrade mid-project |
| EAS build fail | Medium | Low | Apply 5 lessons from `feedback_eas_ios_pitfalls.md` from day 1 |
| First-time Apple Cert generation requires interactive 2FA | Certain | Low | Boss available 1 time at P1 start, document timing |
| TestFlight invite limits | Low | Low | Internal group 100 slots, external 10k — way more than needed |

## 13. Budget

- Apple Developer: $99/year (existing from Sen Messenger)
- Expo EAS: free tier (30 builds/month sufficient)
- Supabase: $0 additional (within current plan, edge function in free tier)
- TestFlight: free
- **Total new cost: $0**

## 14. Open questions for plan phase

- Should we add **app version check** + force-update screen for breaking backend changes?
- Should `dealer-qr.tsx` allow generating native iOS share sheet (vs just copy link)?
- Should Phase 1 include Notification Center grouping (collapsible by category)?
- Apple review: demo video recommended or text instructions sufficient?

## 15. Changelog
- 2026-05-24: Initial design after brainstorming with Boss (visual style C, Expo stack, 3-phase, iOS-only first).
