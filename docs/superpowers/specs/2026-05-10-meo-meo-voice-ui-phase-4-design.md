# Meo Meo Voice — UI Phase 4 (mic pill + hybrid voice mode)

**Date:** 2026-05-10
**Owner:** Boss (agentopenclaw)
**Author:** Sen Coder
**Status:** Approved for implementation planning
**Related specs:** `2026-04-20-meo-meo-voice-design.md` (backend), `2026-05-08-meo-meo-chat-refactor-design.md` (panel refactor)

## 1. Goal

Wire the customer-facing voice entry point into `MeoChatPanel.tsx` on dailongai.com. Users see a clearly-labeled CTA pill ("🎙️ Nói chuyện với Meo") above the chat input. Tapping it opens a hybrid voice mode (compact orb + live transcript) that connects to the existing Gemini 3.1 Flash Live agent on VPS via LiveKit Cloud.

Boss's complaint: existing TTS playback icon `🔊` (per-message replay) was not enough — there was no way for a customer to start a voice CALL, and any icon that existed was visually unclear. This spec adds the missing CTA + voice session UI.

## 2. Non-goals

- Native phone (PSTN/SIP) integration — out of scope, web-only
- Voice in any locale other than Vietnamese — agent persona is VN-only
- Voice in admin/Sen Voice flows — Sen Voice has its own Arc Core UI at voice.dailongai.com
- New backend agent capabilities (tools, persona) — already shipped Phase 1-3
- Replacing the existing per-message `🔊` TTS playback button — kept as-is

## 3. Decisions (from brainstorm 2026-05-10)

| Area | Decision |
|---|---|
| Entry pattern | **B — Primary CTA pill** (ChatGPT/Claude voice mode style). Above input, full-width, gradient cam Đại Long, with text label "🎙️ Nói chuyện với Meo". Reasons: highest discoverability, has explicit label, matches Đại Long brand color. |
| Voice mode layout | **3 — Hybrid split**: compact orb at top, live transcript pane below, controls in header (back/timer/hangup) and footer (mute mic / mute speaker). |
| Live transcript scope | **Full** — backend pushes transcript events realtime through LiveKit data channel; frontend streams them as they arrive. Worth ~1 day extra backend work for accessibility (deaf users can read) and richer UX. |
| Brand color | Use existing `--primary` (`#ffb5a0`) and `--primary-container` (`#ff5625`). Orb is `radial-gradient(circle at 30% 30%, #ffb5a0, #ff5625 60%)` with shadow `0 0 36px rgba(255,86,37,0.7)`. |
| Hangup placement | Header right (red pill button "⏹ Tắt"). Mute toggles in footer. |
| End-of-call behavior | Transcript items merge into `messages` array (role-mapped) and panel returns to text mode. User can scroll back, replay individual Meo turns via existing `🔊` button. |
| Feature flag | Read `VOICE_PHASE` env via existing pattern (mirror token endpoint). `disabled` → pill hidden. `canary` → 10% IP bucket; rest hidden. `full` → always shown. Also hide if `navigator.mediaDevices` missing. |

## 4. Architecture & data flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (dailongai.com)                                        │
│                                                                 │
│  MeoChatPanel.tsx                                               │
│  ├─ TextMode (current chat UI, unchanged)                       │
│  └─ VoiceMode (NEW)                                             │
│      ├─ MeoVoiceConnection.ts ── LiveKit Room (audio + data)   │
│      └─ TranscriptStream listener                              │
└──────────────────────────────────────┬──────────────────────────┘
       │ POST /api/voice-token         │ data channel
       ▼                                ▼
┌───────────────────────┐  ┌───────────────────────────────────────┐
│ CF Pages function      │  │  LiveKit Cloud SGP                    │
│ voice-token.ts (kept)  │  │  wss://ai-meo-meo-flugypuj.livekit.cloud │
└───────────────────────┘  └───────────────────────┬───────────────┘
                                                   │ join room
                                                   ▼
                            ┌─────────────────────────────────────────┐
                            │  VPS 180.93.1.115 (systemd)             │
                            │  /opt/meo-meo-voice/agent.py            │
                            │  └─ Gemini 3.1 Flash Live (just upgraded) │
                            │  └─ data_channel.publish_transcript()    │
                            │     ▲ NEW: per-turn user STT + Meo response │
                            └─────────────────────────────────────────┘
```

**Voice mode lifecycle:**

1. User taps pill → `POST /api/voice-token` (existing rate limit 10/min/IP, TTL 30 min)
2. Frontend receives `{token, url, room}` → `livekit-client` connects room
3. Browser native prompt: mic permission
4. Audio track publishes → LiveKit Cloud → agent VPS joins same room → Gemini stream
5. **NEW backend behavior**: agent publishes 2 event kinds via `data_channel.publish_data`:
   - `{type: "transcript", role: "user", text: "<STT>"}`
   - `{type: "transcript", role: "meo", text: "<response>"}`
   - `{type: "state", value: "listening" | "speaking" | "thinking"}` (drives orb animation)
6. Frontend listens `RoomEvent.DataReceived` → appends to in-memory `transcript[]` and updates orb state
7. User taps "Tắt" → disconnect → transcript items merged into `messages` (role mapping: `user` → `user`, `meo` → `assistant`) → return to text mode
8. Per-message `🔊` TTS playback still works for any merged Meo turn

## 5. Components

### Frontend (dai-long-landing)

| File | Status | Responsibility |
|---|---|---|
| `package.json` | EDIT | Add dep `livekit-client` (~latest stable matching server version) |
| `src/components/MeoChatPanel.tsx` | EDIT | New state `mode: 'text' \| 'voice'`. When `voice`: render `<MeoVoicePanel>` instead of input area + log. On end: merge `transcript[]` into `messages`, switch back to `text`. |
| `src/components/MeoVoicePill.tsx` | NEW (~30 lines) | CTA pill. Hidden if feature flag disabled, mic API unavailable, or canary bucket excludes user IP. |
| `src/components/MeoVoicePanel.tsx` | NEW (~200 lines) | Hybrid split UI (orb + live transcript + controls). Subscribes to `MeoVoiceConnection` callbacks. |
| `src/lib/meo-voice-connection.ts` | NEW (~150 lines) | LiveKit Room wrapper. Methods: `connect(token, url, room)`, `disconnect()`, `setMicMuted(b)`, `setSpeakerMuted(b)`. Callbacks: `onState(state)`, `onTranscript(role, text)`, `onError(err)`, `onDuration(seconds)`. Owns audio element lifecycle (cleanup on disconnect — Sen Voice lessons #5 #6). |
| `functions/api/voice-token.ts` | KEEP | Already exists, unchanged. |
| `tests/unit/meo-voice-pill.test.tsx` | NEW | Feature-flag conditional rendering, click handler. |
| `tests/unit/meo-voice-panel.test.tsx` | NEW | State machine drives orb/transcript correctly with mocked connection. |
| `tests/unit/meo-voice-panel-error.test.tsx` | NEW | Mic-deny and 429-rate-limit error UIs. |
| `tests/unit/meo-chat-panel.test.tsx` | EDIT | Extend with transcript-merge case after end-of-call. |

### Backend (meo-meo-voice on VPS, /opt/meo-meo-voice)

| File | Status | Responsibility |
|---|---|---|
| `data_channel.py` | EDIT | Add `publish_transcript(role: str, text: str)` and `publish_state(state: Literal["listening","speaking","thinking"])` helpers wrapping existing `publish_data`. |
| `agent.py` | EDIT | In `_on_transcription` (already exists, line 91), call `data_channel.publish_transcript("user", text)`. Add `agent_state_changed` listener (or equivalent) to call `publish_transcript("meo", text)` on Meo response and `publish_state(...)` on listening/speaking. |
| `tests/test_data_channel.py` | NEW | Mock `room.local_participant.publish_data` → assert payload schema. |
| `tests/test_agent_transcription.py` | NEW | Mock event → assert `publish_transcript("user", txt)` called once. |

### State machine (frontend voice mode)

```
idle ─[click pill]─> connecting ─[room joined + agent participant]─> active ─[hangup]─> ended ─> back to text
                          │                                              │
                          └─[mic denied / token error / connect timeout]─> error ─[retry/close]─> idle
                                                                          │
                                                                          └─[8-min cap reached]─> ended (auto)
```

## 6. Visual states (orb + caption)

| State | Orb | Caption |
|---|---|---|
| `connecting` | static gradient + spinning ring overlay | "Cấp quyền micro để bắt đầu" / "Đang kết nối..." |
| `listening` | gentle pulse (1.6s ease-in-out) | "Đang lắng nghe..." |
| `speaking` (Meo) | stronger pulse + waveform bars under orb | "Meo đang nói..." |
| `thinking` (tool call) | dim pulse | "Meo đang xem..." (filler phrase) |
| `error` | red border, no animation | error-specific message |

Animation kept simple — pure CSS keyframes, no canvas/WebGL. Prior Sen Voice lesson: avoid `createMediaStreamSource` for visualization (Safari steal audio path) — use LiveKit `ActiveSpeakersChanged` event for orb pulse intensity instead.

## 7. Error handling

| Condition | UI behavior |
|---|---|
| `VOICE_PHASE=disabled` | Pill hidden entirely. No regression to text chat. |
| `VOICE_PHASE=canary` + IP not in 10% bucket | Pill hidden. |
| `navigator.mediaDevices` unavailable | Pill hidden. |
| Mic permission denied | State `error`, message: *"Cần quyền micro để gọi voice. Cấp quyền trong Settings → Privacy → Microphone"* + back-to-chat button. |
| `POST /api/voice-token` → 429 | Toast: *"Anh chị đã gọi quá nhiều lần. Thử lại sau 1 phút"*. Return idle. |
| `POST /api/voice-token` → 503 (`VOICE_MAINTENANCE=1`) | Pill disabled with tooltip: *"Voice đang bảo trì"*. |
| LiveKit connect timeout (>10s) | State `error`: *"Không kết nối được Meo. Thử lại?"* |
| Agent disconnect mid-call | State `error`: *"Mất kết nối Meo. Thử gọi lại nhé"*. Transcript-so-far merged into messages anyway. |
| 8-min session cap reached (server-side enforced via existing agent guard) | Frontend reacts to disconnect event, shows popup: *"Cuộc gọi đã đạt giới hạn 8 phút. Anh chị tiếp tục bằng chat hoặc gọi lại?"* |
| User closes widget mid-call | Force `disconnect()`, abort token request, cleanup audio elements. |
| Tab visibility hidden | Keep connection alive (voice ≠ video). Resume audio playback on focus. |
| Text request inflight when pill tapped | `abortRef.current.abort()` on text request before mode switch. |
| Data-channel transcript event miss | Best-effort, no retry. TTS playback button on each Meo turn provides fallback for replay. |

## 8. Testing

### Unit (frontend, Vitest)

- `meo-voice-pill.test.tsx`: feature-flag conditional render, click handler.
- `meo-voice-panel.test.tsx`: drive states `idle → connecting → active → ended` via mocked connection. Assert orb class change per state, transcript items append in order, controls fire correct callbacks.
- `meo-voice-panel-error.test.tsx`: mic-deny path, 429 path.
- `meo-chat-panel.test.tsx` (extend): end-of-call → transcript merged into `messages`, role mapping correct, TTS button visible on each Meo turn.

### Unit (backend, pytest)

- `tests/test_data_channel.py`: mock `room.local_participant.publish_data` → assert `publish_transcript` payload `{type:"transcript", role, text}` and `publish_state` payload `{type:"state", value}`.
- `tests/test_agent_transcription.py`: simulate `_on_transcription` event → assert `publish_transcript("user", txt)` called once.

### E2E (manual, Boss)

1. Open dailongai.com `?voice=1` (force enable bypass canary bucket).
2. Tap pill "🎙️ Nói chuyện với Meo".
3. Allow mic.
4. Say: *"Cho hỏi giá máy bao nhiêu?"* — expect orb pulse, transcript shows both turns, Meo answers "29.5 triệu".
5. Tap "Tắt" — back to text panel; transcript merged into messages.
6. Verify Supabase `voice_transcripts` row exists with full session.
7. Mic-deny path: deny prompt → expect proper error UI.
8. 8-min cap path: temporarily set cap to 30s, verify popup fires.

### Smoke pre-deploy

- `pnpm test` (Vitest unit suite) green.
- `pnpm build` clean (lint + tsc OK).
- `pnpm tsc --noEmit` zero errors.
- VPS: `python -m pytest tests/test_data_channel.py tests/test_agent_transcription.py` green.
- Restart VPS service, verify `out.log` shows `data_channel: publish_transcript role=...`.

## 9. Risks & open questions

- **Gemini 3.1 transcript event timing**: agent.py currently subscribes to `user_input_transcribed` event. Need to verify Gemini Live SDK fires equivalent event for *Meo's* response text in real-time (not just post-session). If not, fall back to splitting Meo response into chunks via Gemini transcription delta events. Verify in implementation phase before wiring.
- **livekit-client bundle size**: ~80–100 kB gzipped. Acceptable for dailongai.com but lazy-load by importing only when pill is tapped (dynamic import) — same pattern `MeoChatPanel` already uses.
- **8-min cap UX**: Boss may want soft warning at 7:00 ("còn 1 phút"). Defer to implementation if simple; otherwise out of scope.
- **Transcript persistence after end-of-call**: merging into `messages` means if user closes widget, transcript is lost (not stored in localStorage). Backend already persists in `voice_transcripts` Supabase. Acceptable — same as text chat behavior.

## 10. Rollout

Phase 4 ships under existing canary mechanism — `VOICE_PHASE` gate already in place. Plan:

1. Implement + tests on `feature/meo-voice-phase4-ui` branch.
2. Deploy to Pages preview, Boss tests pill flow + voice round-trip.
3. Merge to `main`. `VOICE_PHASE=canary` already set — feature live for 10% IPs immediately.
4. Watch metrics for 24-48h: session count, error rate, mic-deny rate.
5. If stable: bump `VOICE_PHASE=full` (existing flag flip, no code change).
