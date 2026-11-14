# 02 — Submission Requirements & Judging Rubric

> Sources (read 2026-11-14): [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/), [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/), [Participant FAQs](https://www.spaceappschallenge.org/resources/participant-faqs/).

## Hard rules (missing any one means no Global Judging)

- [ ] **Click "Submit for Judging" before Sun Nov 15, 11:59 PM PHT.** Anything saved after that is ineligible. **Our internal target: submitted by 9:00 PM PHT.**
- [ ] **All team members are confirmed participants at the same Local Event (Iligan City).** Check that nobody is waitlisted.
- [ ] **Every required form field is filled.**
- [ ] **Everything is in English**: the form and all linked materials. A video may be in another language only with English subtitles. Slides must be in English.
- [ ] **Demo stays within limits**: video of **30 seconds or less**, OR a deck of **at most 7 slides including the title and intro slides**. Going over makes the project ineligible.
- [ ] **Links are public**: no password, permission request, or registration. Test them in an incognito window.
- [ ] **At least one NASA data source or resource** is used and named (required for Global Awards).
- [ ] **No images, video, audio, or likeness of anyone under 18** in the demo or project.
- [ ] **SI-generated content contains no NASA branding** (logos, flags, mission identifiers).

## Project page form fields → owner and draft location

| Field | What it needs | Draft in | Owner |
|---|---|---|---|
| Project Name | Short name | `docs/submission/fields.md` | Story lead |
| High-Level Project Summary | What we built, how it addresses the challenge, why it matters | same | Story lead |
| Link to Project Demo | Public link to the ≤7-slide deck or ≤30-second video (YouTube/Drive/GitHub…). It **can't be uploaded to the Space Apps site.** | same | Story lead |
| Link to Final Project | Public link: **web build URL** for judges, plus the **Android APK link** and the public GitHub repo (README links to both) | same | Frontend lead |
| Detailed Project Description | What it does, how it works, benefits, goals, tools/languages/hardware/software used | same | Everyone, edited by Story lead |
| Use of SI | Whether and how SI tools were used. **Judges don't see this answer**, but they **do** see the SI markers inside the project. | `docs/si-usage-log.md` | Whoever uses SI logs it |
| NASA Data | Exactly which NASA data and resources we used | `docs/03-data-sources.md` | Data lead |
| Space Agency Partner Data & Other References | **Every** data source, resource, and tool used: code, text, images, open source included | `docs/03-data-sources.md` + `THIRD_PARTY.md` | Data lead |
| Terms checkbox + "Submit for Judging" | Final step | — | Team owner |

## SI (AI) usage rules

- SI tools (ML, chatbots, image generation, LLMs) are **allowed** for speeding up development and creative work.
- The submission guide says SI should **not** be used to *come up with your idea of how to solve the challenge*. Our concept comes from the team's initial proposal (`docs/reference/initial-proposal.md`); SI is used for research, planning documentation, and coding help. **The team makes and owns the design decisions** (see `docs/decision-log.md`).
- Disclosure inside the project:
  - **Images and videos**: visible watermark showing SI generation.
  - **Audio**: say it's SI-generated in the descriptive text and the metadata.
  - **Code and data**: say it's SI-generated in the descriptive text and the metadata (README section plus file headers or commit trailers).
- Keep `docs/si-usage-log.md` current as we go. Rebuilding it at the end is error-prone.

## Judging rubric (each criterion scored 1–5, at every judging level)

| Criterion | What the "5" looks like (paraphrased) | How we earn it |
|---|---|---|
| **Impact** | Solves a significant problem; broad reach; could change lives | Smallholder rice farmers in Northern Mindanao; Android app works **offline** in the field; low-end phones; no login |
| **Creativity** | Novel, or a meaningful improvement on existing ideas | Offline-first mobile app (Android) that also runs on the web; **side-by-side comparison of ≥3 strategies** with farmer-weighted priorities; "why / evidence / risks" cards; scenario slider for rainfall/temperature |
| **Validity** | Scientifically sound, technically feasible, usable | FAO-56 water balance from NASA POWER inputs; **every number traceable to a source**; uncertainty shown; limits stated; **no invented statistics** |
| **Relevance** | Fully addresses the challenge; NASA data is **core, not decoration** | Covers R1–R8 ([01-challenge-brief.md](01-challenge-brief.md)); the NASA data directly drives the scores and the calendar |
| **Presentation** | Clear, engaging story about the challenge, solution, and significance. **Judged on the demo plus the full project** | Tight 7-slide story built around one farmer persona; real screenshots; clean README |

> Note: "the majority of judges' evaluation will be based on your project submission", meaning the full project and not only the demo. A strong demo raises **Presentation** specifically.

## Demo requirements (from "Tips for Creating a Project Demo")

- Content must include: **team name, names of team members, the selected challenge**, an image of the project, the user experience, and how NASA and partner data make the solution possible.
- **30-second video template**: 0:00 names → 0:02 challenge and inspiration → 0:05 project title and tagline → 0:10 how it works (visuals, user experience, NASA data) → 0:20–0:30 the future vision.
- **Slide deck**: ≤7 slides, readable fonts, few words, strong visuals.
- Our outline is in [09-demo-plan.md](09-demo-plan.md).

## After the hackathon (for reference)

- Global judging by experts from NASA, partner agencies, and industry.
- Dec 2026: Global Nominees, Finalists, and Honorable Mentions announced. Jan 2027: Global Winners.
- Every participant who submits gets a certificate on their profile.
