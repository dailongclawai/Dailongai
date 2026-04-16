# Meo Meo Fullscreen 3D Chatbox — Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Author:** Sen Coder (Claude Code)

## Overview

Transform the existing Meo Meo AI chatbox from a compact floating widget (418px) into an immersive fullscreen experience featuring a 3D VRM avatar with voice responses and real-time lip-sync animation.

## Current State

- **ChatWidget.tsx** (241 lines): Floating widget, bottom-right corner, 418×600px max
- **API**: Cloudflare AI (Llama 3.3 70B) via `/api/chat` Cloudflare Pages Function
- **UI**: Pure CSS/HTML, emoji 🐱 as avatar, dark theme + orange accents
- **Features**: i18n (VI/EN), quick replies, auto lead capture (phone detection → webhook)
- **No 3D**: Chat widget has zero Three.js/Canvas integration (other site components use Three.js)

## Design Decisions

### 1. Trigger: FAB → Fullscreen (replaces widget entirely)

- Clicking the FAB button opens a **fullscreen overlay** (`position: fixed; inset: 0`) instead of the current small chat window
- The old 418px widget is completely replaced — no hybrid mode, no "expand" button
- Close button (✕) top-right returns to the main site

### 2. Layout: Speech Bubble

```
┌─────────────────────────────────┐
│  MEO MEO AI          ● ONLINE ✕ │  ← Top bar
│                                  │
│     ┌──────────────────────┐     │
│     │  Bot response text   │     │  ← Speech bubble (latest reply only)
│     │  in glass bubble     │     │
│     └──────────┬───────────┘     │
│                ▽                 │
│          ┌──────────┐            │
│          │          │            │
│          │  VRM 3D  │            │  ← Avatar Meo .vrm (center)
│          │  Avatar  │            │
│          │          │            │
│          └──────────┘            │
│                                  │
│   [Quick reply] [Quick reply]    │  ← Quick replies (hidden after first msg)
│   [Quick reply] [Quick reply]    │
│                                  │
│  🔊 [  Input field...      ] [↑] │  ← Fixed bottom input + mute + send
└─────────────────────────────────┘
```

- **Speech bubble**: Shows only the latest bot response. Glass-morphism style (`backdrop-filter: blur`, semi-transparent background). Positioned above avatar. Includes a downward-pointing triangle/caret toward avatar.
- **Avatar**: Centered in viewport, no decorative rings. Subtle radial glow behind.
- **Quick replies**: 4 buttons below avatar, above input. Visible only when no conversation has started. Hidden once user sends first message.
- **Input**: Fixed bottom, full-width with max-width constraint (~600px). Includes mute button (left), textarea (center), send button (right).

### 3. 3D Avatar

- **Model**: `/Users/agentopenclaw/Downloads/Avatar Meo .vrm` (17MB, VRM format)
  - Must be copied to `public/assets/` at build time
- **Renderer**: Three.js + `@pixiv/three-vrm` (both already in project dependencies)
- **Scene setup** (adapted from Sen Voice `avatar-three.js`):
  - `WebGLRenderer`: sRGB encoding, ACESFilmic tone mapping, transparent background
  - `PerspectiveCamera`: FOV 30°, auto-framed to avatar bounding box
  - Lighting: HemisphereLight (ambient) + 3 DirectionalLights (key/fill/rim)
  - Canvas: `position: absolute; inset: 0` within the stage container, `pointer-events: none`
- **No rings**: Unlike Sen Voice, no Arc Reactor ring decorations

### 4. Animation (Audio-Driven)

All animation is driven by the TTS audio stream via `AudioAnalyser` (ported from Sen Voice):

**Lip-sync** (5 VRM visemes):
- `aa`: RMS amplitude × 0.55
- `oh`: Bass bins (0-8) × 0.45
- `ou`: Bass bins × 0.25
- `ih`: Highmid bins (32-96) × 0.30
- `ee`: Treble bins (96-256) × 0.25
- Smoothing: fast attack (0.5×), slower release (0.15×)
- Gate threshold: 0.02 RMS (suppress on silence)

**Blink**: Random interval 2.5-6s, close 80ms → hold 50ms → open 120ms

**Breathing**: Spine x-rotation sine wave (0.015 amplitude, 1.4 rad/s)

**Body sway**: Root y-rotation sine wave (0.05 amplitude, 0.35 rad/s)

**Idle state** (no audio playing): Blink + breathing + gentle sway only.
**Speaking state** (TTS audio playing): Full lip-sync + enhanced gestures (arm raise, head nods).

### 5. Voice: OpenAI TTS

- **API**: OpenAI `tts-1` model
- **Endpoint**: New Cloudflare Pages Function `/api/tts`
  - Input: `{ text: string, voice?: string }`
  - Output: Audio blob (MP3/opus)
  - Rate limit: Same as `/api/chat` (20 req/min per IP)
- **Flow**:
  1. `/api/chat` returns text response
  2. Client sends text to `/api/tts`
  3. Audio blob received → create `MediaStream` via Web Audio API
  4. `AudioAnalyser` processes audio → drives VRM lip-sync
  5. Audio plays through user's speakers
- **Voice selection**: Default voice TBD (recommend `nova` or `shimmer` for friendly tone)
- **Mute control**: Toggle button next to input. When muted:
  - TTS request is skipped entirely (saves API cost)
  - Avatar stays in idle animation (blink + breathe only)
  - Text still appears in speech bubble
- **API key**: Stored in Cloudflare Worker environment variable `OPENAI_API_KEY`

### 6. Quick Replies

- 4 preset buttons from existing translation keys (`chat.qr1` through `chat.qr4`)
- Style: Pill-shaped, `bg-orange-500/8`, orange border + text, `rounded-full`
- Behavior: Visible on initial load, hidden after first user message
- Clicking a quick reply sends it as a user message (same flow as typing)

### 7. Backend (Unchanged)

- **Chat AI**: Cloudflare AI Llama 3.3 70B (`/api/chat`) — no changes
- **Lead capture**: Automatic phone detection + webhook to `zalo.longanhai.com/api/web-lead` — no changes
- **Rate limiting**: 20 req/min per IP — no changes

### 8. Chat History

- Only the **latest bot response** is shown in the speech bubble
- Full conversation history is maintained in React state (for API context)
- Last 10 messages sent to `/api/chat` (existing behavior)
- No scrollable message list — this is intentional for the immersive avatar-first experience

## New Files

| File | Purpose |
|------|---------|
| `src/components/MeoChatFullscreen.tsx` | New fullscreen chat component (replaces ChatWidget internals) |
| `src/lib/avatar-scene.ts` | Three.js + VRM avatar scene manager (adapted from Sen Voice) |
| `src/lib/audio-analyser.ts` | Audio FFT analyser for lip-sync (ported from Sen Voice) |
| `functions/api/tts.ts` | Cloudflare Pages Function — proxies OpenAI TTS API |
| `public/assets/avatar-meo.vrm` | VRM model file (copied from Downloads) |

## Modified Files

| File | Changes |
|------|---------|
| `src/components/ChatWidget.tsx` | Refactor: FAB button stays, chat window replaced by MeoChatFullscreen |
| `src/app/layout.tsx` | No changes needed (ChatWidget already mounted globally) |
| `src/app/globals.css` | Add fullscreen overlay styles, speech bubble animation |
| `src/lib/translations.ts` | Add new translation keys for mute button, speaking indicator |
| `wrangler.toml` | Add `OPENAI_API_KEY` binding reference |

## Dependencies

All already in `package.json` — no new npm packages needed:
- `three` (v0.183.2) — 3D rendering
- `@types/three` (v0.183.1) — TypeScript types

New dependency needed:
- `@pixiv/three-vrm` — VRM avatar loading. Currently used in Sen Voice via CDN, needs to be added to package.json for this Next.js project.

## Performance Considerations

- **VRM model (17MB)**: Lazy-load only when user opens chat. Show loading spinner during download.
- **Three.js scene**: Create on first open, destroy on close (free GPU memory).
- **TTS audio**: Fetch after text response, don't block UI. Speech bubble shows text immediately.
- **Canvas rendering**: Use `requestAnimationFrame` with delta-time clamp (0.1s max). Pause RAF loop when chat is closed.
- **Mobile**: VRM at 17MB may be slow on 3G. Consider showing a static fallback image on very slow connections.

## Color Palette

Consistent with existing site design:
- Background: Radial gradient `#1a1020` → `#0a0a12` → `#050508`
- Primary orange: `#f97316` (Tailwind orange-500)
- Speech bubble: `rgba(255,255,255,0.07)` with `backdrop-filter: blur(16px)`
- Input: `rgba(255,255,255,0.06)` with orange border accent
- Text: `rgba(255,255,255,0.9)` primary, `rgba(255,255,255,0.3)` placeholder
- Send button: Gradient `#f97316` → `#ea580c` with glow shadow

## Security

- `OPENAI_API_KEY` stored as Cloudflare Worker secret, never exposed to client
- `/api/tts` endpoint rate-limited (20 req/min per IP) to prevent abuse
- TTS input text length capped (same 2000 char limit as chat)
- No new client-side secrets or API keys
