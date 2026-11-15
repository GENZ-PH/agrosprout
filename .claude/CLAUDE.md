# AgroSprout: Claude Code project instructions

NASA Space Apps Challenge 2026 entry for **"Field Shift: Adapting Farms with NASA Data"**. Team Jeoleecation, Local Event Iligan City, Philippines.
An offline-first mobile app (Expo React Native: Android app for farmers + web build for judges) that helps smallholder farmers compare crop-rotation strategies (current + ≥2 alternatives) and planting months using NASA Earth observations, crop characteristics, and farmer priorities.

**User flow (team-defined, accepted, see `docs/11-user-flow.md`):** no login → sketch lots on a map with a finger, auto-converted to clean plots with draggable points (Lot 1..N) → one crop per lot (top 3 or search; D13 changed 2026-11-14) → dashboard with results + explained data (ⓘ on every chart) → optional planting months → "your months vs better months" side by side. **Harvest destinations + transport (travel time per lot) are NOT in onboarding**; the farmer adds them anytime from the dashboard or Edit farm.

**Hard deadline: Sun Nov 15, 2026, 11:59 PM PHT (UTC+8). Feature freeze Sun 12:00 PHT. Internal submit target Sun 21:00 PHT.**

## Start here
- Docs index: `docs/README.md`. Planning lives in `docs/`, numbered in reading order.
- Requirements: `docs/01-challenge-brief.md` (R1–R8). Rules and rubric: `docs/02-submission-and-judging.md`.
- Scope: `docs/05-mvp-scope.md`. Architecture: `docs/06-architecture.md`. Engine spec: `docs/07-rotation-engine.md`.
- Decisions: `docs/decision-log.md`. Don't re-open an Accepted decision without the team.

## Non-negotiable rules
1. **Say "SI" (Super Intelligence), not "AI"**, in all submission-facing text, slides, README, and app copy. This is the event's mandated terminology.
2. **Log every meaningful SI use** in `docs/si-usage-log.md` (date, tool, purpose, output location). The team owns ideas and decisions. Present options and recommendations, and leave the choice to the team.
3. **No invented numbers.** Every statistic, coefficient, or claim in the app, docs, or slides must trace to a source (dataset + period, or a citation). Engine coefficients live in `mobile/src/engine/params.ts`, each with a source comment.
4. **No NASA logos, flags, or mission insignia** in any SI-generated asset. SI-generated images get a visible "SI-generated" watermark. No likeness of anyone under 18.
5. **English** for all submission materials.
6. The app **supports and doesn't replace** farmer judgment and agricultural technicians. Keep that framing in the UI copy.
7. Scope discipline: respect the MoSCoW in `docs/05-mvp-scope.md` and the cut order in `docs/08-hackathon-schedule.md`. Flag scope creep.
8. **No login, no accounts, no backend storage.** Farm data (lots, crops, destinations, months) lives in AsyncStorage on the device. Outbound location data is limited to the NASA POWER request (lot centroid rounded to 0.1°), the NASA satellite checks request to our API Worker (the same rounded centroid; the Worker calls NASA IMERG, SMAP, FLDAS, AppEEARS and SRTM with Earthdata credentials kept as Worker secrets, decision D35, 2026-11-15) and the optional OSRM routing request (rounded to ~100 m). The "In plain words" SI summary (D33) sends the engine's results for the suggested plan to Claude through our API Worker, by itself when online (a button during a what-if): no location, no lot shape, no names, nothing stored.
9. Travel-time defaults (mode speeds, loads, circuity, perishability thresholds) are **assumptions**. Label them so in `params.ts` and the UI, and the farmer's own travel time always wins.
10. **The project name is AgroSprout** (D7, decided 2026-11-15) in the app, README, docs, slides, demo and the submission form. "AgriResilience" was the working name; keep it only in historical records (`docs/reference/`, past SI log entries).

## Technical conventions (proposed; see decision log)
- `pipeline/`: Python 3.11+, prepares the crop library + demo farm data → `mobile/assets/data/`. Never commit credentials (`.netrc`, `.env`) or `pipeline/raw/`.
- Live lots: the app calls the NASA POWER **monthly** point API (native fetch on Android; CORS `*` verified for web). Monthly `PRECTOTCORR` is **mm/day** (× days in month); key `YYYY13` is annual (skip); `-999` = missing.
- `mobile/`: **Expo React Native + TypeScript + expo-router**, targets Android (EAS build → APK) and web (`expo export --platform web`). The rotation engine is **pure TypeScript** in `mobile/src/engine/` (no React Native imports) so it runs offline on both targets and is unit-testable in Node.
- Lot map: **Leaflet + Terra Draw** page (`mobile/map-src/`, bundled locally, no CDN) inside `react-native-webview` on Android and an `<iframe>` on web; messages typed in `mobile/src/map/bridge.ts`.
- Repo workflow (D22): folder ownership + short-lived branches merged to `main` within ~2 h; `main` must always run. See `docs/08-hackathon-schedule.md#repo-workflow-d22`.
- Every derived value carries provenance: `{source, native_res, period}`.
- **Diagrams and graphs in docs use Mermaid** (```` ```mermaid ```` code blocks, which GitHub renders): flowchart for flows and architecture, gantt for schedules, sequenceDiagram for interactions. No ASCII-art diagrams. UI wireframe mockups and directory trees may stay as plain text. Quote node labels (`A["..."]`), use `<br/>` for line breaks, and avoid `:` and `;` in gantt task names.
- Network note: on the team's network, `spaceappschallenge.org` fails TLS verification in curl/WebFetch (untrusted root). Use the browser for that site. NASA POWER and GitHub work.

## Project subagents (`.claude/agents/`)
Planning phase: `project-manager`, `product-manager`, `ux-researcher`, `assumption-mapping`, `technical-writer`, `data-researcher`, `research-analyst`, `architect-reviewer`. Build phase: `mobile-developer`, `ui-designer`, `typescript-pro`, `python-pro`, `test-automator`, `accessibility-tester`, `code-reviewer`. See `docs/claude-setup.md` for when to use each.
