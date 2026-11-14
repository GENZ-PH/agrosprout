# Claude Code Setup for This Project

Everything Claude-related lives in `.claude/` at the repo root:

```
.claude/
├── CLAUDE.md          Project instructions Claude Code loads automatically (context, rules, docs map)
└── agents/            Project-scoped subagents (committed, so every teammate gets them)
```

## Subagents installed

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

**Build phase (added 2026-11-14, same catalog commit `ed74d11`, copied unmodified):**

| Agent | Category | Model | Use it for (in this project) |
|---|---|---|---|
| `mobile-developer` | 01-core-development | sonnet | Expo React Native screens, Android (EAS) build, offline behavior, WebView map bridge |
| `ui-designer` | 01-core-development | sonnet | Visual polish of the dashboard cards and charts |
| `typescript-pro` | 02-language-specialists | sonnet | Pure-TypeScript engine (`mobile/src/engine/`) and the `types.ts` contract |
| `python-pro` | 02-language-specialists | sonnet | `pipeline/` scripts (demo farm, ET₀ mirror, SRTM, PSA) |
| `test-automator` | 04-quality-security | sonnet | Engine and data unit tests (`npm test` in `mobile/`, `node:test`) |
| `accessibility-tester` | 04-quality-security | haiku | Contrast, font size, tap targets, plain language (#45) |
| `code-reviewer` | 04-quality-security | inherit | Review PRs before merging to `main` and before the freeze |

**Vetting done before install (planning phase):** six of the eight files match copies already installed at the user level (`~/.claude/agents/`). The only differences are line endings and, in `assumption-mapping`, YAML quoting of the description. Scanned all eight for URLs, shell commands, or credential handling: none found. Project-level copies take precedence over user-level ones with the same name.

**Vetting done before install (build phase):** six of the seven files are identical (ignoring line endings) to copies already installed at the user level. `mobile-developer` is new and was read in full: it has no URLs, shell commands, or credential handling. Its generic checklist mentions push notifications, analytics, and app-store work that are out of scope here; `.claude/CLAUDE.md` (no login, no backend storage, MoSCoW scope) still applies when it runs.

**Web-first responsive UI (added 2026-11-14 for #114, same catalog commit `ed74d11`, copied unmodified):**

| Agent | Category | Model | Use it for (in this project) |
|---|---|---|---|
| `frontend-developer` | 01-core-development | sonnet | Responsive web layouts: breakpoints, the wide map + panel and dashboard grid (#114) |
| `expo-react-native-expert` | 02-language-specialists | sonnet | Expo Router, react-native-web, `useWindowDimensions`, making one layout serve Android and web |
| `ui-ux-tester` | 04-quality-security | sonnet | Walk the user flow in the browser at desktop and phone widths; report spacing, overflow and layout defects |

**Vetting done before install (web-first UI):** `frontend-developer` and `ui-ux-tester` are identical (ignoring line endings) to copies already installed at the user level. `expo-react-native-expert` is new and was read in full. None of the three has URLs, shell commands, or credential handling. `expo-react-native-expert`'s generic checklist covers push notifications, OTA updates, iOS, auth and store submission, all out of scope here. `ui-ux-tester` drives the browser through the Chrome MCP and Computer Use tools, so it only works where a teammate has those connected. `.claude/CLAUDE.md` still applies when any of them runs.

**Considered and skipped:** `data-engineer` (`python-pro` covers our small scripts), `react-specialist` (overlaps `mobile-developer` and `expo-react-native-expert`), `qa-expert` (`test-automator` writes the tests; the bug bash in #46 follows `docs/08`). `scientific-literature-researcher`, because it's biomedical-focused and needs a third-party MCP server (`bgpt.pro`). `research-analyst` covers our literature needs. `design-bridge`, because it copies the look of an existing brand's website, and we have our own design tokens in `theme.ts`.

### How to invoke

In Claude Code: *"Use the research-analyst agent to find FAO-56 Kc values for mungbean, peanut and maize, with citations."* Claude can also pick an agent automatically from its description.

## Adding more agents

Copy the `.md` file from the [catalog](https://github.com/VoltAgent/awesome-claude-code-subagents) into `.claude/agents/` **after reading it**, then add a row above.
