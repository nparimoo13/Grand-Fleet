# Grand Fleet

A desktop agent orchestrator themed as a pirate crew aboard a ship. Electron + Vite + React + TypeScript (strict).

Each crew member is an AI coding agent. Put them on duty and they get their own git worktree and a real Claude Code session; you watch them on the ship, steer them from the Captain's Deck and approve risky actions from the Den Den Mushi queue.

## Getting started

### Requirements

- **Windows** (the packaged build targets Windows; ConPTY is used for terminals)
- **Node.js 20+** and **pnpm 9** (`corepack enable` will give you the pinned version)
- **git** on your `PATH`
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** CLI installed and logged in (`claude`). Codex CLI, Anthropic/OpenAI API keys and Ollama are optional and can be skipped.
- A C++ build toolchain may be needed the first time, because `better-sqlite3` is rebuilt for Electron on install.

### Install and run

```powershell
git clone <this repo's URL>
cd "Grand Fleet"
pnpm install        # also rebuilds better-sqlite3 for Electron (node-pty ships prebuilds)
pnpm dev            # Electron with hot reload
```

To build an installer instead: `pnpm package:win` (installer in `dist/`) or `pnpm run package:dir` (unpacked app in `dist/win-unpacked/`).

## Using Grand Fleet

1. **First-run wizard.** On first launch it checks your `PATH` for the Claude Code and Codex CLIs and shows the install or login command for anything missing (nothing is installed for you). Optionally add API keys and choose a **voyages folder** where new projects are created. Everything can be skipped and changed later in Settings.
2. **Open a voyage.** A voyage is a project backed by a git repo (crew work in git worktrees). In the top bar choose **voyage**, then either:
   - **Open project folder…** to use an existing project. If the folder is not a git repo you are offered **Initialize git here**, and an empty "Start voyage" commit is made if the repo has no commits. Pick the repo root, not a subfolder.
   - **New voyage…** to create a new project folder inside your voyages folder.
3. **Pick a crew.** The ship selector in the top bar switches crews. Each crew has its own agents and memory, and switching never deletes anything.
4. **Put crew on duty.** In the crew roster press **on duty** on a member. This creates a git worktree at `<voyage>/.grandfleet/worktrees/<id>` on branch `grandfleet/<id>` and starts a Claude Code session there. **stand down** removes the worktree if it has no uncommitted changes; the branch is always kept.
5. **Work with an agent.** Select a crew member to open the Captain's Deck:
   - **terminal**: the live Claude Code terminal. You can type straight into it.
   - Message box: type a message and press **Enter** to send (**Shift+Enter** for a new line).
   - **log**: tool activity and status for the session.
   - **den den mushi**: pending approval requests (see below).
   - **IDE**: opens the agent's worktree in your editor (set the editor in Settings → Voyage & editor).
   - The other tabs (triggers, memory, skills, temps) are placeholders for a later phase.
6. **Approve or deny actions.** When an agent wants to do something your policy does not auto-approve, it appears in **den den mushi**. Allow or deny it there, or answer in the terminal and the entry clears itself.
7. **Review and merge the work.** Each agent commits to its own `grandfleet/<id>` branch, so review and merge those branches with your normal git workflow. Grand Fleet never pushes or merges for you.

### Top bar controls

| Control | What it does |
|---|---|
| Ship selector | Switch crew and ship |
| **voyage** menu | Open, create or switch projects; recent voyages are remembered |
| **auto mode** | Auto-approve safe actions according to your policy (see below) |
| ☀ / ☾ | Switch the ship scene between day and night |
| ⚙ | Settings: Voyage & editor, Crew, Auto-approval, API keys, Scene |
| ⛶ | Fullscreen |

With no voyage open, the app shows demo data so you can look around.

### Customizing

- **Crew**: Settings → Crew edits each member's role, provider, model and system prompt. Edits are stored separately and never modify the crew pack.
- **Auto mode policy**: Settings → Auto-approval (details under [Auto mode policy](#auto-mode-policy)).
- **Scene**: Settings → Scene sets time of day and opens the art preview.
- **Debugging Claude**: set `GRANDFLEET_CLAUDE_DEBUG_DIR=<folder>` before launching to capture Claude Code's debug log per agent.

## Development commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app with hot reload |
| `pnpm build` | Production build into `out/` |
| `pnpm typecheck` | Strict TypeScript check (renderer + main) |
| `pnpm test` | Unit tests (policy, worktrees, launchers, prefs, crew loader, agent manager, hook server, Claude adapter helpers, art raster) |
| `pnpm art` | Generate ship/sky/ocean/UI PNGs + Aseprite JSON into `assets/crews/<crewId>/ship/` (see `ASSETS.md`) |
| `pnpm smoke` | Build, then drive the real app end to end with a fake `claude` (no tokens); screenshots go to `artifacts/smoke/` |
| `GRANDFLEET_SMOKE_REAL=1 node scripts/smoke.mjs` | Same, but sessions start the real `claude` (nothing is sent) |
| `GRANDFLEET_LIVE_CLAUDE=1 pnpm vitest run claude-live` | Live adapter test against the real CLI: allow, deny, resume. Spends a few cents on the cheapest model |
| `pnpm package:dir` | Unpacked Windows build in `dist/win-unpacked/` |
| `pnpm package:win` | Windows NSIS installer in `dist/` |
| `GRANDFLEET_EXE=<exe> node scripts/smoke.mjs` | Run the smoke test against a packaged build |

Use `pnpm run package:dir`, not `pnpm pack` (that is a built-in pnpm command).

## Workspace model

- A **voyage** is a project. Open an existing folder or create a new one under the "voyages folder" set in Settings. Recent voyages are remembered.
- Every crew member **on duty** works in their own git worktree: `<voyage>/.grandfleet/worktrees/<id>` on branch `grandfleet/<id>`. Off-duty crew have no directory. Standing down removes the worktree only if it has no uncommitted changes; the branch is always kept.
- `.grandfleet/` is added to the repo's local `.git/info/exclude`, so your `.gitignore` is never touched.
- Which crew are on duty is derived from the worktrees on disk, so it survives restarts.

## Data-driven crews

Everything crew-specific lives in `assets/crews/<crewId>/` (`crew.json`, `ship/ship.json`, `characters/<id>/character.json`). The engine and UI read every name, role, room and prompt from there, so renaming is a data-only change and a new crew is a new folder plus an entry in `assets/crews/index.json`.

User edits (role, provider, model, system prompt) are stored separately and never modify the pack.

## Auto mode policy

Editable in Settings → Auto-approval, evaluated by `electron/main/core/policy.ts`. Defaults auto-approve reads and searches, edits inside the agent's own worktree, test/lint/build/typecheck, read-only git, and git add/commit. Deleting, anything outside the worktree, installs, network beyond the provider API, git push/merge/rebase/reset and any unlisted shell command always ask. Compound, redirected or substituted commands are never auto-approved.

## Agent engine (Claude Code CLI)

Putting a crew member on duty starts a real `claude` session in their worktree, inside a node-pty pseudo-terminal (ConPTY on Windows). The terminal tab is an xterm.js view of exactly what Claude Code shows; you can type into it directly, or use the message box (Enter sends).

Status, tool activity, approvals and usage do **not** come from scraping the screen. Each session is launched with a private `--settings` file that points Claude Code's own hooks and status line at a loopback HTTP server in the main process (127.0.0.1, random port, per-launch secret in the URL):

- **Status and log**: `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `StopFailure` hooks.
- **Approvals**: the `PermissionRequest` hook. The request runs through the auto-mode policy; anything that is not auto-approved is held open in the **Den Den Mushi** queue until you allow or deny. If you answer in the terminal first, the queue entry clears itself.
- **Context %, tokens, cost, model**: the status line, which posts its JSON with `curl`.
- **Output matcher**: covers only what has no hook (first-run setup, the folder-trust dialog, an expired login).

Claude is launched with `--permission-mode default` so Grand Fleet's policy, not Claude's own auto mode, decides. Sessions resume their previous conversation (`--resume`) after a restart. Closing a voyage or switching crew parks its sessions; quitting kills them and their child processes.

Provider adapters implement the `AgentProvider` / `AgentSession` interface in `electron/main/agents/provider.ts` and emit the same normalized events, so Codex and the API providers (Phase 8) plug in without UI changes.

Set `GRANDFLEET_CLAUDE_DEBUG_DIR=<folder>` to capture Claude Code's own debug log per agent.
## Data and secrets

- SQLite (`better-sqlite3`) in the user data folder. Every table has a `crew_id`. Voyages, tasks and activity are global; agent sessions and memory are scoped per crew. Switching crews filters views and deletes nothing.
- API keys are encrypted with Electron `safeStorage` in the main process. The renderer only ever sees "configured" and the last four characters.
- Renderer: `contextIsolation` on, `nodeIntegration` off, `sandbox` on, strict CSP in production, a channel allowlist in the preload, and sender checks plus payload validation in main.

## Art pipeline (Phase 3)

Palette-indexed grids live in `art-src/` (TypeScript). `pnpm art` composes **The Sunny Deck** cross-section, sky, ocean strips, flag wave, and UI icons from `assets/crews/<crewId>/ship/ship.json`, writes PNGs plus `art.json`, and the app loads them through the `grandfleet://` asset protocol. Crew character sprites are Phase 4.

- **Ship scene**: main deck uses `scene.png` when art is present (Settings → Scene still controls time-of-day CSS until the Pixi scene in Phase 5).
- **Review loop**: Settings → **Scene** → **Open art preview** — every sheet at 2–3× on light/dark backgrounds; animated sheets use the generated Aseprite JSON.

## Status

- Phase 1 (shell), Phase 2 (Claude Code adapter, live terminal, status, Den Den Mushi approvals), Phase 3 (art pipeline + ship/environment/UI art, Art Preview), Phase 4 (ten 24×32 crew with job animations and portraits) and Phase 5 (lit pixel ship scene: bob, gulls, weather, zoom/pan, drop-in sprite overrides) are complete. The scene is Canvas2D, not PixiJS (see `design/STYLE.md`).
- Next: Phase 6, the animation state machine.
