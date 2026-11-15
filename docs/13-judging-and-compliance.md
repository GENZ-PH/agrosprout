# 13 — Judging criteria and our compliance

> **Status as of Sun Nov 15, 03:00 PHT**, checked against `main` at `c57afeb` and the open PRs. Written with SI (Claude Code) for the team; the team owns every decision and every status change.
> Rules come from the official guides, read 2026-11-14 (see [02-submission-and-judging.md](02-submission-and-judging.md)): [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/). The full action plan with examples from past winners is issue #150; this page is the one-screen scorecard.
>
> Status key: ✅ done and checked · ⚠ partly done or not yet checked · ❌ not done · ❓ unknown, someone must check.

## How to use this page

1. **Section 1 first.** One failed gate takes us out of Global Judging, whatever the score.
2. Section 2 says where we score points and where we lose them.
3. Sections 3 and 4 show that we meet the challenge and our own rules.
4. Section 5 is the to-do list with owners and times. Tick it as you go, and update the status when something changes.
5. At 18:00 someone who did **not** write the project page goes through sections 1 and 6 alone.

**What we submit:** the web app, built with Expo React Native, at https://agrosprout.pages.dev. Neither guide asks for an installable app: judges need a public link that opens without a login. An Android APK is **not required** and is listed under "What's next" in the form draft.

---

## 1. Eligibility gates (miss one and we are out)

| # | Gate (official rule) | Status | Evidence today | What closes it | Owner |
|---|---|---|---|---|---|
| G1 | **Submit for Judging** clicked before **Sun 23:59 PHT** | ❌ | Not submitted. Internal target 21:00 | Team owner submits at 21:00 and confirms the page shows "submitted" | Team owner (#54) |
| G2 | Every member registered for the **Iligan City** Local Event, **6 members at most**, nobody waitlisted | ❓ | The team table in [docs/README.md](README.md) is still empty | Team lead checks each profile on the Space Apps site and fills the table | Team lead (#16) |
| G3 | **Every required form field filled** | ⚠ | Final text in [submission/fields.md](submission/fields.md), demo link included. Paste into the form | Team owner pastes and checks every field | Team owner |
| G4 | **English** for the form and everything it links (a video in another language needs English subtitles) | ⚠ | App, docs and drafts are English; the i18n work (#37) is not on `main` | Keep the demo in English, or add English captions | Story |
| G5 | **Demo within limits:** video **≤ 30 s**, or deck **≤ 7 slides including title and intro** | ✅ | 7-slide deck: [submission/demo-deck.pdf](submission/demo-deck.pdf) (D6) | Keep it at 7 slides | Story |
| G6 | **Links public**, no login or permission request | ✅ | Web app, repo (public, MIT) and the deck PDF on GitHub open without login | Open each link in a private window before submitting | Team owner |
| G7 | **At least one NASA data source** used and named (needed for Global Awards) | ✅ | NASA POWER drives every result (`mobile/src/data/power.ts`); named in the app, README, `THIRD_PARTY.md` and the form draft | Keep it named on the page | Data |
| G8 | **No image, video, audio or likeness of anyone under 18** | ⚠ | The 10 bundled crop pictures (#172, `mobile/assets/crops/`) were checked: plants only, no people. A crop added from search shows Wikipedia's lead picture, which we do not control. The demo video is not made yet | In the demo, use library crops only; check every frame of the video | Story |
| G9 | **No NASA logos, flags or mission insignia** in SI-generated content; SI images and video **watermarked** | ⚠ | The logo is the team's own work (team brand folder), not SI. The crop pictures are Wikimedia Commons photos, credited in `THIRD_PARTY.md`. No SI images in the app | Any SI image in the demo or on the page gets a visible "SI-generated" mark; no NASA logos anywhere | Story |
| G10 | Links still work through **Jan 2027** (Global Winners announced Jan 26, 2027). Team choice, not an official rule | ✅ | Primary link is `agrosprout.pages.dev`: no domain to renew | Use the pages.dev link as primary on the form | Frontend |

**Not done: G1, G5. Unknown: G2.** These come before any polish work.

---

## 2. Judging rubric (each criterion scored 1 to 5, at every level)

Most of the score comes from the **project page and the full project**, not only the demo (Judging Guide).

| Criterion | A "5" looks like | Our evidence today | Where we lose points | Fix before submit | Owner |
|---|---|---|---|---|---|
| **Impact** | A significant problem; broad reach; could change lives | Smallholder farmers in Lanao del Norte. Runs in any phone browser with nothing to install and no account; saved results work offline (service worker). Sourced figures in the form draft: PSA 2022 Census of Agriculture and Fisheries (7.73 million farms, 55.8% under 0.5 ha) and the PAGASA El Niño advisory | Not tested with real farmers yet | Say plainly on the page who uses it and when (this El Niño season); farmer testing goes under "What's next" | Story |
| **Creativity** | Novel, or a clear step beyond existing tools | Sketch your own lots with a finger; compare your crops with 3 other rotations per lot; plain-words "why" on every option; NASA data panel names the dataset and formula behind each number; what-if for drier or warmer years | Judges miss it if the demo opens on a form | First 10 s of the demo: lot drawn, best plan shown, NASA data panel open | Story |
| **Validity** | Scientifically sound, technically feasible, usable | FAO-56 evaporation, FAO Training Manual No. 3 effective rain, FAO Ecocrop temperature ranges, with source comments in `mobile/src/engine/params.ts`; confidence level and "check locally" on every option; 482 automated tests pass on `main` | The erosion slope factor by land type is marked "assumption: validate locally (no source)" in `params.ts`; engine sanity review not run yet (#32); no bug bash yet (#46) | Run #32 at 20:00 and #46 in the morning; call the slope factor an assumption on the page | Data, Engine, All |
| **Relevance** | Fully answers the challenge; NASA data is the core, not decoration | R1 to R8 covered (section 3). NASA POWER drives every score and the calendar; SRTM, GPM IMERG and SMAP L4 add checks on the sample farm | Lots the farmer draws use NASA POWER only; **GPM IMERG is missing from `README.md` and `THIRD_PARTY.md`**; the app lists MODIS as "Not used" (no MODIS data is bundled) | Add IMERG to README and `THIRD_PARTY.md` (#52); the NASA Data field names each dataset, what it feeds and where it shows | Data |
| **Presentation** | A clear, engaging story: challenge, solution, why it matters. Demo **and** full project | Working app with a sample farm (no signal needed); README; form draft | **No demo yet**; no screenshots; ~~two names~~ (fixed: D7 decided AgroSprout, 2026-11-15; was "AgriResilience" in the README and form draft, "AgroSprout" in the branding PR (#178) | Decide D7 and use one name everywhere; screenshots from the frozen build; make the demo | Story |

**Biggest risk: Presentation (no demo, two names).** Biggest strength: Validity and Relevance (sourced methods, NASA data behind every number).

---

## 3. Challenge requirements (R1 to R8 from [01-challenge-brief.md](01-challenge-brief.md))

| # | Requirement | Status | Where it is in the app |
|---|---|---|---|
| R1 | A decision-support tool (app, model, map) | ✅ | Web app (Expo React Native) at the judges' link, on phones and laptops |
| R2 | Uses NASA datasets | ✅ | NASA POWER monthly (lots the farmer draws) and daily (sample farm); SRTM v3, GPM IMERG and SMAP L4 (sample farm). Listed in `mobile/src/content/sources.ts` and on the Data and limits page |
| R3 | Analyzes temperature, heat stress, rain, soil moisture, evaporation, extreme rain | ✅ | Engine scores and the calendar from NASA POWER; heavy-rain days on the sample farm. Frost is not modelled (the app checks each crop's lower temperature limit) and vegetation stress is not measured; the app says both |
| R4 | Local soil, crop traits and **farmer priorities** | ✅ | Crop library with sourced traits (`mobile/assets/data/crops.json`); priorities under "Adjust results"; land type from the farmer. No soil map yet (stated as a limit) |
| R5 | Bare-field periods, vulnerable seasons, rotation chances | ✅ | "Months with bare soil", "Dry months (crop short of water)", washout risk; year calendar per lot |
| R6 | **At least 3 strategies including the farmer's own** | ✅ | Option A (your crops) plus B best for water, C best for soil, D balanced |
| R7 | For each: why, evidence, benefits, gaps, risks for local review | ✅ | Every option: Why, Evidence, Benefits, Trade-offs, What we don't know, Check locally, Confidence |
| R8 | Supports and does not replace the farmer | ✅ | Start screen: "This app supports, and does not replace, your own judgment and your agricultural technician"; "check locally" on every option |

Optional considerations we also cover: jargon explained (ⓘ on every card, Learn page); uncertainty shown (confidence levels, assumptions labeled); what-if for rain and temperature; farm map colored by crop fit; satellite vs model comparison (IMERG vs POWER rain on the sample farm).

---

## 4. Our own rules ([.claude/CLAUDE.md](../.claude/CLAUDE.md))

| Rule | Status | Check |
|---|---|---|
| 1. Say "SI", not "AI", in everything submitted | ⚠ | `git grep -nwI "AI" -- mobile/app mobile/src README.md docs/submission` finds nothing on `c57afeb`. Run it again after the last merge, and check the demo and the form |
| 2. Log every SI use; the team owns decisions | ⚠ | `docs/si-usage-log.md` is current; the final "Use of SI" answer is still open (#53) |
| 3. No invented numbers | ⚠ | Engine values carry sources in `params.ts`; the slope factor is a labeled assumption. Check every number on the page and in the demo against a source |
| 4. No NASA logos; SI images watermarked; no one under 18 | ⚠ | See G8 and G9 |
| 5. English only | ✅ | See G4 |
| 6. Supports, does not replace | ✅ | See R8 |
| 7. Scope discipline | ⚠ | Feature freeze 12:00; fixes only after that |
| 8. No login, no backend storage; location rounded (POWER 0.1°, OSRM about 100 m) | ✅ | `roundForPower` in `mobile/src/data/power.ts`, `roundForRoute` in `mobile/src/data/routing.ts` |
| 9. Travel defaults labeled as assumptions; the farmer's own time wins | ✅ | `params.ts` and the Places screen |

---

## 5. Actions to close the gaps (PHT, Sun Nov 15)

| By | Action | Gate or criterion | Owner | Issue |
|---|---|---|---|---|
| 09:00 | Decide **D7 name** (AgroSprout or AgriResilience) and **D6 demo format** (7-slide deck or 30 s video) | G3, G5, Presentation | Team | #15, #150 |
| 09:00 | Close the APK issues (#38, #50) or mark them "after the hackathon" | Scope | RomartM | #38, #50 |
| 10:00 | Check every member's registration at the Iligan City event; fill the team table | G2 | Team lead | #16 |
| 10:00 | Bug bash on a phone browser and a laptop browser | Validity | All | #46 |
| 11:30 | Merge what is approved: El Niño wording (#174, approved), branding (#178, review needed), shorter phone dashboard (branch `fix/mobile-concise`, PR not opened yet) | Presentation | Authors | |
| **12:00** | **Feature freeze** | | All | |
| 13:00 | Screenshots from the frozen build (phone size, sample farm; reload once so the offline copy updates) | Presentation | Story | #51 |
| 15:00 | Make the demo within its limit, in English; share as "anyone with the link" | G5, G4 | Story | #51 |
| 16:00 | README and `THIRD_PARTY.md`: one name; add GPM IMERG; drop the README's "Android APK" row and its "in progress" line | Relevance, Presentation | Data, Story | #52 |
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
- [ ] Demo within its limit, English, with the team name, member names and the challenge, and NASA data visible on screen
- [ ] One project name in the app, README, form and demo
- [ ] NASA Data field lists POWER, SRTM, GPM IMERG and SMAP with exact links and what each feeds
- [ ] README, `THIRD_PARTY.md` and the SI log final; repo public
- [ ] Submitted by 21:00; buffer kept until 23:59
