# Lot not farmland Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lot with no NASA soil data (sea, ice) shows no crop ratings and offers to move it; S2 never lists Poor fit crops as "top".

**Architecture:** Two pure checks (`hasNoSoilData` in lot-analysis-core, `noCropFits` in suggest-core) drive a new `no-soil` lot view and S2's top block. UI files only render them.

**Tech Stack:** Expo React Native + TypeScript, `node --test` with `scripts/node-test-resolve.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-14-lot-not-farmland-design.md`

## Global Constraints

- Say "SI", not "AI". No invented numbers: the no-soil rule cites the 2026-11-14 POWER probe.
- The app supports, doesn't replace, farmer judgment and technicians (copy).
- No new outbound request, no new dataset.
- Engine stays pure TypeScript; no React Native imports in `*-core.ts`.

## Review Focus

1. A real land lot with a few missing GWETROOT months must not be flagged (only all 12 missing).
2. The demo farm and the Iligan fixture must not change their top 3.
3. A lot with no crops but no soil data shows the no-soil note, not "Pick crops".
4. The farm map and compare screen must handle the new view kind (typecheck catches a missed switch).
5. S2 with all crops unknown (no crop data) shows nothing, not "None grow well".

---

### Task 1: no-soil lot view

**Files:** Modify `mobile/src/components/lot-analysis-core.ts`, `mobile/src/components/farm-map-core.ts`; tests in `lot-analysis-core.test.ts`, `farm-map-core.test.ts`.

**Produces:** `hasNoSoilData(data: Pick<LotData, "monthly">): boolean`; `LotView` member `{ kind: "no-soil" }`; `farmMapLotStatus({kind:"no-soil"})` → `{ level: null, color: NO_RESULT_COLOR, status: "No soil data" }`.

- [ ] Tests: all-12-null wetness → true; one month with a value → false; the Iligan fixture → false. `lotView` with such data → `{kind:"no-soil"}` with crops and with none. Farm map status for `no-soil`.
- [ ] Run, watch fail; implement; run, pass.

### Task 2: top crops without Poor fit

**Files:** Modify `mobile/src/lots/suggest-core.ts` (+ test).

**Produces:** `topCrops` filters `poor` and `unknown`; `noCropFits(s: LotSuggestions): { why: "too dry" | "too cold" | "too hot" | "too wet" | null } | null` (non-null only when at least one crop is rated and all rated crops are Poor; `why` = the trouble of more than half of them, from `reasons[0].code`: water/dry-year → too dry, too-cold/cool → too cold, too-hot/warm → too hot, waterlogging → too wet); `safeLotTop(details, data, library, n?) → { top, noFit }` replacing `safeTopCrops`.

- [ ] Tests: top never Poor; all-Poor library case (a crop library whose temperature limits fail on the fixture) → `noFit.why === "too cold"`; Iligan fixture → `noFit === null` and top unchanged; all unknown → `noFit === null`; broken data → `{ top: [], noFit: null }`.
- [ ] Run, watch fail; implement; run, pass.

### Task 3: S2 data line and UI

**Files:** Modify `mobile/src/lots/crop-picks.ts` (+ test), `mobile/app/crops.tsx`, `mobile/src/components/TopCrops.tsx`, `mobile/src/content/explainers.ts`.

- [ ] Test: `dataLine("ready", true, true)` → `{ tone: "error", text: "No NASA soil data here. This spot looks like sea or ice, not farmland." }`.
- [ ] S2: "Move lot" button on the no-soil line (`/lots?lot=<id>`), no top block; TopCrops shows "No good match for this lot" when `noFit`.
- [ ] ⓘ text: Poor fit crops are not listed.

### Task 4: dashboard and compare

**Files:** Modify `mobile/app/dashboard.tsx`, `mobile/app/compare.tsx`.

- [ ] `no-soil` case: warning notice and "Move <lot> on the map" button.
- [ ] typecheck, lint, all tests; headless check with a sea lot and a desert lot added.

### Task 5: docs

- [ ] `docs/11-user-flow.md` S2 and S3 lines; `docs/si-usage-log.md` row.
