# Performance Quick Wins — dailongai.com

**Date:** 2026-04-17  
**Status:** Approved  
**Scope:** Low-risk optimizations that reduce initial load without changing UX

## Changes

### 1. Compress PWA Icons
- `icon-512.png` (177KB) → compress with pngquant/sharp (~30KB target)
- Also compress `icon-192.png`, `apple-touch-icon.png`, `favicon-32.png`

### 2. Delete Orphaned Components
- `GlobeNetwork.tsx` — not imported anywhere
- `CapabilityConstellation.tsx` — not imported anywhere
- `BetaPopup.tsx` — not imported anywhere

### 3. Split Translations by Locale
- Current: single `translations.ts` (211KB, 6 languages)
- Target: `translations/vi.ts`, `translations/en.ts`, etc.
- Dynamic import based on active locale → ~35KB per language instead of 211KB

### 4. Standardize Image Loading
- All `<img>` tags: add `loading="lazy"` + `decoding="async"`
- Hero image: keep `loading="eager"` + `fetchPriority="high"`
- Ensure consistent `srcSet` where responsive variants exist

## Expected Impact
- ~300-400KB reduction in initial page load
- Improved LCP and FCP scores
- No visual or UX changes
