# 13 — Judging criteria and our compliance

> **Status as of Sun Nov 15, 02:30 PHT**, checked against `main` at `76f99c2` and the open PRs. Written with SI (Claude Code) for the team; the team owns every decision and every status change.
> Rules come from the official guides, read 2026-11-14 (see [02-submission-and-judging.md](02-submission-and-judging.md)): [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/). The full action plan with owners and examples from past winners is issue #150; this page is the one-screen scorecard.
>
> Status key: ✅ done and checked · 🟡 partly done or not yet checked · ❌ not done · ❓ unknown, someone must check.

## How to use this page

1. **Section 1 first.** One failed gate takes us out of Global Judging, whatever the score.
2. Section 2 says where we score points and where we lose them.
3. Sections 3 and 4 show that we meet the challenge and our own rules.
4. Section 5 is the to-do list with owners and times. Tick it as you go, and update the status key when something changes.
5. At 18:00 someone who did **not** write the project page goes through sections 1 and 6 alone.

---

## 1. Eligibility gates (miss one and we are out)

| # | Gate (official rule) | Status | Evidence today | What closes it | Owner |
|---|---|---|---|---|---|
| G1 | **Submit for Judging** clicked before **Sun 23:59 PHT** | ❌ | Not submitted. Internal target 21:00 | Team owner submits at 21:00 and confirms the page shows "submitted" | Team owner (#54) |
| G2 | Every member registered for the **Iligan City** Local Event, **6 members at most**, nobody waitlisted | ❓ | The team table in [docs/README.md](README.md) is still empty | Team lead checks each profile on the Space Apps site and fills the table | Team lead (#16) |
| G3 | **Every required form field filled** | 🟡 | All fields drafted in [submission/fields.md](submission/fields.md); demo link and APK link are `TBD`; project name waits on D7 | Fill the two links and the name; paste into the site | Story (#16) |
| G4 | **English** for the form and everything it links (video only with English subtitles) | 🟡 | App, docs and drafts are English. The i18n issue (#37) is not on `main` | Keep the demo in English or add English captions | Story |
| G5 | **Demo within limits:** video **≤ 30 s**, or deck **≤ 7 slides including title and intro** | ❌ | Script ready: [submission/demo-video-script.md](submission/demo-video-script.md). Nothing recorded. Format (D6) not decided | Decide D6 (video recommended), record, check the length | Story (#51) |
| G6 | **Links public**, no login or permission request | 🟡 | Web app is public: https://agrosprout.pages.dev. **Repo is PRIVATE.** Demo link does not exist yet | Make the repo public after the secrets scan (20:00); share the video as "anyone with the link"; open every link in a private window on a phone | Team lead (#54) |
| G7 | **At least one NASA data source** used and named (needed for Global Awards) | ✅ | NASA POWER drives every result (`mobile/src/data/power.ts`); named in the app, README, `THIRD_PARTY.md` and the drafts | Nothing; keep it named on the page | Data |
| G8 | **No image, video, audio or likeness of anyone under 18** | 🟡 | The app has no photos of people. The crop pictures PR (#172) and the demo video are not checked yet | Check #172's images and the video before submitting | Story |
| G9 | **No NASA logos, flags or mission insignia** in SI-generated content; SI images and video **watermarked** | 🟡 | The logo is the team's own work (team brand folder), not SI. No SI images are in the app today | Any SI image in the deck, video or page gets a visible "SI-generated" mark; no NASA meatball or worm anywhere | Story |
| G10 | Links still work through **Jan 2027** (Global Winners announced Jan 26, 2027). Team choice, not an official rule | ✅ | Primary link is `agrosprout.pages.dev` (no domain to renew) | Use the pages.dev link as primary on the form | Frontend |

**Gates that are not done yet: G1, G5. Unknown: G2.** These come before any polish work.

---

## 2. Judging rubric (each criterion scored 1 to 5, at every level)

Most of the score comes from the **project page and the full project**, not only the demo (Judging Guide).

| Criterion | A "5" looks like | Our evidence today | Where we lose points | Fix before submit | Owner |
|---|---|---|---|---|---|
| **Impact** | A significant problem; broad reach; could change lives | Smallholder farmers in Lanao del Norte; no login, works offline once loaded, runs on a phone browser. Sourced figures in the draft: PSA 2022 Census of Agriculture and Fisheries (7.73 million farms, 55.8% under 0.5 ha), PAGASA El Niño advisory | No Android APK yet (#50); no real farmer feedback | Ship the APK; say plainly on the page who uses it and when (this El Niño season) | Frontend, Story |
| **Creativity** | Novel, or a clear step beyond existing tools | Sketch your own lots with a finger; compare your crops with 3 other rotations per lot; plain-words "why" on every option; NASA data panel shows the source and formula behind each number; what-if for drier or warmer years | Judges will not find it if the demo opens on a form | First 10 s of the demo: lot drawn, best plan shown, NASA data panel open | Story |
| **Validity** | Scientifically sound, technically feasible, usable | FAO-56 evaporation, Brouwer effective rain, FAO Ecocrop temperature ranges; each coefficient has a source comment in `mobile/src/engine/params.ts`; assumptions labeled; confidence level and "check locally" on every option; 462 automated tests pass | The erosion slope factor is a labeled team assumption with no source; sanity review not run yet (#32); no bug bash on a real Android phone (#46) | Run #32 at 20:00; bug bash #46; keep the erosion factor labeled as an assumption on the page | Data, Engine, All |
| **Relevance** | Fully answers the challenge; NASA data is the core, not decoration | R1 to R8 covered (section 3). NASA POWER drives every score and the calendar; SRTM, GPM IMERG and SMAP L4 add checks on the sample farm | Live lots use NASA POWER only; IMERG is missing from `README.md` and `THIRD_PARTY.md`; MODIS has a chart slot but no bundled data, so the app lists it as "Not used" | Add IMERG to README and THIRD_PARTY (#52); the NASA Data field names each dataset, what it feeds and where it is shown | Data |
| **Presentation** | A clear, engaging story: challenge, solution, why it matters. Demo **and** full project | Working app with a sample farm (no signal needed); full README; drafted project page | **No demo yet**; screenshots not taken; the name differs: "AgriResilience" in README and drafts, "AgroSprout" in the branding PR (#178) | Decide D7, then one name everywhere; take screenshots from the frozen build; record the video | Story |

**Biggest risk to the score: Presentation (no demo, two names).** Biggest strength: Validity and Relevance (sourced methods, NASA data behind every number).

---

## 3. Challenge requirements (R1 to R8 from [01-challenge-brief.md](01-challenge-brief.md))

| # | Requirement | Status | Where it is in the app |
|---|---|---|---|
| R1 | A decision-support tool (app, model, map) | ✅ | Expo app: web build at the judges' link; Android APK in progress (#50) |
| R2 | Uses NASA datasets | ✅ | NASA POWER monthly (live lots) and daily (sample farm); SRTM v3, GPM IMERG, SMAP L4 (sample farm). Listed in `mobile/src/content/sources.ts` and on the Data and limits page |
| R3 | Analyzes temperature, heat stress, rain, soil moisture, evaporation, extreme rain | ✅ | Engine scores and the calendar from NASA POWER; heavy-rain days on the sample farm. Frost is not relevant at this latitude; vegetation stress is not measured (stated in the app) |
| R4 | Local soil, crop traits and **farmer priorities** | ✅ | Crop library with sourced traits (`mobile/assets/data/crops.json`); priorities in "Adjust results"; land type from the farmer. No soil map yet (stated as a limit) |
| R5 | Bare-field periods, vulnerable seasons, rotation chances | ✅ | "Months with bare soil", "Dry months (crop short of water)", washout risk; year calendar per lot |
| R6 | **At least 3 strategies including the farmer's own** | ✅ | Option A (your crops) plus B best for water, C best for soil, D balanced |
| R7 | For each: why, evidence, benefits, gaps, risks for local review | ✅ | Every option: Why, Evidence, Benefits, Trade-offs, What we don't know, Check locally, Confidence |
| R8 | Supports and does not replace the farmer | ✅ | Start screen footer, "Talk it over with your agricultural technician", "check locally" on every option |

Optional considerations we also cover: jargon explained (ⓘ on every card, Learn page); uncertainty shown (confidence levels, assumptions labeled); what-if for rain and temperature; farm map colored by crop fit; satellite vs model comparison (IMERG vs POWER rain on the sample farm).

---

## 4. Our own rules ([.claude/CLAUDE.md](../.claude/CLAUDE.md))

| Rule | Status | Check |
|---|---|---|
| 1. Say "SI", not "AI", in everything submitted | 🟡 | `git grep -nwi "AI" -- mobile/app mobile/src README.md docs/submission` finds nothing at 02:30. Run it again after the last merge, and read the video captions and the form |
| 2. Log every SI use; the team owns decisions | 🟡 | `docs/si-usage-log.md` is current through the branding and phone-layout work; finalize the "Use of SI" answer (#53) |
| 3. No invented numbers | 🟡 | Engine coefficients sourced in `params.ts`; the erosion slope factor is a labeled assumption. Check every number on the page and in the video against a source |
| 4. No NASA logos; SI images watermarked; no one under 18 | 🟡 | See G8 and G9 |
| 5. English only | ✅ | See G4 |
| 6. Supports, does not replace | ✅ | See R8 |
| 7. Scope discipline | 🟡 | Feature freeze 12:00; after that, fixes only |
| 8. No login, no backend storage; location rounded (POWER 0.1°, OSRM about 100 m) | ✅ | `mobile/src/data/power.ts`, `mobile/src/data/routing.ts` |
| 9. Travel defaults labeled as assumptions; the farmer's own time wins | ✅ | `params.ts` and the Places screen |

---

## 5. Actions to close the gaps (PHT, Sun Nov 15)

| By | Action | Gate or criterion | Owner | Issue |
|---|---|---|---|---|
| 09:00 | Decide **D7 name** (AgroSprout or AgriResilience) and **D6 demo format** (30 s video recommended) | G3, G5, Presentation | Team | #15, #150 |
| 10:00 | Check every member's registration at the Iligan City event; fill the team table | G2 | Team lead | #16 |
| 10:00 | Bug bash on a real Android phone and the web build | Validity | All | #46 |
| 11:30 | Merge approved PRs: branding (#178), El Niño wording (#174), crop pictures (#172, after the under-18 check), phone layout | Presentation, G8 | Authors | |
| **12:00** | **Feature freeze** | | All | |
| 13:00 | Screenshots from the frozen build (phone size, sample farm; reload once for the service worker) | Presentation | Story | #51 |
| 15:00 | Record and caption the video (≤ 30 s, English); share as "anyone with the link"; check the length | G5, G4 | Story | #51 |
| 16:00 | README and THIRD_PARTY: one name, IMERG added, APK link | Relevance, G3 | Data, Story | #52 |
| 17:00 | Final "Use of SI" answer from the log | Rule 2 | Story | #53 |
| 18:00 | Second person checks sections 1 and 6 of this page, alone | All gates | Not the page author | #150 |
| 20:00 | Engine sanity review | Validity | Data | #32 |
| 20:00 | Secrets scan (gitleaks), then make the repo public | G6 | Team lead | #54 |
| **21:00** | **Submit for Judging**; confirm it shows as submitted | G1 | Team owner | #54 |
| 21:00 to 23:00 | Buffer: fix broken links only | | All | |

---

## 6. Final sign-off (tick on submit day)

- [ ] G1 to G10 all ✅, checked by a second person
- [ ] Every link on the form opens in a private window on a phone and on a laptop
- [ ] Demo ≤ 30 s (or ≤ 7 slides), English, team name, member names and the challenge shown, NASA data visible on screen
- [ ] One project name in the app, README, form and demo
- [ ] NASA Data field lists POWER, SRTM, GPM IMERG and SMAP with exact links and what each feeds
- [ ] README, `THIRD_PARTY.md` and the SI log final; repo public
- [ ] Submitted before 21:00; buffer kept until 23:59
