# /doi-ngu-ai 3D Apple Vision Pro — Design Spec

**Date**: 2026-05-06
**Owner**: Boss + Sen Coder
**Status**: Approved (Boss directive: "Làm hết xong tôi kiểm tra" — design + plan autonomously, review at milestone deliverables)

## Goal

Refactor `/doi-ngu-ai` from 2D cyberpunk page (Phase 0, paused, NOT deployed) into immersive **3D Apple Vision Pro / Bruno Simon style** spatial experience that reflects the AI agent fleet theme — replacing static `ha-tang.png` with a fully realized 3D infrastructure scene.

Phase 0 work (sitemap entry, nav integration, translation keys) is preserved. Only `src/app/doi-ngu-ai/page.tsx` and `src/app/doi-ngu-ai/styles.css` are replaced.

## Confirmed decisions (Boss)

| # | Decision | Choice |
|---|---|---|
| Q1 | Sections in 3D | All (hero + 4 depts + infrastructure + CTA) |
| Q2 | Camera | Linear scroll-driven (Apple iPhone product page style) |
| Q3 | Avatar handling | Billboard sprites — anime portrait floating in 3D space |
| Q4 | Reference inspiration | Apple Vision Pro page |
| Q5 | Mobile fallback | Full 3D mobile (Boss accepts INP risk) |
| Q6 | Stack | React Three Fiber |
| Q7 | Hero concept | **D — Mix B+A**: Spatial UI panels open → transition to Central Nexus orbit |
| Q8 | Hero/infra theme | Reflect AI agent fleet (NO static ha-tang.png) |

## Scene composition (Sen Coder decisions, Boss to review at milestone delivery)

### Scene 1 — Hero opening (Spatial UI → Central Nexus)
- **Open state (scroll = 0)**: 4-5 floating glass panels (drei `<RoundedBox>` + `MeshTransmissionMaterial`) in dark void, slowly Y-axis rotating. Each panel previews a Sen department + tagline. Particle starfield (`<Points>` custom) drifts in background.
- **Transition (scroll 0–25%)**: Panels shrink + drift inward, morph into a single pulsing **Nexus Core** (procedural Icosahedron + custom GLSL shader for animated neural mesh, bloom-emissive cyan/orange).
- **Established (scroll 25–35%)**: 17 Sen avatar billboards orbit Nexus at varied radii + speeds (instanced sprites with depth fade). Boss tier 👑 emoji rendered as a brighter, larger node above the orbit plane (Boss-as-crown).

### Scene 2 — 4 Department zones (scroll 35–75%)
- Camera glides from Nexus down a curved path through 4 zones, one per phòng ban.
- Each zone has color-tinted volumetric fog matching dept color (cyan/yellow/green/magenta).
- Avatars in 3D formation per dept count: 2×2 floating grid (Điều Phối, Marketing — 4 each) or triangular (Khách Hàng — 3) or 2×3 (Kỹ Thuật — 6).
- Per-avatar info: name + role + 1-line mission, rendered via drei `<Html>` overlay (HTML/CSS for crisp text, no SDF) anchored to billboard.
- ASCII frame `┌──[ NAME ]──` department header rendered as drei `<Text>` floating in front of each zone.

### Scene 3 — Infrastructure (scroll 75–90%) — REPLACES ha-tang.png
- 6 concentric horizontal rings stacked vertically forming a **layered tower** (one ring per tech stack layer: AI / Memory / Compute / Comms / Frontend / DevOps).
- Each ring has tool-name chips (drei `<Text>`) floating along its circumference, slowly rotating.
- Relevant Sen avatars perched at their ring (e.g. Sen Coder + Sen VPS at Compute, Sen Voice + Meo Meo at Comms) — reinforces "Sen agents operate this stack".
- Camera does **helical scroll** wrapping around tower while ascending — Apple-product-page feel.
- Subtle neural-mesh strands connect rings vertically (line glow, low alpha) — fleet topology.

### Scene 4 — CTA portal (scroll 90–100%)
- Camera flies into a glowing rectangular portal (gradient orange→pink ring shader) leading out into the CTA card.
- 2D Header + Footer slide back in via fade.
- "Hợp Tác Cùng Đại Long" + button rendered as standard React (over Canvas via fixed overlay) so click works.

## Architecture

### Route + component split
- `src/app/doi-ngu-ai/page.tsx` — server component, exports `metadata`, renders `<Scene3D />` client component.
- `src/app/doi-ngu-ai/Scene3D.tsx` — `"use client"`, owns Canvas + ScrollControls.
- `src/app/doi-ngu-ai/scenes/HeroScene.tsx` — Spatial UI → Nexus + orbit.
- `src/app/doi-ngu-ai/scenes/DepartmentZones.tsx` — 4 zones.
- `src/app/doi-ngu-ai/scenes/InfrastructureRings.tsx` — 6-ring tower.
- `src/app/doi-ngu-ai/scenes/CtaPortal.tsx` — exit portal.
- `src/app/doi-ngu-ai/data/agents.ts` — extracted Sen[] + Department[] data (reuse from existing page.tsx).
- `src/app/doi-ngu-ai/components/AvatarBillboard.tsx` — reusable sprite component.
- `src/app/doi-ngu-ai/components/NexusCore.tsx` — Icosahedron + neural-mesh shader.
- `src/app/doi-ngu-ai/styles.css` — replace cyberpunk 2D CSS with minimal global styles + overlay typography (Orbitron/Share Tech Mono kept).

### Camera/scroll
- Use drei `<ScrollControls pages={5} damping={0.18}>` to map scroll progress → camera position spline (`THREE.CatmullRomCurve3`) + lookAt targets per scene.
- `useScroll().offset` drives all per-scene animations (panels shrink, ring rotation, fog density).

### Asset pipeline
- **Avatars**: 17 existing files at `public/images/team/sen-*.{jpg,png,jpeg}`. No regen.
  - Load via drei `useTexture` batched.
  - Render as billboard via drei `<Billboard>` + `<Image>` (auto facing camera).
  - Boss avatar: drei `<Text>` "👑" emoji at large size + outer ring shader.
- **Nexus core**: procedural — `IcosahedronGeometry` + custom shader (vertex displacement noise + emissive fragment with cyan/orange gradient based on view angle).
- **Glass panels**: drei `<MeshTransmissionMaterial>` with low thickness, high IOR.
- **Particles**: drei `<Sparkles>` for foreground motes, `<Points>` for distant starfield.
- **Post-processing**: `@react-three/postprocessing` Bloom (key scenes only) + ChromaticAberration (low intensity, matches existing 2D aesthetic) + Vignette.

### Dependencies to add
```
@react-three/fiber
@react-three/drei
@react-three/postprocessing
```
(`three`, `@types/three`, `lenis` already installed.)

## Performance budget

- DPR cap: `min(devicePixelRatio, 1.5)` desktop, `min(devicePixelRatio, 1)` mobile.
- Triangle budget: <100k visible at any scroll position.
- Texture budget: 17 avatars × ~64KB = ~1MB total.
- Bloom + post-processing only when scene focused (toggle via scroll waypoint).
- `frameloop="demand"` when scroll idle for 2s.
- `prefers-reduced-motion`: fall back to static 2D snapshot of each scene (PNG export from R3F at scroll waypoints) — out of scope for M0–M4, deferred to M5.

## Milestone plan (handed off to writing-plans skill)

- **M0** (1–2 days) — Scaffold: install R3F deps, replace `page.tsx` with Scene3D client component, blank Canvas + ScrollControls scaffold renders, dev server preview works.
- **M1** (3–4 days) — Hero scene: Spatial UI panels + transition + Nexus Core + 17 orbit billboards + Boss crown.
- **M2** (3–4 days) — Department zones × 4 with formations, fog, Html overlays.
- **M3** (2–3 days) — Infrastructure rings (6-layer tower + perched Sen avatars + helical camera).
- **M4** (1–2 days) — CTA portal + transitions polish (lighting, bloom, chromatic aberration).
- **M5** (2–3 days) — Mobile QA, perf pass, prefers-reduced-motion fallback.
- **M6** (1 day) — Deploy via `./publish-blog.sh --rebuild`, Boss acceptance.

**Total**: 12–19 active dev days (~3–4 weeks calendar with iteration).

## Out of scope (explicit)

- Phase 0 deploy is SKIPPED per Boss directive. 2D version not pushed to prod.
- No A/B parallel route. Same URL `/doi-ngu-ai` swaps directly from 2D draft to 3D.
- No i18n switch in 3D scenes for now — VI text only (matches Phase 0 decision "ship nhanh, dịch sau").
- No avatar regeneration. Reuse 17 existing files.
- No SEO impact analysis beyond keeping `<Header>`/`<Footer>` and `metadata` export.

## Risks

1. **Mobile INP**: Boss accepts. Mitigation: DPR cap + post-FX disable on mobile + lazy scene mount.
2. **Asset path drift**: avatar filenames are stable (Phase 0 already URL-safe). Low risk.
3. **R3F learning curve**: Sen Coder has previous R3F context (`DnaHelix`, `LuminousFilaments`, `OrganicWaveField` already in this codebase). Reference patterns will be reused.
4. **Build size**: R3F + drei adds ~300KB gz. Acceptable for a marketing showcase page.
