# AgriResilience — Project Docs

**NASA Space Apps Challenge 2026 · "Field Shift: Adapting Farms with NASA Data"**
Team **Jeoleecation** (`houston-no-problem`) · Local Event **Iligan City, Philippines** · Working name: *AgriResilience* (D7 open)

## ⏰ Key times (PHT, UTC+8)

| When | What |
|---|---|
| Sat Nov 14, 09:00 | Project submission opens |
| Sat Nov 14, 13:00 | Checkpoint 1: data contract frozen |
| Sat Nov 14, 20:00 | Checkpoint 2: end-to-end with real data |
| **Sun Nov 15, 12:00** | **Feature freeze** |
| **Sun Nov 15, 21:00** | **Internal submit target** |
| **Sun Nov 15, 23:59** | **Hard deadline: "Submit for Judging"** |
| ? | **Local judging in Iligan: ask the Local Lead** |

## Team

| Member | Track (see 08) | Earthdata account | Confirmed at Iligan event |
|---|---|---|---|
| | Data | ☐ | ☐ |
| | Engine | ☐ | ☐ |
| | Frontend/UX | ☐ | ☐ |
| | Story | ☐ | ☐ |

## Read in this order

| Doc | What's in it | Who must read |
|---|---|---|
| [01-challenge-brief.md](01-challenge-brief.md) | Challenge requirements as a checklist (R1–R8), "SI" terminology | Everyone |
| [02-submission-and-judging.md](02-submission-and-judging.md) | Hard rules, form fields, SI disclosure rules, judging rubric | Everyone |
| [04-gap-analysis.md](04-gap-analysis.md) | What the initial proposal is missing and what to fix | Everyone |
| [05-mvp-scope.md](05-mvp-scope.md) | Persona, user flow, MoSCoW, Definition of Done | Everyone |
| [11-user-flow.md](11-user-flow.md) | **Team-defined onboarding**, screen by screen: no login → map lots → crops → dashboard → months → side-by-side | Everyone (Frontend + Story especially) |
| [08-hackathon-schedule.md](08-hackathon-schedule.md) | Roles, hour-by-hour plan, checkpoints, cut order | Everyone |
| [03-data-sources.md](03-data-sources.md) | All resources with URLs, tiering, access, harmonization | Data lead |
| [06-architecture.md](06-architecture.md) | System design, stack, repo layout, data contracts | Engine + Frontend |
| [07-rotation-engine.md](07-rotation-engine.md) | Water balance, candidate generation, scores, explanations, validation | Engine + Data |
| [09-demo-plan.md](09-demo-plan.md) | 7-slide outline, story spine, video fallback | Story lead |
| [12-infrastructure.md](12-infrastructure.md) | Cloudflare setup (Pages, Worker API, D1, R2), environments, local dev, API hooks and state, deployments, contingency | Everyone writing code |
| [10-risks.md](10-risks.md) | Risk register + assumptions to validate | Everyone at checkpoints |
| [decision-log.md](decision-log.md) | D1–D20 (D12, D13, D17, D19, D20 already accepted); **confirm the rest at kickoff** | Everyone |
| [si-usage-log.md](si-usage-log.md) | SI usage record (required for submission) | Anyone using SI |
| [submission/fields.md](submission/fields.md) | Paste-ready drafts of every form field | Story lead |
| [claude-setup.md](claude-setup.md) | `.claude/` contents, installed subagents, what to add later | Anyone using Claude Code |
| [reference/initial-proposal.md](reference/initial-proposal.md) | The team's original AgriResilience proposal (moved here from repo root) | Reference |

## Kickoff agenda (Sat 08:00–09:00)

1. Everyone skims 01, 02, 04, 05 (15 min).
2. Walk through `decision-log.md`: accept or change D1–D20 (D12, D13, D17, D19, D20 are already accepted) (15 min).
3. Assign tracks, fill in the Team table above (5 min).
4. Data lead: Earthdata accounts + **submit the AppEEARS request** + pick the farm coordinate.
5. Frontend lead: `git init`, public GitHub repo, scaffold, first deploy.
6. Story lead: message the Iligan Local Lead about local judging times; check all members are confirmed.
