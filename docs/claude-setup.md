# Claude Code Setup for This Project

Everything Claude-related lives in `.claude/` at the repo root:

```
.claude/
├── CLAUDE.md          Project instructions Claude Code loads automatically (context, rules, docs map)
└── agents/            Project-scoped subagents (committed, so every teammate gets them)
```

## Subagents installed (planning phase only)

Source: [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents), commit `ed74d11` (2026-11-02), MIT License © 2025 VoltAgent (license text in `.claude/agents/LICENSE.voltagent`). The files are copied **unmodified**.

| Agent | Category | Model | Use it for (in this project) |
|---|---|---|---|
| `project-manager` | 08-business-product | haiku | Keep the 40-h schedule honest, track checkpoints, re-plan when behind ([08](08-hackathon-schedule.md)) |
| `product-manager` | 08-business-product | haiku | MoSCoW scope calls, cut decisions, feature-to-rubric mapping ([05](05-mvp-scope.md)) |
| `ux-researcher` | 08-business-product | sonnet | Persona, farmer-centered flow, plain-language and low-literacy design review |
| `assumption-mapping` | 08-business-product | (default) | Rank the riskiest assumptions and de-risk them ([10](10-risks.md)) |
| `technical-writer` | 08-business-product | haiku | README, Learn/glossary page, submission field drafts |
| `data-researcher` | 10-research-analysis | sonnet | Find and verify datasets and access paths (POWER, AppEEARS, SMAP, Sentinel-2, GAEZ) |
| `research-analyst` | 10-research-analysis | sonnet | Agronomy evidence: crop coefficients, rotation benefits, Philippine crop calendars, with citations |
| `architect-reviewer` | 04-quality-security | inherit | Review the architecture and data contracts before code freezes ([06](06-architecture.md)) |

**Vetting done before install:** six of the eight files match copies already installed at the user level (`~/.claude/agents/`). The only differences are line endings and, in `assumption-mapping`, YAML quoting of the description. Scanned all eight for URLs, shell commands, or credential handling: none found. Project-level copies take precedence over user-level ones with the same name.

**Considered and skipped:** `scientific-literature-researcher`, because it's biomedical-focused and needs a third-party MCP server (`bgpt.pro`). `research-analyst` covers our literature needs.

### How to invoke

In Claude Code: *"Use the research-analyst agent to find FAO-56 Kc values for mungbean, peanut and maize, with citations."* Claude can also pick an agent automatically from its description.

## Agents to add when we start building (not installed yet)

| Agent (catalog path) | Why |
|---|---|
| `python-pro` (02) or `data-engineer` (05) | `pipeline/` scripts |
| `typescript-pro` (02) / `react-specialist` (02) / `frontend-developer` (01) | App and engine |
| `ui-designer` (01) | Visual polish |
| `accessibility-tester` (04) | Contrast, tap targets, readability on low-end phones |
| `qa-expert` / `test-automator` (04) | Engine unit tests, offline test plan |
| `code-reviewer` (04) | Pre-freeze review |

Install the same way: copy the `.md` file from the catalog into `.claude/agents/` **after reading it**.
