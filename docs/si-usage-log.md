# SI (Super Intelligence) Usage Log

> **Required for submission.** The project form asks whether and how SI tools were used. Judges can also see any SI markers *inside* the project.
> Rules recap ([02](02-submission-and-judging.md#si-ai-usage-rules)): SI may speed up development and creative work, but **must not be used to come up with the idea for how to solve the challenge**. SI images and video need a **visible watermark**. SI code, data, and audio must be **acknowledged in descriptive text + metadata**. **No NASA branding** in generated content.
> Log entries as you go: one line per meaningful use.

## Origin of the concept

- The AgriResilience concept (offline-first PWA, NASA-driven crop rotation calendar, cloud processing with an offline client) comes from the team's initial proposal: `docs/reference/initial-proposal.md`.
- **Team to state here how the initial proposal was written** (e.g. "written by <member(s)> on <date>", plus any tools used to format or edit it), so the disclosure is complete and accurate.

## Log

| Date (PHT) | Who | SI tool | What it was used for | Output location | Human review |
|---|---|---|---|---|---|
| 2026-11-14 | (team member running the session) | Claude Code (Anthropic Claude) | Read the challenge, resources, submission, and judging pages; checked the initial proposal against the requirements; drafted planning docs (scope, architecture, engine spec, schedule, risks); checked NASA POWER API access; installed planning subagents from VoltAgent/awesome-claude-code-subagents (MIT) | `docs/*`, `.claude/*` | Team reviews and accepts or changes every decision in `decision-log.md` |
| 2026-11-14 | (same) | Claude Code | Wrote up the **team-defined** onboarding flow (no login; map lots → crops → dashboard → months → side-by-side) in `11-user-flow.md` and updated scope, architecture, engine, schedule, and risks to match; checked NASA POWER CORS + monthly endpoint; suggested D14–D16 for the team to decide | `docs/11-user-flow.md`, `docs/0*.md`, `decision-log.md` | Flow designed by the team; suggestions pending team decision |
| 2026-11-14 | (same) | Claude Code | Wrote up two **team-defined** features: (1) harvest destination + transport mode + travel time constraint, (2) freehand lot sketch → clean plot → draggable points. Specified the travel-time method and market-access score, the sketch-to-polygon pipeline; tested OSRM routing reachability/CORS; suggested D18 | `docs/05,06,07,08,10,11`, `decision-log.md` | Features defined by the team; D18 pending team decision |
| 2026-11-14 | (same) | Claude Code | Moved harvest destinations out of onboarding into an add-anytime step (S6) per the **team's** decision (D20); updated flow, scope, engine, schedule references | `docs/05,06,07,08,11`, `decision-log.md`, `.claude/CLAUDE.md` | Team decision |
| 2026-11-14 | (same) | Claude Code | Compared the challenge Resources tab with `03-data-sources.md` (no changes needed) and tested GIBS, Open-Meteo, OpenTopoData, and SoilGrids reachability and CORS; recorded results | `docs/03-data-sources.md` | Team decides which sources to adopt |
| 2026-11-14 | (same) | Claude Code (with the `data-researcher` subagent) | Researched Philippine data sources (PSA, BSWM, PhilRice, PAGASA, NOAA, hazard archives); verified PSA OpenSTAT, NOAA ONI and a hazard-layer file by `curl`; recorded results | `docs/03-data-sources.md` | Team decides which sources to adopt |
| 2026-11-14 | (same) | Claude Code | Listed the gaps to decide before building (tiered decision list D21–D30); recorded the **team's** choices (Expo React Native for Android + web, Leaflet + Terra Draw in a WebView, folder ownership + short PRs); rewrote the architecture doc and updated schedule, scope, risks, and CLAUDE.md to match | `docs/06`, `docs/08`, `decision-log.md`, other docs, `.claude/CLAUDE.md` | Choices made by the team; open items pending |
| 2026-11-14 | (same) | Claude Code | Read the new decision log and architecture; drafted proposed data-contract additions (PSA yields, province field, SRTM terrain handling, climate context, source-by-platform table) for the Data lead | `docs/03-data-sources.md` | Proposals only; team and Data lead decide |

## How we'll mark SI use in the project

- **README** section "Use of SI": which tools, for what, which files.
- **Code**: commit trailer `Co-Authored-By: <SI tool>` on SI-assisted commits, plus a header comment in files that are largely SI-generated.
- **Images**: visible "SI-generated" watermark on the image itself.
- **In-app SI text** (if we ship SI-written explanations): a label "SI-generated summary, reviewed by the team".

## Draft answer for the "Use of SI" form field (update before submitting)

> We used SI tools as assistants, not to originate the idea. Claude Code (Anthropic) helped us research the challenge materials, organize our planning documents, and write and review code. [List other tools.] The rotation concept, design decisions, and agronomic rules were chosen by our team. SI-assisted code is marked in commit metadata and file headers; SI-generated images carry a visible watermark. No NASA branding appears in any SI-generated content.
