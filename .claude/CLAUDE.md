# AgriResilience: Claude Code project instructions

NASA Space Apps Challenge 2026 entry for **"Field Shift: Adapting Farms with NASA Data"**. Team Jeoleecation, Local Event Iligan City, Philippines.
An offline-first PWA that helps smallholder farmers compare crop-rotation strategies (current + ≥2 alternatives) and planting months using NASA Earth observations, crop characteristics, and farmer priorities.

**User flow (team-defined, accepted, see `docs/11-user-flow.md`):** no login → sketch lots on a map with a finger, auto-converted to clean plots with draggable points (Lot 1..N) → crops per lot (many) → dashboard with results + explained data (ⓘ on every chart) → optional planting months → "your months vs better months" side by side. **Harvest destinations + transport (travel time per lot) are NOT in onboarding**; the farmer adds them anytime from the dashboard or Edit farm.

**Hard deadline: Sun Nov 15, 2026, 11:59 PM PHT (UTC+8). Feature freeze Sun 12:00 PHT. Internal submit target Sun 21:00 PHT.**

## Start here
- Docs index: `docs/README.md`. Planning lives in `docs/`, numbered in reading order.
- Requirements: `docs/01-challenge-brief.md` (R1–R8). Rules and rubric: `docs/02-submission-and-judging.md`.
- Scope: `docs/05-mvp-scope.md`. Architecture: `docs/06-architecture.md`. Engine spec: `docs/07-rotation-engine.md`.
- Decisions: `docs/decision-log.md`. Don't re-open an Accepted decision without the team.

## Non-negotiable rules
1. **Say "SI" (Super Intelligence), not "AI"**, in all submission-facing text, slides, README, and app copy. This is the event's mandated terminology.
2. **Log every meaningful SI use** in `docs/si-usage-log.md` (date, tool, purpose, output location). The team owns ideas and decisions. Present options and recommendations, and leave the choice to the team.
3. **No invented numbers.** Every statistic, coefficient, or claim in the app, docs, or slides must trace to a source (dataset + period, or a citation). Engine coefficients live in `app/src/engine/params.ts`, each with a source comment.
4. **No NASA logos, flags, or mission insignia** in any SI-generated asset. SI-generated images get a visible "SI-generated" watermark. No likeness of anyone under 18.
5. **English** for all submission materials.
6. The app **supports and doesn't replace** farmer judgment and agricultural technicians. Keep that framing in the UI copy.
7. Scope discipline: respect the MoSCoW in `docs/05-mvp-scope.md` and the cut order in `docs/08-hackathon-schedule.md`. Flag scope creep.
8. **No login, no accounts, no backend storage.** Farm data (lots, crops, destinations, months) lives in IndexedDB on the device. Outbound location data is limited to the NASA POWER request (lot centroid rounded to 0.1°) and the optional OSRM routing request (rounded to ~100 m).
9. Travel-time defaults (mode speeds, loads, circuity, perishability thresholds) are **assumptions**. Label them so in `params.ts` and the UI, and the farmer's own travel time always wins.

## Technical conventions (proposed; see decision log)
- `pipeline/`: Python 3.11+, prepares the crop library + demo farm data → `app/public/data/`. Never commit credentials (`.netrc`, `.env`) or `pipeline/raw/`.
- Live lots: the browser calls the NASA POWER **monthly** point API (CORS `*` verified). Monthly `PRECTOTCORR` is **mm/day** (× days in month); key `YYYY13` is annual (skip); `-999` = missing.
- `app/`: React + Vite + TypeScript PWA (`vite-plugin-pwa`). The rotation engine runs in the browser (`app/src/engine/`) so it works offline.
- Every derived value carries provenance: `{source, native_res, period}`.
- Network note: on the team's network, `spaceappschallenge.org` fails TLS verification in curl/WebFetch (untrusted root). Use the browser for that site. NASA POWER and GitHub work.

## Project subagents (`.claude/agents/`)
Planning phase: `project-manager`, `product-manager`, `ux-researcher`, `assumption-mapping`, `technical-writer`, `data-researcher`, `research-analyst`, `architect-reviewer`. See `docs/claude-setup.md` for when to use each and which build-phase agents to add.
