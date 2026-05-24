# Meo Meo Chat Refactor — Design Spec

**Date:** 2026-05-08
**Owner:** Sen Coder
**Approver:** Boss
**Supersedes:** `2026-04-16-meo-meo-fullscreen-3d-chatbox-design.md`

## Why

Current `MeoChatFullscreen.tsx` (462 lines) is built around a VRM 3D avatar
(Three.js + `@pixiv/three-vrm`) with TTS lip-sync. The avatar drives most of the
component's complexity and bundle weight, and it runs an uncapped 60fps RAF
with no mobile guard or `prefers-reduced-motion` check (memory observation
6114, 2026-05-08). Boss has decided to drop the avatar entirely, modernize the
look, and keep load time fast.

## Scope

### In scope

- Replace `MeoChatFullscreen` with a new `MeoChatPanel` component (responsive
  sheet on mobile, side panel on desktop).
- Remove all VRM / Three.js avatar code paths from the chat surface.
- TTS becomes opt-in per AI message (speaker icon on each bubble).
- Realign the chat visual to the site's Material Design 3 dark + orange
  (`#ff5625`) tokens.
- Update the FAB pill in `ChatWidget.tsx` to drop `MeoAvatarThumb` while
  keeping the two-line "AI Meo Meo / Powered by Do Ngoc Long" tagline.
- Keep the existing 6-minute session limit and expired flow (call-hotline CTA),
  fixing the copy that incorrectly says "3 phút".
- Keep the four quick-reply prompts and the welcome-message timing.

### Out of scope

- Backend APIs (`functions/api/chat.ts`, `chat-stream.ts`, `tts.ts`) — unchanged.
- i18n keys (re-used as-is).
- Voice input (microphone) — not requested.
- Deep redesign of the FAB (only swap the avatar slot for an inline SVG icon).
- Changes to `WelcomePortal.tsx` or `DnaHelix.tsx`, which still use `three`
  and are unrelated.

## Decisions (locked with Boss)

| # | Question | Decision |
|---|----------|----------|
| Q1 | Voice / TTS after dropping the avatar | TTS opt-in: speaker icon per AI bubble; default text-only |
| Q2 | Shape of the chat surface | Responsive — mobile bottom sheet 85vh, desktop side panel 420×100vh |
| Q3 | Visual style | Match site's M3 dark + `#ff5625` tokens; drop purple/crimson gradients and `backdrop-blur` |
| Q4 | FAB after removing avatar thumb | Keep wide pill with two-line tagline; replace thumb with inline sparkle SVG |
| Q5 | Features kept | Session timer + expired overlay; 4 quick replies; branding tagline. Drop ONLINE pill + global mute. |

## Architecture & file changes

### Delete

- `src/components/MeoChatFullscreen.tsx`
- `src/components/MeoAvatarThumb.tsx`
- `src/lib/avatar-scene.ts`
- `public/assets/avatar-meo.vrm`
- `package.json`: remove `@pixiv/three-vrm`

### Keep (verified usage)

- `package.json`: `three` stays — used by `src/components/WelcomePortal.tsx`
  and `src/components/DnaHelix.tsx`.
- `functions/api/chat.ts`, `chat-stream.ts`, `tts.ts` — unchanged.
- All i18n keys: `chat.welcome`, `chat.qr1`, `chat.qr4`, `chat.qr5`, `chat.qr6`,
  `chat.placeholder`, `chat.error`, `chat.disconnect`, `chat.fab_title`,
  `chat.fab_subtitle`.

### Create

- `src/components/MeoChatPanel.tsx` — responsive sheet/panel, target ~280
  lines.

### Modify

- `src/components/ChatWidget.tsx`:
  - Replace dynamic import target: `MeoChatFullscreen` → `MeoChatPanel`.
  - Replace `MeoAvatarThumb` mount with an inline 20px sparkle SVG (no
    additional icon library — match the existing pattern of inline SVGs in
    `MeoChatFullscreen`).
  - Drop the `MeoAvatarThumb` import and the surrounding 48×48 thumbnail
    container.

## UI design

### Layout

| Breakpoint | Shape | Size | Animation | Body lock |
|---|---|---|---|---|
| ≤768px (mobile) | Bottom sheet | 100vw × 85vh | Slide-up 220ms ease-out, drag-handle bar at top, drag-to-dismiss, 30% dim overlay behind | Yes (only while open) |
| >768px (desktop) | Side panel right | 420px × 100vh | Slide-in from right 220ms ease-out, no dim, page remains interactive | No |

`prefers-reduced-motion: reduce` → fade only, no slide; reduce duration to 0ms
for the transform.

### Tokens (M3 Đại Long)

| Element | Token / value |
|---|---|
| Sheet/panel background | `var(--surface-container)` (~#1f2126), solid |
| AI bubble | `var(--surface-container-high)` background, 1px `var(--outline-variant)` border, `var(--on-surface)` text |
| User bubble | `color-mix(in srgb, var(--primary-container) 18%, transparent)` background, 1px `color-mix(... var(--primary) 30%, transparent)` border, `var(--on-surface)` text |
| Send button | solid `var(--primary-container)` (#ff5625), white icon, no glow shadow |
| Quick reply pill | transparent background, 1px `var(--outline-variant)` border, hover fills `color-mix(... var(--primary-container) 8%, transparent)` |
| Drag handle (mobile) | 36×4 rounded pill, `var(--outline-variant)` |

### Typography

| Element | Style |
|---|---|
| Header "AI Meo Meo" | 16px, font-bold, `var(--primary)` |
| Tagline "Powered by Do Ngoc Long" | 10px, font-medium, `color-mix(... var(--on-surface) 60%, transparent)` |
| Message text | 14px, leading-relaxed |
| Timestamp | 10px, on-surface/40, inline with bubble footer |

### Stripped (verify these are absent in `MeoChatPanel`)

- No canvas, no `AvatarScene`, no `@pixiv/three-vrm`, no `three` imports.
- No radial gradient backgrounds (the existing purple/crimson radial is gone).
- No `backdrop-blur` on any element (memory observation 5829, 2026-05-08).
- No `MeoAvatarThumb` reference.
- No "ONLINE" status pill, no green dot.
- No global mute toggle.

### FAB pill (in `ChatWidget.tsx`)

Two-line layout, 200×64 (current dimensions retained):

```
┌─────────────────────────────┐
│ ✨   AI Meo Meo         ●  │   sparkle icon 20px (inline SVG)
│      Powered by DNL          │   tagline gradient (cam → xanh, kept)
└─────────────────────────────┘
```

- Icon: inline SVG sparkle (no `lucide-react` dep).
- Online dot: keep the existing 12px green dot in the top-right corner.
- Hover: `scale-105`, `shadow` using `var(--primary-container)` at low alpha.
- Idle-preload of `MeoChatPanel` bundle via `requestIdleCallback` — keep
  current pattern, retarget the dynamic import.

## Behavior

### TTS opt-in

- Each AI bubble renders a speaker button (14px) in its footer next to the
  timestamp.
  - Idle: `Volume2` icon, on-surface/40.
  - Playing: `VolumeX` icon, primary color; click toggles stop.
- Click triggers `POST /api/tts`, then plays the returned MP3 via a single
  reusable `Audio` element on the panel.
- Only one bubble plays at a time. Clicking a different bubble's speaker stops
  the previous audio.
- No `AudioContext.decodeAudioData`, no `attachAudioStream`, no lip-sync —
  all of that goes away with the avatar.
- The persistent `Audio` element pattern (created once on mount, re-used) is
  retained from the current implementation to avoid mobile autoplay quirks.

### Session timer + expired flow

- `SESSION_MAX_SEC = 6 * 60` (unchanged).
- Countdown counter shows only when `timeLeft <= 30`.
- Expired overlay: same CTA (call hotline `0935 999 922` + close button).
- **Copy fix**: change "Phiên chat miễn phí tối đa **3 phút**" →
  "**6 phút**" in the Vietnamese expired message so it matches code.

### Quick replies

- Visible when `messages.length <= 1 && !busy`. Hidden after first send.
- Four buttons sourced from i18n: `chat.qr1`, `chat.qr4`, `chat.qr5`, `chat.qr6`
  (matches current set).
- Click → `handleSend(text)`.

### Welcome message

- Same 400ms timeout pattern. Re-keyed when `locale` changes.

### Improvements over current code

- `AbortController` for `/api/chat` fetches: aborted when the panel closes
  mid-request, preventing setState-on-unmounted leaks.
- `prefers-reduced-motion` honored for slide-in / pulse animations.
- Network error path: error bubble + "Thử lại" button (currently just shows a
  disconnect message with no retry).

## Data flow

1. User clicks FAB → `setOpen(true)` in `ChatWidget`.
2. `ChatWidget` mounts `MeoChatPanel` (dynamic import already preloaded).
3. `MeoChatPanel` mounts: starts session timer, locks body scroll on mobile
   only, schedules welcome message, creates persistent `Audio` element.
4. User types / clicks quick reply → `handleSend`:
   - append user bubble, clear quick replies, set busy
   - `POST /api/chat` with last 10 messages + `X-Chat-Session` header
   - on response: append AI bubble, set idle. TTS does **not** auto-play.
5. User clicks speaker on an AI bubble → `playTTS(bubbleId, text)`:
   - stop any in-flight audio, fetch `/api/tts`, play.
6. User closes panel → unmount, abort in-flight fetches, restore body scroll.
7. Session timer hits 0 → `setExpired(true)` → overlay covers panel content.

## Edge cases

| Case | Behavior |
|---|---|
| API returns `code: 'session_expired'` or `'daily_limit'` | Show server `error` text in an AI bubble, set expired |
| Network failure (`fetch` throws) | Append disconnect bubble + "Thử lại" button; clicking it re-sends the last user message |
| User closes panel mid-request | Abort fetch, no state update |
| TTS fetch fails or returns < 1KB | Reset speaker icon to idle; no error toast (silent) |
| User clicks a second speaker while another is playing | Stop the first, start the second |
| Locale switches mid-conversation | Welcome bubble re-keys (existing behavior); other messages stay |
| Long message (>2KB) | Bubble wraps, max-width 80%, normal scroll |
| Markdown / line breaks in AI reply | `sanitizeHtml(content.replace(/\n/g, '<br/>'))` (unchanged) |

## Performance budgets

| Metric | Target |
|---|---|
| Bundle delta | −150 KB gzip (dropping `@pixiv/three-vrm` and `avatar-scene.ts` parsing) |
| `MeoChatPanel` open TTI | <100ms (no canvas init, no model fetch) |
| INP (mobile) | <200ms (aligned with `project_dailongai_inp_baseline.md`) |
| RAF usage | None — no animation loops; only CSS transitions |

## Testing

### Unit (vitest + jsdom — `tests/unit/`)

- New file: `tests/unit/meo-chat-panel.test.tsx`.
- Empty state renders welcome bubble after 400ms and the four quick replies.
- Sending a message hides quick replies and appends user bubble.
- Mocked `/api/chat` response appends an AI bubble.
- Speaker icon toggles `Volume2` ↔ `VolumeX` on click; only one plays.
- Session timer reaches 0 → expired overlay visible.
- Closing the panel mid-request aborts the fetch (assert
  `signal.aborted === true`).

### E2E (Playwright — `tests/e2e/`)

- Extend `tests/e2e/critical-paths.spec.ts` with a chat-panel scenario, or
  add `tests/e2e/meo-chat.spec.ts` if the existing file is already crowded.
- Click FAB, panel slides in (desktop) / sheet slides up (mobile), send a
  quick reply, get a response bubble (mocked or live API per existing
  pattern), close panel.
- Reduced-motion test: emulate `prefers-reduced-motion: reduce`, assert no
  transform animation timing.

### Performance

- Run `lighthouserc.cjs` before/after on the home page; record bundle size
  and INP for the PR description.

## Migration plan

Single PR, no feature flag (per CLAUDE.md "no speculative features"):

1. Create `MeoChatPanel.tsx`.
2. Re-wire `ChatWidget.tsx` to import `MeoChatPanel` and drop
   `MeoAvatarThumb`.
3. Delete `MeoChatFullscreen.tsx`, `MeoAvatarThumb.tsx`, `avatar-scene.ts`,
   `public/assets/avatar-meo.vrm`.
4. Remove `@pixiv/three-vrm` from `package.json`; run `npm install` to
   regenerate `package-lock.json`.
5. Run `tsc --noEmit`, vitest, playwright suite locally; build with
   `next build` to confirm bundle size delta.
6. Manual smoke: open FAB on mobile and desktop viewports, send messages,
   trigger expired overlay, click TTS, close panel mid-request.
7. Boss-authorized deploy via `wrangler pages deploy out` (per
   `project_dailongai_deploy.md`).

## Open verification (during implementation)

- Confirm no other component imports `MeoAvatarThumb` or `avatar-scene` (grep
  performed during brainstorm; re-grep before delete).
- Confirm no other component imports `@pixiv/three-vrm` (grep already showed
  only `avatar-scene.ts`).
