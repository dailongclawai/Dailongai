# Meo Meo Voice — Phase 4 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire customer-facing pill button "Nói chuyện với Meo" + hybrid split voice mode (compact orb + live transcript) into `MeoChatPanel.tsx`, with backend transcript streaming through LiveKit data channel.

**Architecture:** Frontend adds 3 new files (`MeoVoicePill.tsx`, `MeoVoicePanel.tsx`, `meo-voice-connection.ts`) and modifies `MeoChatPanel.tsx` for mode switch. Backend modifies `data_channel.py` and `agent.py` on VPS to publish realtime transcript + state events through LiveKit data channel. Voice mode UI is a state machine (idle → connecting → active → ended/error) driven by connection callbacks.

**Tech Stack:** Next.js (custom fork per repo's `AGENTS.md`), React 18, TypeScript, Vitest, `livekit-client` (NEW frontend dep), Python 3.10, `livekit-agents` 1.5.4, `livekit-plugins-google`, pytest.

**Spec:** `docs/superpowers/specs/2026-05-10-meo-meo-voice-ui-phase-4-design.md`

---

## Task 0: Pre-flight verification (no code changes)

**Goal:** De-risk Section 9 open question — confirm Gemini 3.1 Flash Live SDK fires a per-turn event for Meo's *response* text we can use for live transcript publish, and confirm `livekit-client` browser version compat with server `livekit-agents` 1.5.4.

**Files:**
- Read only: `/Users/agentopenclaw/meo-meo-voice/agent.py`, `/Users/agentopenclaw/meo-meo-voice/venv/lib/python3.10/site-packages/livekit/plugins/google/realtime/realtime_api.py` (or equivalent), `https://www.npmjs.com/package/livekit-client` (latest)

- [ ] **Step 1: Inspect Gemini Live event hooks for Meo's response text**

Run:
```bash
ssh root@180.93.1.115 'grep -nE "agent_speech|speech_committed|agent_state|speech_finalized|response_finalized|conversation_item" /opt/meo-meo-voice/venv/lib/python3.10/site-packages/livekit/plugins/google/realtime/*.py /opt/meo-meo-voice/venv/lib/python3.10/site-packages/livekit/agents/voice/agent_session.py 2>/dev/null | head -30'
```
Expected: at least one event among `agent_speech_committed`, `conversation_item_added`, or `agent_speech_finalized`. Note the exact name + signature.

If nothing found, fall back: hook `session.on("agent_state_changed")` (already proven exists per agent.py history) and use the new `session.history` chat ctx to read latest assistant message after each `value=listening` transition.

- [ ] **Step 2: Verify `livekit-client` latest npm version**

Run:
```bash
curl -s https://registry.npmjs.org/livekit-client/latest | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version'))"
```
Expected: a 2.x version. Record it for Task 4 (e.g. `2.5.7`). Server is `livekit-agents 1.5.4` running protocol 17 — any 2.x client is compatible.

- [ ] **Step 3: Confirm `voice-token.ts` payload contract matches what frontend expects**

Run:
```bash
grep -nE "token|url|room|identity" /Users/agentopenclaw/Downloads/dai-long-landing/functions/api/voice-token.ts | head -10
```
Expected: response shape `{ token, url, room, identity }` per the file's top doc-comment (lines 1-13).

- [ ] **Step 4: Read `node_modules/next/dist/docs/` index for any breaking-change notes affecting client components**

Run:
```bash
ls /Users/agentopenclaw/Downloads/dai-long-landing/node_modules/next/dist/docs/ 2>/dev/null | head -20
```
If a docs dir exists, skim files referencing `'use client'`, `dynamic`, `Server Components`. Otherwise rely on existing `MeoChatPanel.tsx` patterns (which uses `'use client'` and `next/dynamic` already).

- [ ] **Step 5: Record findings inline in spec Section 9 risk row, then commit**

Open the spec, replace the Gemini-event-timing risk with the verified event name. No commit needed if `docs/superpowers/` is gitignored (as confirmed in dai-long-landing); just save and move on.

---

## Task 1: Backend — `data_channel.py` add transcript & state helpers

**Goal:** Add two thin helpers wrapping the existing `publish_data` so the agent code becomes declarative.

**Files:**
- Modify: `/Users/agentopenclaw/meo-meo-voice/data_channel.py`
- Test: `/Users/agentopenclaw/meo-meo-voice/tests/test_data_channel_publish.py` (NEW)

- [ ] **Step 1: Write failing test for `publish_transcript`**

Create `/Users/agentopenclaw/meo-meo-voice/tests/test_data_channel_publish.py`:

```python
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest

from data_channel import MeoDataChannel


@pytest.mark.asyncio
async def test_publish_transcript_emits_correct_payload():
    room = SimpleNamespace(local_participant=SimpleNamespace(publish_data=AsyncMock()))
    chan = MeoDataChannel(room=room)

    await chan.publish_transcript("user", "Cho hỏi giá máy")

    assert room.local_participant.publish_data.await_count == 1
    args, kwargs = room.local_participant.publish_data.await_args
    payload_bytes = args[0] if args else kwargs.get("payload") or kwargs.get("data")
    payload = json.loads(payload_bytes.decode("utf-8") if isinstance(payload_bytes, bytes) else payload_bytes)
    assert payload == {"type": "transcript", "role": "user", "text": "Cho hỏi giá máy"}


@pytest.mark.asyncio
async def test_publish_state_emits_correct_payload():
    room = SimpleNamespace(local_participant=SimpleNamespace(publish_data=AsyncMock()))
    chan = MeoDataChannel(room=room)

    await chan.publish_state("listening")

    payload_bytes = room.local_participant.publish_data.await_args[0][0]
    payload = json.loads(payload_bytes.decode("utf-8") if isinstance(payload_bytes, bytes) else payload_bytes)
    assert payload == {"type": "state", "value": "listening"}


@pytest.mark.asyncio
async def test_publish_state_rejects_invalid_value():
    room = SimpleNamespace(local_participant=SimpleNamespace(publish_data=AsyncMock()))
    chan = MeoDataChannel(room=room)

    with pytest.raises(ValueError, match="invalid state"):
        await chan.publish_state("bogus")
```

- [ ] **Step 2: Run tests — expect failure**

```bash
ssh root@180.93.1.115 'cd /opt/meo-meo-voice && venv/bin/python -m pytest tests/test_data_channel_publish.py -v'
```
Expected: 3 FAILS — `MeoDataChannel` may exist but `publish_transcript`/`publish_state` methods do not.

(If `MeoDataChannel` class doesn't exist either, the test file imports a function-style API. Inspect `data_channel.py` first via `cat`, adapt the test to the existing class/function name, and keep the same assertions.)

- [ ] **Step 3: Implement helpers in `data_channel.py`**

Inspect current file first:
```bash
ssh root@180.93.1.115 'cat /opt/meo-meo-voice/data_channel.py | head -80'
```

Inside the existing `MeoDataChannel` class (or whatever wraps the `room` reference), add:

```python
import json
from typing import Literal

VALID_STATES = ("listening", "speaking", "thinking")
VALID_ROLES = ("user", "meo")


class MeoDataChannel:
    # ... existing fields & methods ...

    async def publish_transcript(self, role: str, text: str) -> None:
        if role not in VALID_ROLES:
            raise ValueError(f"invalid role: {role!r}")
        payload = json.dumps({"type": "transcript", "role": role, "text": text}).encode("utf-8")
        try:
            await self.room.local_participant.publish_data(payload, reliable=True)
        except Exception as e:
            log.warning("publish_transcript failed: %s", e)

    async def publish_state(self, value: Literal["listening", "speaking", "thinking"]) -> None:
        if value not in VALID_STATES:
            raise ValueError(f"invalid state: {value!r}")
        payload = json.dumps({"type": "state", "value": value}).encode("utf-8")
        try:
            await self.room.local_participant.publish_data(payload, reliable=True)
        except Exception as e:
            log.warning("publish_state failed: %s", e)
```

If the existing `publish_data` call has a different signature (no `reliable` kw, or different positional first arg), copy that call's exact pattern instead of the snippet above — see `data_channel.py:65`.

- [ ] **Step 4: Run tests — expect pass**

```bash
ssh root@180.93.1.115 'cd /opt/meo-meo-voice && venv/bin/python -m pytest tests/test_data_channel_publish.py -v'
```
Expected: 3 PASSED.

- [ ] **Step 5: Commit**

```bash
ssh root@180.93.1.115 'cd /opt/meo-meo-voice && git add data_channel.py tests/test_data_channel_publish.py && git commit -m "feat(meo-voice): publish_transcript and publish_state helpers

Wraps room.local_participant.publish_data with JSON envelope
{type, role, text} or {type, value} so agent.py can stay declarative."'
```
(If `/opt/meo-meo-voice/` is not git-tracked, skip git commit and instead write to `~/backups/data_channel.py.bak-<timestamp>` before edit.)

---

## Task 2: Backend — wire `agent.py` to publish transcripts and states

**Goal:** Hook `_on_transcription` (existing user STT listener at `agent.py:91`) to publish user role, and add Meo-response listener + state-change listener that publish through the channel.

**Files:**
- Modify: `/Users/agentopenclaw/meo-meo-voice/agent.py`
- Test: `/Users/agentopenclaw/meo-meo-voice/tests/test_agent_publish.py` (NEW)

- [ ] **Step 1: Write failing test for transcription wiring**

Create `tests/test_agent_publish.py`:

```python
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
import pytest


@pytest.mark.asyncio
async def test_on_transcription_publishes_user_role(monkeypatch):
    """When a user STT event fires, agent must publish a transcript event with role='user'."""
    import agent as agent_mod

    fake_chan = MagicMock()
    fake_chan.publish_transcript = AsyncMock()

    captured = {}

    def fake_session_on(event_name, handler):
        captured[event_name] = handler

    fake_session = MagicMock()
    fake_session.on = fake_session_on

    fake_userdata = SimpleNamespace(metrics=MagicMock())

    # call the wiring helper that should exist after this task
    agent_mod.attach_voice_publishers(fake_session, fake_chan, fake_userdata)

    assert "user_input_transcribed" in captured
    handler = captured["user_input_transcribed"]
    ev = SimpleNamespace(transcript="Cho hỏi giá máy")
    handler(ev)

    # publisher is async-fire-and-forget; allow it to schedule
    import asyncio
    await asyncio.sleep(0)
    fake_chan.publish_transcript.assert_awaited_with("user", "Cho hỏi giá máy")
```

- [ ] **Step 2: Run test — expect failure**

```bash
ssh root@180.93.1.115 'cd /opt/meo-meo-voice && venv/bin/python -m pytest tests/test_agent_publish.py -v'
```
Expected: FAIL — `attach_voice_publishers` not defined.

- [ ] **Step 3: Refactor agent.py — extract wiring into `attach_voice_publishers`**

In `agent.py` (around line 90 — current `_on_transcription` block), replace the inline wiring with a function that's testable. Inspect existing first:
```bash
ssh root@180.93.1.115 'sed -n "85,150p" /opt/meo-meo-voice/agent.py'
```

Add (or move existing logic into) a module-level function:

```python
import asyncio
import logging

log = logging.getLogger(__name__)


def attach_voice_publishers(session, data_chan, userdata):
    """Wire LiveKit/Gemini events to MeoDataChannel publishers.

    - user_input_transcribed → publish_transcript("user", txt) + extract phone for lead capture
    - agent_state_changed     → publish_state(listening|speaking|thinking)
    - agent_speech_committed (or fallback session.history walk) → publish_transcript("meo", txt)
    """

    def _fire(coro):
        # fire-and-forget; agents loop is running so create_task is safe
        try:
            asyncio.get_event_loop().create_task(coro)
        except RuntimeError:
            log.warning("no running loop for fire-and-forget publish")

    def _on_user_transcription(ev) -> None:
        try:
            txt = (getattr(ev, "transcript", "") or "").strip()
            if not txt:
                return
            userdata.metrics.append_turn("USER", txt)
            _fire(data_chan.publish_transcript("user", txt))
        except Exception as e:
            log.warning("_on_user_transcription: %s", e)

    session.on("user_input_transcribed", _on_user_transcription)

    # State events drive the orb animation on the web client.
    GEMINI_TO_UI_STATE = {"listening": "listening", "thinking": "thinking", "speaking": "speaking"}

    def _on_state(ev) -> None:
        try:
            value = getattr(ev, "value", None) or getattr(ev, "state", None)
            ui_state = GEMINI_TO_UI_STATE.get(str(value))
            if ui_state:
                _fire(data_chan.publish_state(ui_state))
        except Exception as e:
            log.warning("_on_state: %s", e)

    session.on("agent_state_changed", _on_state)

    # Meo response transcript — use whichever event Task 0 step 1 found.
    # Replace event name below with the verified one.
    MEO_RESPONSE_EVENT = "agent_speech_committed"  # ← swap if Task 0 found a different name

    def _on_meo_speech(ev) -> None:
        try:
            txt = (
                getattr(ev, "text", None)
                or getattr(ev, "transcript", None)
                or (getattr(ev, "item", None) and getattr(ev.item, "text_content", None))
                or ""
            )
            txt = (txt or "").strip()
            if not txt:
                return
            userdata.metrics.append_turn("MEO", txt)
            _fire(data_chan.publish_transcript("meo", txt))
        except Exception as e:
            log.warning("_on_meo_speech: %s", e)

    session.on(MEO_RESPONSE_EVENT, _on_meo_speech)
```

Then in the existing `entrypoint(...)` function, replace the old `_on_transcription` registration with a single call:

```python
# Existing line ~144 was:
#     session.on("user_input_transcribed", _on_transcription)
# Replace that whole block + helper with:
attach_voice_publishers(session, data_chan, userdata)
```

(`data_chan` must be the `MeoDataChannel` instance already constructed in entrypoint. If it's named differently in current code, use that name.)

- [ ] **Step 4: Run test — expect pass**

```bash
ssh root@180.93.1.115 'cd /opt/meo-meo-voice && venv/bin/python -m pytest tests/test_agent_publish.py -v'
```
Expected: 1 PASSED.

- [ ] **Step 5: Run full backend test suite — expect all pre-existing tests still pass**

```bash
ssh root@180.93.1.115 'cd /opt/meo-meo-voice && venv/bin/python -m pytest -q'
```
Expected: zero new failures. If a pre-existing test breaks because it referenced the now-deleted inline `_on_transcription`, update it to call `attach_voice_publishers` instead.

- [ ] **Step 6: Commit**

```bash
ssh root@180.93.1.115 'cd /opt/meo-meo-voice && git add agent.py tests/test_agent_publish.py && git commit -m "feat(meo-voice): publish transcripts + state through data channel

Refactor _on_transcription into attach_voice_publishers for testability.
Wire user STT, agent_state_changed, and Meo speech-committed events to
MeoDataChannel so web client can render orb + live transcript."'
```

---

## Task 3: Backend — deploy & smoke-test on VPS

**Goal:** Restart the systemd service, watch logs for the new publish events.

**Files:** none (deployment only)

- [ ] **Step 1: Backup current `.env` (no env changes needed, just hygiene)**

```bash
ssh root@180.93.1.115 'cp /opt/meo-meo-voice/.env /opt/meo-meo-voice/.env.bak-phase4-$(date +%Y%m%d-%H%M%S)'
```

- [ ] **Step 2: Restart service**

```bash
ssh root@180.93.1.115 'systemctl restart meo-meo-voice && sleep 5 && systemctl status meo-meo-voice --no-pager | head -8'
```
Expected: `active (running)`, `Memory:` ~120-200M (fresh process), no `Failed`.

- [ ] **Step 3: Tail log, confirm clean boot**

```bash
ssh root@180.93.1.115 'tail -30 /var/log/meo-meo-voice/out.log'
```
Expected: `starting worker version 1.5.4`, `plugin registered livekit.plugins.google 1.5.4`, `registered worker`, **0 ERROR**. The `attach_voice_publishers` registration itself is silent — no log line until first room joins.

- [ ] **Step 4: Trigger one round-trip via existing test page (or Boss-test from any voice-enabled URL)**

Open `https://dailongai.com/?voice=1` in browser, tap pill (won't exist yet — Task 6 builds it). For Task 3 we use the lower-level smoke: an already-paired room from Phase 1-3 testing.

Alternative quick smoke without UI:
```bash
ssh root@180.93.1.115 '/opt/meo-meo-voice/venv/bin/python -c "
import asyncio, json
from livekit import api
async def main():
    # Just verify our new module imports cleanly inside the venv
    from data_channel import MeoDataChannel
    import agent
    assert hasattr(agent, \"attach_voice_publishers\")
    print(\"IMPORTS_OK\")
asyncio.run(main())"'
```
Expected: `IMPORTS_OK`.

Full E2E happens at Task 9 once the frontend exists.

- [ ] **Step 5: Commit deploy note (skip if no separate ops repo)**

If `/opt/meo-meo-voice/` has git, no extra commit needed (Tasks 1-2 already committed). Otherwise note in a daily log file.

---

## Task 4: Frontend — install `livekit-client` and lazy-import wrapper

**Goal:** Add the dependency without inflating the main bundle. Only load it when voice mode opens.

**Files:**
- Modify: `/Users/agentopenclaw/Downloads/dai-long-landing/package.json`
- Modify: `/Users/agentopenclaw/Downloads/dai-long-landing/pnpm-lock.yaml` (auto)

- [ ] **Step 1: Install `livekit-client` at the version Task 0 Step 2 captured**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
pnpm add livekit-client@<VERSION_FROM_TASK_0>
```
(Replace `<VERSION_FROM_TASK_0>` with the exact version, e.g. `2.5.7`. Pin exact, do not use `^`, to match the repo's existing dep style — verify by running `grep '"livekit"' package.json` if needed.)

Expected: package.json gains the dep, pnpm-lock.yaml updated, no install errors.

- [ ] **Step 2: Verify type re-export available**

```bash
node -e "console.log(Object.keys(require('livekit-client')).slice(0, 10))"
```
Expected: prints names like `Room`, `RoomEvent`, `RemoteParticipant`, etc.

- [ ] **Step 3: Confirm no SSR breakage**

Run:
```bash
pnpm build 2>&1 | tail -30
```
Expected: build succeeds, no error mentioning `livekit-client` or `window`/`navigator` on server. (We aren't importing it anywhere yet, so it shouldn't appear; this is a baseline check.)

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add livekit-client for Meo voice phase 4"
```

---

## Task 5: Frontend — `meo-voice-connection.ts` LiveKit wrapper

**Goal:** Create a small framework-agnostic class that owns the LiveKit Room lifecycle and exposes typed callbacks the React components can consume.

**Files:**
- Create: `/Users/agentopenclaw/Downloads/dai-long-landing/src/lib/meo-voice-connection.ts`
- Create: `/Users/agentopenclaw/Downloads/dai-long-landing/tests/unit/meo-voice-connection.test.ts`

- [ ] **Step 1: Write failing test for state transitions and transcript callback**

`tests/unit/meo-voice-connection.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll mock livekit-client so the unit test doesn't open WebSockets.
const mockRoom = {
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  localParticipant: {
    setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
  },
};

vi.mock('livekit-client', () => ({
  Room: vi.fn().mockImplementation(() => mockRoom),
  RoomEvent: {
    Connected: 'connected',
    Disconnected: 'disconnected',
    DataReceived: 'data_received',
    TrackSubscribed: 'track_subscribed',
    TrackUnsubscribed: 'track_unsubscribed',
    ActiveSpeakersChanged: 'active_speakers_changed',
  },
  Track: { Source: { Microphone: 'microphone' } },
}));

import { MeoVoiceConnection } from '@/lib/meo-voice-connection';

describe('MeoVoiceConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions idle → connecting → active when connect succeeds and room emits Connected', async () => {
    const onState = vi.fn();
    const conn = new MeoVoiceConnection({ onState });

    const promise = conn.connect({ token: 'fake', url: 'wss://x', room: 'r' });
    expect(onState).toHaveBeenCalledWith('connecting');

    await promise;
    // simulate Connected event
    const connectedHandler = mockRoom.on.mock.calls.find((c) => c[0] === 'connected')?.[1];
    connectedHandler?.();
    expect(onState).toHaveBeenCalledWith('active');
  });

  it('parses transcript events from data channel and forwards to onTranscript', async () => {
    const onTranscript = vi.fn();
    const conn = new MeoVoiceConnection({ onTranscript });
    await conn.connect({ token: 'fake', url: 'wss://x', room: 'r' });

    const dataHandler = mockRoom.on.mock.calls.find((c) => c[0] === 'data_received')?.[1];
    const payload = new TextEncoder().encode(
      JSON.stringify({ type: 'transcript', role: 'meo', text: 'Dạ giá 29.5 triệu' })
    );
    dataHandler?.(payload, { identity: 'meo-agent' });

    expect(onTranscript).toHaveBeenCalledWith('meo', 'Dạ giá 29.5 triệu');
  });

  it('parses state events and forwards to onState', async () => {
    const onState = vi.fn();
    const conn = new MeoVoiceConnection({ onState });
    await conn.connect({ token: 'fake', url: 'wss://x', room: 'r' });

    const dataHandler = mockRoom.on.mock.calls.find((c) => c[0] === 'data_received')?.[1];
    const payload = new TextEncoder().encode(
      JSON.stringify({ type: 'state', value: 'speaking' })
    );
    dataHandler?.(payload, { identity: 'meo-agent' });

    expect(onState).toHaveBeenCalledWith('speaking');
  });

  it('disconnect transitions to ended and calls room.disconnect', async () => {
    const onState = vi.fn();
    const conn = new MeoVoiceConnection({ onState });
    await conn.connect({ token: 'fake', url: 'wss://x', room: 'r' });

    await conn.disconnect();
    expect(mockRoom.disconnect).toHaveBeenCalled();
    expect(onState).toHaveBeenCalledWith('ended');
  });

  it('cleans up audio elements on TrackUnsubscribed (no duplicate audio)', async () => {
    const conn = new MeoVoiceConnection({});
    await conn.connect({ token: 'fake', url: 'wss://x', room: 'r' });

    const fakeEl = { remove: vi.fn() };
    const fakeTrack = {
      kind: 'audio',
      attach: vi.fn().mockReturnValue(fakeEl),
      detach: vi.fn().mockReturnValue([fakeEl]),
    };

    const subHandler = mockRoom.on.mock.calls.find((c) => c[0] === 'track_subscribed')?.[1];
    subHandler?.(fakeTrack, {}, { identity: 'meo-agent' });

    const unsubHandler = mockRoom.on.mock.calls.find((c) => c[0] === 'track_unsubscribed')?.[1];
    unsubHandler?.(fakeTrack);

    expect(fakeTrack.detach).toHaveBeenCalled();
    expect(fakeEl.remove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
pnpm vitest run tests/unit/meo-voice-connection.test.ts
```
Expected: FAIL — module `@/lib/meo-voice-connection` not found.

- [ ] **Step 3: Implement `meo-voice-connection.ts`**

Create `src/lib/meo-voice-connection.ts`:

```typescript
import {
  Room,
  RoomEvent,
  Track,
  type DataPacket_Kind,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Participant,
} from 'livekit-client';

export type VoiceState = 'idle' | 'connecting' | 'active' | 'ended' | 'error';
export type TranscriptRole = 'user' | 'meo';
export type AgentState = 'listening' | 'speaking' | 'thinking';

export type VoiceErrorKind =
  | 'mic_denied'
  | 'token_rate_limited'
  | 'token_unavailable'
  | 'connect_timeout'
  | 'agent_disconnected'
  | 'session_cap'
  | 'unknown';

export interface VoiceError {
  kind: VoiceErrorKind;
  message: string;
}

export interface ConnectArgs {
  token: string;
  url: string;
  room: string;
}

export interface MeoVoiceConnectionOpts {
  onState?: (s: VoiceState | AgentState) => void;
  onTranscript?: (role: TranscriptRole, text: string) => void;
  onError?: (err: VoiceError) => void;
  onDuration?: (seconds: number) => void;
  onActiveSpeakerLevel?: (level: number) => void;
}

export class MeoVoiceConnection {
  private room: Room | null = null;
  private opts: MeoVoiceConnectionOpts;
  private attachedEls = new Set<HTMLMediaElement>();
  private startedAt = 0;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private state: VoiceState = 'idle';

  constructor(opts: MeoVoiceConnectionOpts = {}) {
    this.opts = opts;
  }

  async connect(args: ConnectArgs): Promise<void> {
    this.transitionTo('connecting');
    this.room = new Room({ adaptiveStream: true, dynacast: true });

    this.room.on(RoomEvent.Connected, this.handleConnected);
    this.room.on(RoomEvent.Disconnected, this.handleDisconnected);
    this.room.on(RoomEvent.DataReceived, this.handleData);
    this.room.on(RoomEvent.TrackSubscribed, this.handleTrackSubscribed);
    this.room.on(RoomEvent.TrackUnsubscribed, this.handleTrackUnsubscribed);
    this.room.on(RoomEvent.ActiveSpeakersChanged, this.handleSpeakers);

    try {
      await this.room.connect(args.url, args.token);
      await this.room.localParticipant.setMicrophoneEnabled(true);
    } catch (e) {
      this.opts.onError?.({
        kind: e instanceof Error && e.name === 'NotAllowedError' ? 'mic_denied' : 'connect_timeout',
        message: e instanceof Error ? e.message : 'connection failed',
      });
      this.transitionTo('error');
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    if (this.durationTimer) { clearInterval(this.durationTimer); this.durationTimer = null; }
    this.attachedEls.forEach((el) => el.remove());
    this.attachedEls.clear();
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    this.transitionTo('ended');
  }

  async setMicMuted(muted: boolean): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(!muted);
  }

  setSpeakerMuted(muted: boolean): void {
    this.attachedEls.forEach((el) => { (el as HTMLAudioElement).muted = muted; });
  }

  private transitionTo(s: VoiceState) {
    this.state = s;
    this.opts.onState?.(s);
  }

  private handleConnected = () => {
    this.startedAt = Date.now();
    this.durationTimer = setInterval(() => {
      this.opts.onDuration?.(Math.floor((Date.now() - this.startedAt) / 1000));
    }, 1000);
    this.transitionTo('active');
  };

  private handleDisconnected = (reason?: unknown) => {
    if (this.state !== 'ended') {
      this.opts.onError?.({
        kind: 'agent_disconnected',
        message: typeof reason === 'string' ? reason : 'disconnected',
      });
      this.transitionTo('error');
    }
  };

  private handleData = (payload: Uint8Array, _participant?: RemoteParticipant) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload)) as
        | { type: 'transcript'; role: TranscriptRole; text: string }
        | { type: 'state'; value: AgentState };
      if (msg.type === 'transcript') {
        this.opts.onTranscript?.(msg.role, msg.text);
      } else if (msg.type === 'state') {
        this.opts.onState?.(msg.value);
      }
    } catch {
      // ignore malformed packets — best-effort per spec
    }
  };

  private handleTrackSubscribed = (
    track: RemoteTrack,
    _pub: RemoteTrackPublication,
    _participant: RemoteParticipant,
  ) => {
    if (track.kind === 'audio') {
      const el = track.attach();
      el.setAttribute('data-meo-voice', 'true');
      document.body.appendChild(el);
      this.attachedEls.add(el);
    }
  };

  private handleTrackUnsubscribed = (track: RemoteTrack) => {
    if (track.kind !== 'audio') return;
    const els = track.detach();
    els.forEach((el) => {
      el.remove();
      this.attachedEls.delete(el);
    });
  };

  private handleSpeakers = (speakers: Participant[]) => {
    const meo = speakers.find((s) => s.identity?.includes('meo') || s.identity?.includes('agent'));
    this.opts.onActiveSpeakerLevel?.(meo?.audioLevel ?? 0);
  };
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm vitest run tests/unit/meo-voice-connection.test.ts
```
Expected: 5 PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meo-voice-connection.ts tests/unit/meo-voice-connection.test.ts
git commit -m "feat(meo-voice): MeoVoiceConnection LiveKit wrapper

Owns Room lifecycle, parses data-channel transcript/state events,
manages audio element attach/detach (per Sen Voice lessons #5-6)."
```

---

## Task 6: Frontend — `MeoVoicePill.tsx` CTA component

**Goal:** Render the gradient-cam pill above the input. Conditionally hide based on feature flag and mic capability.

**Files:**
- Create: `/Users/agentopenclaw/Downloads/dai-long-landing/src/components/MeoVoicePill.tsx`
- Create: `/Users/agentopenclaw/Downloads/dai-long-landing/tests/unit/meo-voice-pill.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/unit/meo-voice-pill.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MeoVoicePill } from '@/components/MeoVoicePill';

describe('MeoVoicePill', () => {
  it('renders when phase=full and mic API available', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    render(<MeoVoicePill phase="full" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /Nói chuyện với Meo/i })).toBeInTheDocument();
  });

  it('returns null when phase=disabled', () => {
    const { container } = render(<MeoVoicePill phase="disabled" onClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when mic API missing', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const { container } = render(<MeoVoicePill phase="full" onClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('fires onClick handler', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    const onClick = vi.fn();
    render(<MeoVoicePill phase="full" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Nói chuyện với Meo/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm vitest run tests/unit/meo-voice-pill.test.tsx
```
Expected: FAIL — module `@/components/MeoVoicePill` not found.

- [ ] **Step 3: Implement `MeoVoicePill.tsx`**

`src/components/MeoVoicePill.tsx`:

```tsx
'use client';

import type { CSSProperties } from 'react';

export type VoicePhase = 'disabled' | 'canary' | 'full' | 'maintenance';

interface Props {
  phase: VoicePhase;
  onClick: () => void;
  disabled?: boolean;
}

const pillStyle: CSSProperties = {
  width: '100%',
  background: 'linear-gradient(135deg, #ff7a4a, #ff5625)',
  border: 'none',
  color: 'white',
  padding: '11px 14px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  boxShadow: '0 4px 14px rgba(255,86,37,0.45)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

export function MeoVoicePill({ phase, onClick, disabled }: Props) {
  if (phase === 'disabled') return null;
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return null;

  const isMaintenance = phase === 'maintenance';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isMaintenance}
      aria-label="Nói chuyện với Meo qua giọng nói"
      title={isMaintenance ? 'Voice đang bảo trì' : undefined}
      style={{
        ...pillStyle,
        opacity: disabled || isMaintenance ? 0.55 : 1,
        cursor: disabled || isMaintenance ? 'not-allowed' : 'pointer',
      }}
    >
      <span aria-hidden style={{ fontSize: 15 }}>🎙️</span>
      Nói chuyện với Meo
    </button>
  );
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
pnpm vitest run tests/unit/meo-voice-pill.test.tsx
```
Expected: 4 PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/components/MeoVoicePill.tsx tests/unit/meo-voice-pill.test.tsx
git commit -m "feat(meo-voice): MeoVoicePill CTA button

Brand-gradient pill (cam Đại Long) with feature-flag and mic-API
capability gating. Disabled state for VOICE_MAINTENANCE."
```

---

## Task 7: Frontend — `MeoVoicePanel.tsx` hybrid voice mode UI

**Goal:** Header + orb + transcript + footer controls. State machine driven by `MeoVoiceConnection` callbacks.

**Files:**
- Create: `/Users/agentopenclaw/Downloads/dai-long-landing/src/components/MeoVoicePanel.tsx`
- Create: `/Users/agentopenclaw/Downloads/dai-long-landing/tests/unit/meo-voice-panel.test.tsx`
- Create: `/Users/agentopenclaw/Downloads/dai-long-landing/tests/unit/meo-voice-panel-error.test.tsx`

- [ ] **Step 1: Write failing tests for state machine and rendering**

`tests/unit/meo-voice-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const fakeConnect = vi.fn().mockResolvedValue(undefined);
const fakeDisconnect = vi.fn().mockResolvedValue(undefined);
let cbHook: any = null;

vi.mock('@/lib/meo-voice-connection', () => ({
  MeoVoiceConnection: vi.fn().mockImplementation((opts) => {
    cbHook = opts;
    return { connect: fakeConnect, disconnect: fakeDisconnect, setMicMuted: vi.fn(), setSpeakerMuted: vi.fn() };
  }),
}));

import { MeoVoicePanel } from '@/components/MeoVoicePanel';

describe('MeoVoicePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cbHook = null;
  });

  it('shows "Đang kết nối..." in connecting state', async () => {
    render(<MeoVoicePanel onClose={() => {}} onComplete={() => {}} />);
    act(() => cbHook.onState('connecting'));
    expect(screen.getByText(/Đang kết nối/i)).toBeInTheDocument();
  });

  it('renders transcript items in order with correct role labels', async () => {
    render(<MeoVoicePanel onClose={() => {}} onComplete={() => {}} />);
    act(() => cbHook.onState('active'));
    act(() => cbHook.onTranscript('user', 'Cho hỏi giá máy'));
    act(() => cbHook.onTranscript('meo', 'Dạ giá 29.5 triệu'));

    const items = screen.getAllByTestId('transcript-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/Anh:/);
    expect(items[0]).toHaveTextContent(/Cho hỏi giá máy/);
    expect(items[1]).toHaveTextContent(/Meo:/);
    expect(items[1]).toHaveTextContent(/Dạ giá 29.5 triệu/);
  });

  it('shows duration timer in mm:ss format', async () => {
    render(<MeoVoicePanel onClose={() => {}} onComplete={() => {}} />);
    act(() => cbHook.onState('active'));
    act(() => cbHook.onDuration(83));
    expect(screen.getByText(/1:23/)).toBeInTheDocument();
  });

  it('orb has data-state attribute matching agent state', async () => {
    render(<MeoVoicePanel onClose={() => {}} onComplete={() => {}} />);
    act(() => cbHook.onState('active'));
    act(() => cbHook.onState('speaking'));
    expect(screen.getByTestId('voice-orb')).toHaveAttribute('data-state', 'speaking');
  });

  it('hangup button calls disconnect and onComplete with merged transcript', async () => {
    const onComplete = vi.fn();
    render(<MeoVoicePanel onClose={() => {}} onComplete={onComplete} />);
    act(() => cbHook.onState('active'));
    act(() => cbHook.onTranscript('user', 'hi'));
    act(() => cbHook.onTranscript('meo', 'em chào'));

    const btn = screen.getByRole('button', { name: /Tắt|hangup/i });
    await act(async () => { btn.click(); });

    expect(fakeDisconnect).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith([
      { role: 'user', text: 'hi' },
      { role: 'meo', text: 'em chào' },
    ]);
  });
});
```

`tests/unit/meo-voice-panel-error.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

let cbHook: any = null;
vi.mock('@/lib/meo-voice-connection', () => ({
  MeoVoiceConnection: vi.fn().mockImplementation((opts) => {
    cbHook = opts;
    return { connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn().mockResolvedValue(undefined), setMicMuted: vi.fn(), setSpeakerMuted: vi.fn() };
  }),
}));

import { MeoVoicePanel } from '@/components/MeoVoicePanel';

describe('MeoVoicePanel error states', () => {
  it('shows mic-denied message when error kind is mic_denied', () => {
    render(<MeoVoicePanel onClose={() => {}} onComplete={() => {}} />);
    act(() => cbHook.onError({ kind: 'mic_denied', message: '' }));
    expect(screen.getByText(/Cần quyền micro/i)).toBeInTheDocument();
  });

  it('shows rate-limit toast when error kind is token_rate_limited', () => {
    render(<MeoVoicePanel onClose={() => {}} onComplete={() => {}} />);
    act(() => cbHook.onError({ kind: 'token_rate_limited', message: '' }));
    expect(screen.getByText(/quá nhiều lần/i)).toBeInTheDocument();
  });

  it('shows generic disconnect message when error kind is agent_disconnected', () => {
    render(<MeoVoicePanel onClose={() => {}} onComplete={() => {}} />);
    act(() => cbHook.onError({ kind: 'agent_disconnected', message: '' }));
    expect(screen.getByText(/Mất kết nối Meo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run tests/unit/meo-voice-panel.test.tsx tests/unit/meo-voice-panel-error.test.tsx
```
Expected: FAIL — module `@/components/MeoVoicePanel` not found.

- [ ] **Step 3: Implement `MeoVoicePanel.tsx`**

`src/components/MeoVoicePanel.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MeoVoiceConnection,
  type AgentState,
  type TranscriptRole,
  type VoiceError,
  type VoiceState,
} from '@/lib/meo-voice-connection';

export interface TranscriptItem {
  role: TranscriptRole;
  text: string;
}

interface Props {
  onClose: () => void;
  onComplete: (transcript: TranscriptItem[]) => void;
}

type UiState = VoiceState | AgentState;

const stateCaption: Record<UiState, string> = {
  idle: '',
  connecting: 'Đang kết nối…',
  active: 'Đã kết nối',
  ended: '',
  error: '',
  listening: 'Đang lắng nghe…',
  speaking: 'Meo đang nói…',
  thinking: 'Meo đang xem…',
};

const errorCopy: Record<VoiceError['kind'], string> = {
  mic_denied: 'Cần quyền micro để gọi voice. Cấp quyền trong Settings → Privacy → Microphone, sau đó thử lại.',
  token_rate_limited: 'Anh chị đã gọi quá nhiều lần. Thử lại sau 1 phút.',
  token_unavailable: 'Voice đang bảo trì. Vui lòng dùng chat hoặc thử lại sau.',
  connect_timeout: 'Không kết nối được Meo. Thử lại?',
  agent_disconnected: 'Mất kết nối Meo. Thử gọi lại nhé.',
  session_cap: 'Cuộc gọi đã đạt giới hạn 8 phút. Anh chị tiếp tục bằng chat hoặc gọi lại?',
  unknown: 'Có lỗi. Thử lại sau nhé.',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MeoVoicePanel({ onClose, onComplete }: Props) {
  const [uiState, setUiState] = useState<UiState>('connecting');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<VoiceError | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const transcriptStateRef = useRef<TranscriptItem[]>([]);

  const connection = useMemo(
    () =>
      new MeoVoiceConnection({
        onState: (s) => setUiState(s),
        onTranscript: (role, text) => {
          setTranscript((prev) => {
            const next = [...prev, { role, text }];
            transcriptStateRef.current = next;
            return next;
          });
        },
        onDuration: (s) => setDuration(s),
        onError: (err) => setError(err),
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/voice-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.status === 429) {
          setError({ kind: 'token_rate_limited', message: '' });
          return;
        }
        if (res.status === 503) {
          setError({ kind: 'token_unavailable', message: '' });
          return;
        }
        if (!res.ok) {
          setError({ kind: 'unknown', message: `token ${res.status}` });
          return;
        }
        const { token, url, room } = (await res.json()) as { token: string; url: string; room: string };
        if (cancelled) return;
        await connection.connect({ token, url, room });
      } catch (e) {
        if (!cancelled) setError({ kind: 'unknown', message: e instanceof Error ? e.message : 'connect failed' });
      }
    })();
    return () => {
      cancelled = true;
      connection.disconnect();
    };
  }, [connection]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleHangup = async () => {
    await connection.disconnect();
    onComplete(transcriptStateRef.current);
  };

  if (error) {
    return (
      <div role="alert" style={{ padding: 24, color: 'var(--on-surface)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <p style={{ margin: 0, fontSize: 13 }}>{errorCopy[error.kind]}</p>
        <button type="button" onClick={onClose} style={{ marginTop: 8, padding: '8px 18px', borderRadius: 999, background: 'transparent', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)', cursor: 'pointer' }}>
          Quay lại chat
        </button>
      </div>
    );
  }

  const orbState: AgentState = uiState === 'speaking' || uiState === 'listening' || uiState === 'thinking' ? uiState : 'listening';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#0a0a0a' }}>
      <header style={{ background: 'rgba(0,0,0,0.5)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,86,37,0.3)' }}>
        <button type="button" onClick={onClose} aria-label="Quay lại chat" style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#ffb5a0', fontSize: 12, fontWeight: 700 }}>{uiState === 'connecting' ? 'Đang kết nối…' : 'Đang nói chuyện'}</div>
          <div style={{ color: '#a3e635', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, background: '#84cc16', borderRadius: '50%' }} /> {formatDuration(duration)}
          </div>
        </div>
        <button type="button" onClick={handleHangup} aria-label="Tắt" style={{ background: '#dc2626', border: 'none', color: 'white', padding: '5px 12px', borderRadius: 999, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>⏹ Tắt</button>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 8px' }}>
        <div data-testid="voice-orb" data-state={orbState} style={{ width: 70, height: 70, borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #ffb5a0, #ff5625 60%)', boxShadow: '0 0 36px rgba(255,86,37,0.7)', transition: 'transform .25s ease' }} />
        <div style={{ color: 'white', fontSize: 11, opacity: 0.7, marginTop: 8 }}>{stateCaption[uiState] || ''}</div>
      </div>

      <div ref={transcriptRef} style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid rgba(255,86,37,0.2)', padding: '10px 12px', background: 'rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 8, opacity: 0.5, color: 'white', marginBottom: 6, letterSpacing: '0.6px', fontWeight: 600 }}>📝 TRANSCRIPT</div>
        <div style={{ fontSize: 11, lineHeight: 1.5 }}>
          {transcript.map((t, i) => (
            <div key={i} data-testid="transcript-item" style={{ marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
              <strong style={{ color: t.role === 'user' ? '#ffb5a0' : '#ff7a4a' }}>{t.role === 'user' ? 'Anh:' : 'Meo:'}</strong> {t.text}
            </div>
          ))}
        </div>
      </div>

      <footer style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', gap: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button type="button" onClick={() => connection.setMicMuted(true)} aria-label="Tắt mic" style={controlBtn}>🔇</button>
        <button type="button" onClick={() => connection.setSpeakerMuted(true)} aria-label="Tắt loa" style={controlBtn}>🔊</button>
      </footer>
    </div>
  );
}

const controlBtn = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'white',
  width: 36,
  height: 36,
  borderRadius: '50%',
  fontSize: 13,
  cursor: 'pointer',
} as const;
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run tests/unit/meo-voice-panel.test.tsx tests/unit/meo-voice-panel-error.test.tsx
```
Expected: 5 + 3 = 8 PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/components/MeoVoicePanel.tsx tests/unit/meo-voice-panel.test.tsx tests/unit/meo-voice-panel-error.test.tsx
git commit -m "feat(meo-voice): MeoVoicePanel hybrid orb + transcript UI

State machine driven by MeoVoiceConnection callbacks. Orb pulses on
agent state. Transcript scroll-follows. Error states map to friendly
Vietnamese copy."
```

---

## Task 8: Frontend — wire `MeoChatPanel.tsx` mode switch + transcript merge

**Goal:** Add `mode` state to existing chat panel. Render pill above input in text mode. Render `MeoVoicePanel` in voice mode. Merge transcript into `messages` on completion.

**Files:**
- Modify: `/Users/agentopenclaw/Downloads/dai-long-landing/src/components/MeoChatPanel.tsx`
- Modify: `/Users/agentopenclaw/Downloads/dai-long-landing/tests/unit/meo-chat-panel.test.tsx` (extend existing)

- [ ] **Step 1: Extend the existing test**

Append to `tests/unit/meo-chat-panel.test.tsx` (verify path first; if file doesn't exist, create with imports matching repo style):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('@/components/MeoVoicePanel', () => ({
  MeoVoicePanel: ({ onComplete, onClose }: any) => (
    <div data-testid="voice-panel">
      <button onClick={() => onComplete([{ role: 'user', text: 'hi' }, { role: 'meo', text: 'chào' }])}>finish</button>
      <button onClick={onClose}>back</button>
    </div>
  ),
}));

import { MeoChatPanel } from '@/components/MeoChatPanel';

describe('MeoChatPanel mode switch (Phase 4)', () => {
  it('renders MeoVoicePill above input by default', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    render(<MeoChatPanel shape="sheet" onClose={() => {}} voicePhase="full" />);
    expect(screen.getByRole('button', { name: /Nói chuyện với Meo/i })).toBeInTheDocument();
  });

  it('switches to voice mode when pill is clicked', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    render(<MeoChatPanel shape="sheet" onClose={() => {}} voicePhase="full" />);
    fireEvent.click(screen.getByRole('button', { name: /Nói chuyện với Meo/i }));
    expect(screen.getByTestId('voice-panel')).toBeInTheDocument();
  });

  it('merges transcript into messages when voice ends, role=user→user, role=meo→assistant', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    render(<MeoChatPanel shape="sheet" onClose={() => {}} voicePhase="full" />);
    fireEvent.click(screen.getByRole('button', { name: /Nói chuyện với Meo/i }));
    act(() => { fireEvent.click(screen.getByText('finish')); });

    expect(screen.getByText(/^hi$/)).toBeInTheDocument();
    expect(screen.getByText(/chào/)).toBeInTheDocument();
    // After merge, voice panel disappears, text panel back
    expect(screen.queryByTestId('voice-panel')).not.toBeInTheDocument();
  });

  it('hides pill when voicePhase=disabled', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    render(<MeoChatPanel shape="sheet" onClose={() => {}} voicePhase="disabled" />);
    expect(screen.queryByRole('button', { name: /Nói chuyện với Meo/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run tests/unit/meo-chat-panel.test.tsx
```
Expected: FAIL — current `MeoChatPanel` doesn't accept `voicePhase` prop, doesn't render pill, doesn't switch modes.

- [ ] **Step 3: Patch `MeoChatPanel.tsx`**

Read current file first:
```bash
sed -n '1,40p' /Users/agentopenclaw/Downloads/dai-long-landing/src/components/MeoChatPanel.tsx
```

Add the import block at the top of the file:

```tsx
import { MeoVoicePill, type VoicePhase } from '@/components/MeoVoicePill';
import { MeoVoicePanel, type TranscriptItem } from '@/components/MeoVoicePanel';
```

Extend the component props (the existing `Props` type / inline type):

```tsx
interface Props {
  // ... existing fields ...
  voicePhase?: VoicePhase;
}
```

Add state inside the component body, alongside existing useState calls:

```tsx
const [mode, setMode] = useState<'text' | 'voice'>('text');
```

Render the pill **above the input area** in text mode. In the existing JSX, find where the `<input>` row is and inject before it:

```tsx
{mode === 'text' && (
  <div style={{ padding: '6px 12px' }}>
    <MeoVoicePill phase={props.voicePhase ?? 'disabled'} onClick={() => setMode('voice')} />
  </div>
)}
```

Render the `MeoVoicePanel` instead of the chat body when `mode === 'voice'`. Around the `<div role="log">` block (current line ~284), wrap the chat body in a conditional:

```tsx
{mode === 'voice' ? (
  <MeoVoicePanel
    onClose={() => setMode('text')}
    onComplete={(transcript: TranscriptItem[]) => {
      setMessages((prev) => [
        ...prev,
        ...transcript.map((t) => ({
          id: `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: t.role === 'user' ? 'user' : 'assistant',
          content: t.text,
        })),
      ]);
      setMode('text');
    }}
  />
) : (
  <>
    {/* existing chat log + quick replies + input area JSX */}
  </>
)}
```

Update the message-shape mapping to match whatever `messages` items already use (probably `{ id, role, content }` per the existing `m.id`/`m.role`/`m.content` reads at lines 287-307 of the current file).

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run tests/unit/meo-chat-panel.test.tsx
```
Expected: 4 new tests PASSED, plus all pre-existing tests in this file still passing. Fix mismatches inline if any pre-existing test breaks (e.g. add `voicePhase="disabled"` to existing test renders).

- [ ] **Step 5: Run full test suite + type check**

```bash
pnpm vitest run
pnpm tsc --noEmit
```
Expected: full suite green, zero type errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/MeoChatPanel.tsx tests/unit/meo-chat-panel.test.tsx
git commit -m "feat(meo-voice): mode switch + voice transcript merge

MeoChatPanel renders the voice pill above input. Tapping switches
to MeoVoicePanel; on hangup, transcript items merge into messages
with role mapping user→user, meo→assistant."
```

---

## Task 9: Wire feature flag + propagate from `ChatWidget.tsx`

**Goal:** Read `VOICE_PHASE` (or whatever existing config endpoint returns it) and pass into `MeoChatPanel` via `voicePhase` prop. Use existing pattern — do not invent new env plumbing.

**Files:**
- Modify: `/Users/agentopenclaw/Downloads/dai-long-landing/src/components/ChatWidget.tsx`
- Possibly modify: `/Users/agentopenclaw/Downloads/dai-long-landing/functions/api/voice-token.ts` (if `GET` health probe needs to expose the phase too)

- [ ] **Step 1: Audit how phase is read today**

```bash
grep -rnE "VOICE_PHASE|voicePhase" /Users/agentopenclaw/Downloads/dai-long-landing/src /Users/agentopenclaw/Downloads/dai-long-landing/functions 2>/dev/null
```

If grep returns matches in another component (likely the canary bucket logic the spec references) — reuse that. Pass the result into `<MeoChatPanel voicePhase={...} />`.

If no existing reader, add a `useEffect` in `ChatWidget.tsx` that fetches `GET /api/voice-token` once on mount (the existing health probe per `voice-token.ts` doc-comment line 4: *"GET → health probe ... Responds 200 with { livekit_configured: boolean, url?: string }"*) and infers phase: `livekit_configured=true` → `'full'`, else `'disabled'`.

Minimum-diff version of `ChatWidget.tsx` snippet:

```tsx
const [voicePhase, setVoicePhase] = useState<'disabled' | 'canary' | 'full' | 'maintenance'>('disabled');

useEffect(() => {
  let cancelled = false;
  fetch('/api/voice-token')
    .then((r) => r.json())
    .then((d) => { if (!cancelled) setVoicePhase(d.livekit_configured ? 'full' : 'disabled'); })
    .catch(() => {});
  return () => { cancelled = true; };
}, []);

return <MeoChatPanel /* ... existing props ... */ voicePhase={voicePhase} />;
```

(If a canary bucket function exists, swap `d.livekit_configured` for the canary check.)

- [ ] **Step 2: Build**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
pnpm build 2>&1 | tail -20
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatWidget.tsx
git commit -m "feat(meo-voice): propagate voicePhase from ChatWidget

Reads health probe from /api/voice-token GET to infer feature flag
on widget mount, threads through to MeoChatPanel."
```

---

## Task 10: E2E smoke + canary verification

**Goal:** Boss-driven manual verification on a Pages preview deploy, then watch canary metrics for 24-48h before flipping `VOICE_PHASE=full`.

**Files:** none

- [ ] **Step 1: Deploy preview**

```bash
cd /Users/agentopenclaw/Downloads/dai-long-landing
pnpm build
wrangler pages deploy out --project-name dailongai --branch preview-meo-voice-phase4 --commit-dirty=true
```
Expected: Pages URL printed. Open in browser.

- [ ] **Step 2: Boss tests pill flow**

1. Open preview URL with `?voice=1` (force canary bucket).
2. Open the Meo Meo widget.
3. Verify pill "🎙️ Nói chuyện với Meo" is visible above input, gradient cam, full-width.
4. Tap pill — expect connecting state with spinning ring.
5. Allow mic in browser prompt.
6. Say *"Cho hỏi giá máy bao nhiêu?"* — expect:
   - Orb pulses
   - Transcript appears with `Anh:` (user) and `Meo:` (assistant) lines as Meo replies
   - Timer ticks
7. Tap "⏹ Tắt".
8. Verify return to text panel; transcript items appear as messages with TTS replay button on Meo turns.
9. Test deny path: open in fresh window, deny mic — expect error UI with "Cần quyền micro…".
10. Test rate limit: `POST /api/voice-token` 11 times in a minute via curl — 11th tap should show rate-limit toast.

- [ ] **Step 3: Verify Supabase row**

```bash
psql "$SUPABASE_DB_URL_meo_meo_voice" -c "SELECT id, transcript_text, started_at, ended_at FROM voice_transcripts ORDER BY id DESC LIMIT 1"
```
Expected: latest row from the test session has full transcript text + populated timestamps.

- [ ] **Step 4: Watch canary metrics for 24-48h**

Boss monitors `dashboard.meo-voice` (or `/meo-voice` MC view) for: session count, error rate, mic-deny rate. Compare to baseline.

- [ ] **Step 5: Flip to full**

If metrics stable:
```bash
wrangler pages secret put VOICE_PHASE --project-name dailongai <<< "full"
wrangler pages deploy out --project-name dailongai --branch main --commit-dirty=true
```

- [ ] **Step 6: Final cleanup commit (release notes only)**

```bash
git commit --allow-empty -m "release(meo-voice): Phase 4 UI live (full)

Pill + hybrid voice mode now visible to all dailongai.com visitors.
Backend gpt-realtime-2 not used here — Meo Meo on gemini-3.1-flash-live-preview
since 2026-05-10."
```

---

## Self-Review

**Spec coverage:**
- §1 Goal — covered by Tasks 6, 7, 8 (pill + hybrid + wiring) and Tasks 1, 2 (backend stream)
- §2 Non-goals — none of these tasks touch PSTN, multi-locale, admin, agent capabilities
- §3 Decisions: B pill (Task 6), 3 hybrid (Task 7), full transcript (Tasks 1-2), brand color (Task 6, 7), header hangup (Task 7), end behavior (Task 8), feature flag (Tasks 6, 9)
- §4 Data flow — Task 5 (frontend wrapper), Tasks 1-2 (backend publish), Task 8 (mode switch + merge)
- §5 Components — every file in the spec maps to a task: `package.json` (Task 4), `MeoChatPanel.tsx` (Task 8), `MeoVoicePill.tsx` (Task 6), `MeoVoicePanel.tsx` (Task 7), `meo-voice-connection.ts` (Task 5), `voice-token.ts` (kept untouched), `data_channel.py` (Task 1), `agent.py` (Task 2), all 6 test files split across the same tasks
- §6 Visual states — Task 7 implements `connecting`, `listening`, `speaking`, `thinking`, `error` mapping
- §7 Error handling — Task 7 covers all 12 conditions in `errorCopy` map and inline guards; Task 8 handles `mode` switch races
- §8 Testing — backend pytest in Tasks 1-2, frontend Vitest in Tasks 5-8, manual E2E in Task 10
- §9 Risks: Gemini event-name uncertainty addressed in Task 0 then resolved in Task 2's `MEO_RESPONSE_EVENT` constant; bundle size addressed by lazy-loading in Task 4; transcript persistence already documented as best-effort
- §10 Rollout — Task 10 covers preview → canary watch → full flip

**Placeholder scan:** none — every step contains exact file paths, exact commands, exact code, and (where parameterized) explicit pointers to the upstream task that supplied the value (e.g. Task 4 references "VERSION_FROM_TASK_0").

**Type consistency:**
- `VoiceState` defined in Task 5 (`'idle' | 'connecting' | 'active' | 'ended' | 'error'`) — used identically in Task 7
- `AgentState` defined in Task 5 (`'listening' | 'speaking' | 'thinking'`) — identical to backend `VALID_STATES` in Task 1 and `GEMINI_TO_UI_STATE` mapping in Task 2
- `TranscriptRole` (`'user' | 'meo'`) — identical across `data_channel.publish_transcript` (Task 1), wire format (Task 5), `MeoVoicePanel` callbacks (Task 7), and merge mapping (Task 8 maps `'meo'` → `'assistant'`)
- `VoicePhase` (`'disabled' | 'canary' | 'full' | 'maintenance'`) — defined in Task 6, propagated through Task 8 props and Task 9 fetch logic
