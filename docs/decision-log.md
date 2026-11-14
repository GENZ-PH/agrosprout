# Decision Log

> Every significant decision, with who decided and why. **The team owns these decisions.** Items marked *Proposed* came out of planning (with SI assistance, see `si-usage-log.md`) and need team confirmation at kickoff.
> Status: Proposed → Accepted / Changed / Rejected.

| ID | Decision | Options considered | Proposed choice & rationale | Status | Decided by / when |
|---|---|---|---|---|---|
| D1 | **Demo site** | Lanao del Norte lowland rice farm · a U.S. farm (rich USDA data) · both | **Lanao del Norte lowland point near Iligan.** Local judges, a strong smallholder impact story, matches the team's rice–mungbean idea. U.S.-only datasets get dropped. Exact coordinates TBD (must be lowland, see R5). | Proposed | |
| D2 | **Data backbone** | Google Earth Engine pipeline (initial plan) · NASA POWER API + AppEEARS extracts | **NASA POWER (verified, no auth) as Core; SMAP/MODIS/SRTM via AppEEARS as enrichment; ESA Sentinel-2 as partner data.** GEE optional. | Proposed | |
| D3 | **Where the logic runs** | Python API server · precompute + in-browser engine | **Precompute data in Python → static JSON; engine in TypeScript in the browser.** Offline, instant sliders, nothing to keep alive. | Proposed | |
| D4 | **Frontend stack** | React · Vue (both allowed by the initial plan) | **React + Vite + TS + vite-plugin-pwa**, unless the frontend lead is faster in Vue | Proposed | |
| D5 | **Admin/cooperative dashboard** | Full dashboard (initial plan) · single stretch page · cut | **Single stretch "Regional view" page.** The farmer flow is what gets scored. | Proposed | |
| D6 | **Demo format** | 7-slide deck · ≤30-s video | **7-slide deck**: comparisons and data read better | Proposed | |
| D7 | **Project name** | AgriResilience (initial) · AgroSprout (repo folder) · other | Team to choose; docs use **AgriResilience** for now | Open | |
| D8 | **Hosting** | GitHub Pages · Cloudflare Pages · Netlify | **GitHub Pages via Actions** (one account, public repo doubles as the "Final Project" link) | Proposed | |
| D9 | **Language** | English only · English + Cebuano | **English** (required); Cebuano labels as stretch | Proposed | |
| D10 | **Strategy set** | Single recommendation (initial plan) · Current + 2–3 alternatives | **Current + Best-for-water + Best-for-soil + Balanced-for-your-priorities**, which satisfies "≥3 including existing" | Proposed | |
| D11 | **Version control** | — | Init git, create a **public GitHub repo** at kickoff; `.gitignore` covers `pipeline/raw/`, `.netrc`, `.env` | Proposed | |
| D12 | **Accounts / login** | Accounts · no accounts | **No login, no account, no sign-up.** Farm data stays on the device. | **Accepted** | Team, 2026-11-14 |
| D13 | **Onboarding flow** | Single farm pin (earlier draft) · team flow | **Team flow**: plot lots on map (Lot 1..N) → crops per lot (many) → dashboard with explained data → optional planting months → your months vs better months side by side ([11](11-user-flow.md)) | **Accepted** | Team, 2026-11-14 |
| D3 rev. | **Where data comes from for a farmer's lot** | Precompute only (earlier D3) · live fetch | **Browser calls NASA POWER directly per lot** (CORS verified) + precomputed demo farm(s) as offline/demo fallback. Engine still runs in the browser. Supersedes the "precompute only" part of D3. | Proposed | |
| D14 | **Where farmer priorities live** (needed for challenge R4; not in the team flow) | Onboarding step · dashboard control · leave out | **Dashboard chips/sliders with equal defaults.** Keeps onboarding short. | Proposed | |
| D15 | **"Your crops" before months are given** | Hide comparison until S4 · assume typical calendar | **Assume a typical local planting calendar (labeled "assumed")** so ≥3 strategies incl. existing show on the dashboard even if the farmer skips S4 | Proposed | |
| D16 | **Optional lot details** (land type, water source, soil feel) | Ask · don't ask | **Ask in S1 with "I don't know" defaults.** Live lots only have coarse climate data, so these are what make lots differ. | Proposed | |
| D17 | **Transport constraint** | — | Farmer pins harvest destinations (market / storage / buyer / co-op), picks a transport mode, and the system **calculates travel time per lot**; this feeds a Market access score and explanations ([11](11-user-flow.md) S6, [07](07-rotation-engine.md) §3c) | **Accepted** | Team, 2026-11-14 |
| D18 | **How travel time is calculated** | Straight-line only · routing API only · layered | **Layered: farmer's own time > online road route (OSRM, CORS verified) > rough offline estimate**, always labeled with its source. Straight-line alone underestimates badly in hilly terrain (test: car route 2.8× straight line). | Proposed | |
| D19 | **Lot drawing** | Tap corners only · freehand sketch | **Freehand sketch → auto-converted clean plot → draggable points** as the main way; tap-corners and pin + area as alternatives | **Accepted** | Team, 2026-11-14 |
| D20 | **When destinations are asked** | During onboarding · add anytime later | **Not in onboarding.** Onboarding is S0 → S1 lots → S2 crops → dashboard. Destinations and transport (S6) are added later from the dashboard card or Edit farm. Market access stays off until then. | **Accepted** | Team, 2026-11-14 |
