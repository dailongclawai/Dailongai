# Meo Meo Fullscreen 3D Chatbox — Implementation Plan

**Date:** 2026-04-16
**Design Spec:** `docs/superpowers/specs/2026-04-16-meo-meo-fullscreen-3d-chatbox-design.md`

## Phase 0: Setup & Dependencies

### Tasks
1. **Install @pixiv/three-vrm** — `npm install @pixiv/three-vrm` in dai-long-landing project
2. **Copy Avatar Meo VRM** — Copy `/Users/agentopenclaw/Downloads/Avatar Meo .vrm` → `public/assets/avatar-meo.vrm`
3. **Add OPENAI_API_KEY to wrangler.toml** — Add `vars` section for TTS API key (use `wrangler secret put` for production)
4. **Add `.superpowers/` to .gitignore** if not already present

### Documentation References
- `package.json` (line 1-32): Current deps — `three@^0.183.2` already present, `@pixiv/three-vrm` missing
- `wrangler.toml` (line 1-7): Current Cloudflare config, `[ai]` binding exists

### Verification
- [ ] `npm ls @pixiv/three-vrm` shows installed version
- [ ] `ls public/assets/avatar-meo.vrm` exists (17MB)
- [ ] `wrangler.toml` has OPENAI_API_KEY reference

---

## Phase 1: Audio Analyser Module

### Tasks
1. **Create `src/lib/audio-analyser.ts`** — TypeScript port of Sen Voice `audio-analyser.js`
   - Copy pattern from: `/Users/agentopenclaw/sen-voice/web/js/audio-analyser.js` (64 lines)
   - Add TypeScript types: `AudioAnalyserResult = { rms: number; bins: [number, number, number, number] }`
   - Class: `AudioAnalyser` with methods: `attachStream(mediaStream)`, `detach()`, `sample(): AudioAnalyserResult`
   - FFT size: 512, smoothing: 0.7
   - Frequency buckets: bass [0-8], lowmid [8-32], highmid [32-96], treble [96-256]

### Documentation References
- Source: `/Users/agentopenclaw/sen-voice/web/js/audio-analyser.js` — exact API to replicate
- Safari AudioContext suspension handling pattern from `avatar-three.js` line 130-140

### Anti-Pattern Guards
- Do NOT use `new AudioContext()` without checking `webkitAudioContext` fallback
- Do NOT forget `ctx.resume()` for Safari suspended state

### Verification
- [ ] File compiles with `tsc --noEmit`
- [ ] Export: `AudioAnalyser` class with `attachStream`, `detach`, `sample` methods

---

## Phase 2: Avatar Scene Module

### Tasks
1. **Create `src/lib/avatar-scene.ts`** — TypeScript port of Sen Voice `avatar-three.js`
   - Copy pattern from: `/Users/agentopenclaw/sen-voice/web/js/avatar-three.js` (296 lines)
   - Use dynamic import pattern from existing components (see DnaHelix.tsx)
   - Class: `AvatarScene` with:
     - `constructor(canvas: HTMLCanvasElement)` — WebGLRenderer (sRGB, ACESFilmic, alpha:true), Scene, PerspectiveCamera (FOV 30), 3 DirectionalLights + HemisphereLight
     - `async load(url: string)` — GLTFLoader + VRMLoaderPlugin, VRMUtils.rotateVRM0, frustumCulled=false, A-pose correction, camera auto-frame via bounding box
     - `attachAudio(mediaStream: MediaStream)` — Connect AudioAnalyser, resume suspended ctx
     - `start()` — requestAnimationFrame loop with delta-time clamp (0.1s max)
     - `dispose()` — Cancel RAF, disconnect audio, dispose renderer/scene
   - Animation per frame:
     - `_updateLipSync(dt)` — 5 visemes (aa/oh/ou/ih/ee) from audio FFT
     - `_updateBlink(dt)` — Random 2.5-6s interval, 80ms close + 50ms hold + 120ms open
     - Procedural gestures: root sway (0.05 + spk*0.03), Y bob (0.008), arm raise on speak, head nod, spine breathing (1.4 rad/s)
   - Import `AudioAnalyser` from `./audio-analyser`

### Documentation References
- Avatar scene: `/Users/agentopenclaw/sen-voice/web/js/avatar-three.js` (full file, 296 lines)
- Three.js in Next.js pattern: `/Users/agentopenclaw/Downloads/dai-long-landing/src/components/DnaHelix.tsx`
  - Dynamic import, useRef, ResizeObserver, cleanup pattern
- VRM loading: Sen Voice `index.html` lines 2195-2230 (boot sequence)
- Import paths: `three` (npm), `three/addons/loaders/GLTFLoader.js`, `@pixiv/three-vrm`

### Anti-Pattern Guards
- Do NOT import Three.js at top-level (SSR will crash) — use dynamic `import('three')` or ensure `"use client"` + lazy load
- Do NOT forget `vrm.scene.traverse(obj => { obj.frustumCulled = false })` — avatar disappears on arm swing
- Do NOT skip `VRMUtils.rotateVRM0(vrm)` — avatar faces wrong direction
- Do NOT forget `vrm.update(dt)` at end of frame — expressions won't apply

### Verification
- [ ] File compiles with `tsc --noEmit`
- [ ] Exports: `AvatarScene` class
- [ ] All Three.js imports resolve (dynamic import pattern)

---

## Phase 3: TTS API Endpoint

### Tasks
1. **Create `functions/api/tts.ts`** — Cloudflare Pages Function to proxy OpenAI TTS
   - Follow exact pattern from `functions/api/chat.ts`:
     - Export `onRequestPost(context)`
     - Extract `env.OPENAI_API_KEY`
     - Rate limit: reuse same `checkRateLimit` pattern (20 req/min per IP)
   - Request: `{ text: string, voice?: string }`
   - Validate: text required, max 2000 chars
   - Call OpenAI API: `POST https://api.openai.com/v1/audio/speech`
     - Model: `tts-1`
     - Voice: default `nova` (or from request)
     - Input: text
     - Response format: `mp3`
   - Return: Audio blob with `Content-Type: audio/mpeg`
   - Error handling: 400 (bad input), 429 (rate limit), 500 (OpenAI error)

### Documentation References
- Cloudflare Pages Function pattern: `/Users/agentopenclaw/Downloads/dai-long-landing/functions/api/chat.ts`
  - `onRequestPost(context)` signature
  - Rate limit implementation (in-memory Map)
  - `context.waitUntil()` pattern
- OpenAI TTS API: `POST https://api.openai.com/v1/audio/speech` with `model`, `input`, `voice`, `response_format`

### Anti-Pattern Guards
- Do NOT expose OPENAI_API_KEY to client — server-side only
- Do NOT skip rate limiting — TTS is expensive
- Do NOT buffer entire audio in Worker memory for large texts — stream if possible

### Verification
- [ ] `curl -X POST http://localhost:8788/api/tts -H 'Content-Type: application/json' -d '{"text":"Xin chào"}' --output test.mp3`
- [ ] test.mp3 plays with Vietnamese voice
- [ ] Rate limit returns 429 after 20 rapid requests

---

## Phase 4: Fullscreen Chat Component

### Tasks
1. **Create `src/components/MeoChatFullscreen.tsx`** — New fullscreen chat UI
   - `"use client"` directive
   - Props: `{ onClose: () => void }`
   - Layout: `position: fixed; inset: 0; z-index: 60`
   - Background: `radial-gradient(ellipse at center, #1a1020 0%, #0a0a12 60%, #050508 100%)`
   - Structure (top to bottom):
     - **Top bar**: "MEO MEO AI" + ONLINE badge + close button (✕)
     - **Speech bubble**: Latest assistant message only, glass-morphism (`backdrop-filter: blur(16px)`, `bg-white/7`), downward caret pointing to avatar. Shows audio wave indicator when speaking.
     - **Canvas container**: `<canvas>` for AvatarScene, centered, `pointer-events: none`
     - **Quick replies**: 4 i18n buttons, visible only when `messages.length <= 1`, positioned above input
     - **Bottom input**: Gradient fade background, mute button (🔊/🔇), textarea, send button (↑). Max-width 600px centered.
   - State: Reuse existing ChatWidget state pattern (`messages`, `input`, `busy`, `showQR`, `muted`)
   - API flow:
     1. User sends message → `POST /api/chat` → receive text
     2. Text shown in speech bubble immediately
     3. If not muted: `POST /api/tts` with text → receive audio blob
     4. Create `MediaStream` from audio blob via Web Audio API (`createMediaElementSource` or `decodeAudioData`)
     5. Attach to `AvatarScene.attachAudio(stream)` for lip-sync
     6. Play audio through speakers
   - Audio playback:
     - `AudioContext.decodeAudioData(blob)` → `AudioBufferSourceNode` → play
     - Create `MediaStreamDestination` → feed to `AudioAnalyser` for lip-sync
     - On audio ended → avatar returns to idle (blink + breathe only)
   - AvatarScene lifecycle:
     - Initialize on mount: create `AvatarScene(canvas)`, `await load('/assets/avatar-meo.vrm')`, `start()`
     - Dispose on unmount: `scene.dispose()` to free GPU

2. **Add translations to `src/lib/translations.ts`**:
   - `chat.mute`: "Tắt tiếng" / "Mute"
   - `chat.unmute`: "Bật tiếng" / "Unmute"
   - `chat.speaking`: "Đang nói..." / "Speaking..."
   - `chat.loading_avatar`: "Đang tải avatar..." / "Loading avatar..."

3. **Add CSS to `src/app/globals.css`**:
   - `@keyframes wave` for audio wave indicator bars
   - Speech bubble entrance animation
   - Fullscreen overlay transition

### Documentation References
- ChatWidget state/API pattern: `/Users/agentopenclaw/Downloads/dai-long-landing/src/components/ChatWidget.tsx` (full file)
- i18n key structure: `/Users/agentopenclaw/Downloads/dai-long-landing/src/lib/translations.ts`
- Three.js cleanup in React: DnaHelix.tsx pattern (useEffect return → cancelAnimationFrame + dispose)
- Web Audio API: `AudioContext.decodeAudioData()` → `AudioBufferSourceNode.start()`
- MediaStream for analyser: `AudioContext.createMediaStreamDestination()` → `destination.stream`

### Anti-Pattern Guards
- Do NOT forget to dispose AvatarScene on component unmount — GPU memory leak
- Do NOT call TTS when muted — waste API cost
- Do NOT block UI while loading VRM — show loading indicator, render text chat immediately
- Do NOT use `dangerouslySetInnerHTML` for speech bubble (keep using `sanitizeHtml` from existing code)

### Verification
- [ ] Fullscreen opens when triggered
- [ ] Speech bubble shows latest bot response
- [ ] Avatar loads and displays with idle animation (blink + breathe)
- [ ] TTS plays audio and avatar lip-syncs
- [ ] Mute button stops TTS, avatar stays idle
- [ ] Close button returns to main site
- [ ] Quick replies visible initially, hidden after first message

---

## Phase 5: Integration — Modify ChatWidget

### Tasks
1. **Modify `src/components/ChatWidget.tsx`**:
   - Keep FAB button exactly as-is (same design, same position)
   - Replace chat window with `<MeoChatFullscreen>` when `open === true`
   - Remove the old chat window JSX (header, messages, input, etc.)
   - Keep: `open` state, `setOpen` toggle
   - Move to MeoChatFullscreen: messages state, input state, busy state, handleSend, API call logic
   - Result: ChatWidget becomes a thin wrapper — FAB + conditional fullscreen render
   - Import `MeoChatFullscreen` dynamically: `const MeoChatFullscreen = dynamic(() => import('./MeoChatFullscreen'), { ssr: false })` — prevents Three.js SSR crash

2. **Ensure lead capture still works** — `/api/chat` endpoint unchanged, phone detection logic untouched

### Documentation References
- Current ChatWidget: `/Users/agentopenclaw/Downloads/dai-long-landing/src/components/ChatWidget.tsx`
- Next.js dynamic import: `import dynamic from 'next/dynamic'` with `{ ssr: false }`

### Anti-Pattern Guards
- Do NOT break FAB button styling or position
- Do NOT change `/api/chat` endpoint or lead capture logic
- Do NOT remove i18n support — MeoChatFullscreen must use `useI18n()`

### Verification
- [ ] FAB button appears on all pages (unchanged)
- [ ] Click FAB → fullscreen opens (not old widget)
- [ ] Close fullscreen → FAB reappears
- [ ] Chat + TTS + avatar work end-to-end
- [ ] Lead capture still fires on phone number detection
- [ ] `npm run build` succeeds without errors

---

## Phase 6: Final Verification & Polish

### Tasks
1. **Run full build**: `npm run build` — ensure no TypeScript or build errors
2. **Test on dev server**: `npm run dev` → open browser → test complete flow:
   - Open chat → avatar loads → type question → get response → hear TTS → see lip-sync
   - Mute → send message → no audio, text shows in bubble
   - Quick replies work on first load
   - Close and reopen → state resets properly
3. **Mobile test**: Resize browser to mobile width → verify layout doesn't break
4. **Performance check**: 
   - VRM loads with spinner (not blank screen)
   - Avatar disposes properly on close (no GPU leak)
   - No console errors or warnings
5. **Lead capture test**: Type a Vietnamese phone number in chat → verify webhook fires (check network tab)

### Verification
- [ ] `npm run build` passes
- [ ] Full chat + TTS + avatar flow works
- [ ] Mobile layout acceptable
- [ ] No console errors
- [ ] Lead capture functional
- [ ] Mute/unmute works correctly
