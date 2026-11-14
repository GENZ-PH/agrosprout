# 08 — 40-Hour Work Plan (all times PHT, UTC+8)

> Hard deadline: **Sun Nov 15, 11:59 PM PHT**. **Internal submit target: Sun 9:00 PM PHT.** The last 3 hours are buffer only.
> ⚠️ **First action:** ask the Iligan City Local Lead whether **local judging or presentations** happen earlier than the global deadline. If they do, move every milestone below earlier.

## Roles (4 tracks; merge if the team is smaller)

| Track | Owns | Merge rule |
|---|---|---|
| **Data lead** | `pipeline/`, site JSON, crop library + citations, AppEEARS/Sentinel-2 extracts, `03-data-sources.md` | With 3 people: Data + Engine |
| **Engine lead** | `app/src/engine/`, params + tests, explanation templates, `07-rotation-engine.md` | With 2 people: Data + Engine and Frontend + Story |
| **Frontend/UX lead** | App shell, screens, charts, PWA/offline, deploy | — |
| **Story lead** | Persona, copy and microcopy, Learn page, demo deck, README, submission fields, `si-usage-log.md` | Everyone reviews the final deck |

Team member names → fill in `docs/README.md` (they're needed on the demo slides).

## Timeline

```mermaid
gantt
  title 40-hour plan (PHT, UTC+8)
  dateFormat YYYY-MM-DD HH:mm
  axisFormat %a %H:%M
  todayMarker off

  section Milestones
  Kickoff and decisions             :milestone, m0, 2026-11-14 08:00, 0d
  Submission opens                  :milestone, m1, 2026-11-14 09:00, 0d
  Checkpoint 1 - contracts frozen   :milestone, m2, 2026-11-14 13:00, 0d
  Checkpoint 2 - end to end         :milestone, m3, 2026-11-14 20:00, 0d
  Feature freeze                    :crit, milestone, m4, 2026-11-15 12:00, 0d
  Internal submit target            :crit, milestone, m5, 2026-11-15 21:00, 0d
  Hard deadline                     :crit, milestone, m6, 2026-11-15 23:59, 0d

  section Data
  Accounts, AppEEARS request, farm point    :d0, 2026-11-14 08:00, 1h
  POWER fetch, ET0, demo farm build         :d1, 2026-11-14 09:00, 4h
  Crop library, calendar, routing           :d2, 2026-11-14 14:00, 6h
  SMAP and NDVI enrichment, Sentinel-2      :d3, 2026-11-14 21:00, 4h

  section Engine
  Engine skeleton                           :e0, 2026-11-14 08:00, 1h
  Water balance and crop fit                :e1, 2026-11-14 09:00, 4h
  Scores, rotations, market access          :e2, 2026-11-14 14:00, 6h
  Planting-window scan, confidence          :e3, 2026-11-14 21:00, 4h

  section Frontend
  Repo, scaffold, first deploy              :f0, 2026-11-14 08:00, 1h
  S0, S1 sketch to plot, S2 crops           :f1, 2026-11-14 09:00, 4h
  S3 dashboard and S6 places                :f2, 2026-11-14 14:00, 6h
  S4 months, S5 side by side, offline       :f3, 2026-11-14 21:00, 4h

  section Story
  Local Lead check, SI log                  :s0, 2026-11-14 08:00, 1h
  Persona, wireframes, explainer list       :s1, 2026-11-14 09:00, 4h
  Explainer texts, Learn, Data and Limits   :s2, 2026-11-14 14:00, 6h
  README v1, description draft              :s3, 2026-11-14 21:00, 4h

  section Whole team
  Lunch and sync                            :t0, 2026-11-14 13:00, 1h
  Dinner and sanity review                  :t1, 2026-11-14 20:00, 1h
  Sleep in shifts                           :t2, 2026-11-15 01:00, 6h
  Polish, should-haves, bug bash            :t3, 2026-11-15 07:00, 5h
  Demo deck, screenshots, final README      :t4, 2026-11-15 12:00, 4h
  Submission drafting                       :t5, 2026-11-15 16:00, 3h
  Final QA and submit                       :crit, t6, 2026-11-15 19:00, 2h
  Buffer only                               :t7, 2026-11-15 21:00, 2026-11-15 23:59
```

### Saturday Nov 14

| Time | Block | Data | Engine | Frontend/UX | Story | Exit criteria |
|---|---|---|---|---|---|---|
| **08:00–09:00** | Kickoff | Make Earthdata accounts. **Submit the AppEEARS request.** Pick the demo farm point. | Read 07, set up the TS engine skeleton | Create git repo + GitHub, Vite PWA scaffold, deploy "hello" page | Read 01/02, message the Local Lead, start `si-usage-log.md` | **Decisions D1–D10 confirmed** (decision log). Repo is public. Deploy pipeline works. |
| 09:00 | — | — | — | — | — | *Submission opens. Create the project page and fill the Project Name early.* |
| **09:00–13:00** | Build 1 | **`app/src/data/power.ts`** (live monthly POWER fetch + parse, mm/day→mm, skip `13`, handle `-999`) + **`et0.ts`** (FAO-56 monthly) · Python `build_demo.py` for 1 demo farm | Water balance + crop fit on mock lot data, unit tests | **S0 Welcome + S1 map**: **freehand sketch → clean plot → draggable points**, tap-corners, pin fallback, multi-lot, live area + **S2 crops per lot**; IndexedDB store | Persona (2 lots), wireframes S0–S5, list of ⓘ explainers needed, slide template | **13:00 Checkpoint 1: data contracts frozen**; drawing a lot on a phone works; live fetch returns real data |
| 13:00–14:00 | Lunch + sync | | | | | Agree what's cut if behind |
| **14:00–20:00** | Build 2 | Crop library (8–12 crops, cited) **+ typical local planting calendar + perishability per crop**; demo farm enrichment (SRTM, trends); `routing.ts` (OSRM + offline estimate) | Scores, weights, A/B/C/D rotation options, **Market access (`access.ts`)**, explanation templates | **S6 destinations (add-anytime, from dashboard card / Edit farm) + transport + travel-time confirm**; **S3 Dashboard** per lot (incl. "Getting your harvest out" card); wired to engine + live data | **ⓘ explainer texts** for every dashboard card (incl. travel time); Learn + Data & Limits pages; disclaimers | **20:00 Checkpoint 2: S0→S3 end-to-end with real data** (ugly is OK) |
| 20:00–21:00 | Dinner + **sanity review** | Run the 07 §7 checks as a group | | | | Results believable? If not, fix the data before the UI |
| **21:00–01:00** | Build 3 | AppEEARS SMAP/NDVI into demo farm (if ready); Sentinel-2 image | **Planting-window scan** (07 §3b), confidence (P20/P80) | **S4 months picker + S5 side-by-side**; offline/PWA precache, mobile layout | S5 explainer texts, README v1, Detailed Description draft | S0→S5 works; dashboard opens offline on a phone |
| 01:00–07:00 | **Sleep in shifts** | At least 4–5 h each. Tired teams ship bugs. | | | | |

### Sunday Nov 15

| Time | Block | Focus | Exit criteria |
|---|---|---|---|
| **07:00–12:00** | Build 4 / Polish | Should-haves (SMAP vs POWER chart, NDVI bare-period view), accessibility (contrast, font size, tap targets), microcopy pass, bug bash | All Must + chosen Should items done |
| **12:00** | 🧊 **FEATURE FREEZE** | Only bug fixes after this | |
| 12:00–16:00 | Demo build | Screenshots or recording from the **deployed** app, 7-slide deck ([09](09-demo-plan.md)), final README, THIRD_PARTY.md | Deck reviewed by the whole team |
| 16:00–19:00 | Submission drafting | Fill every form field from `docs/submission/fields.md`; SI disclosure; NASA + partner data lists | Every link tested in incognito |
| 19:00–21:00 | Final QA + **Submit** | Final phone test offline; confirm all members registered at Iligan City; **click "Submit for Judging"** | ✅ **Submitted by 21:00** |
| 21:00–23:59 | Buffer | Emergencies only. Edits still count until 23:59, but don't risk a broken state. | |

## Checkpoint protocol (5 minutes each)

1. Demo the current state from the **deployed URL**, not localhost.
2. Each track: done, blocked, next.
3. If behind, **cut from the bottom of MoSCoW**. Never push the freeze or the submit time.

## Cut order if we fall behind

1. Regional map → 2. Cebuano labels → 3. SI summaries → 4. clustering → 5. ECOSTRESS → 6. fare/transport cost → 7. "Straighten?" → 8. backup/restore file → 9. NDVI view → 10. SMAP chart → 11. 3-year SHI chart → 12. scenario slider → 13. wet-season roads → 14. trips per harvest → 15. online routing (keep estimate + farmer confirm) → 16. priority chips → 17. optional lot details.
**Never cut:** short no-login onboarding (lots → crops → dashboard), draggable plot points, add-later harvest destination + transport + travel time, dashboard with ⓘ explainers, ≥3 rotation options including "your crops", your-months-vs-better-months, offline after onboarding, disclaimers, NASA data provenance, submission QA.
**If freehand sketching is fighting us by Sat 13:00:** make **tap-corners** the main way (same draggable points afterward) and keep the sketch as a bonus. If all drawing fails, "drop a pin + type area".
