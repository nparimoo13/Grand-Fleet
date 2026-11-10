# Build: "Grand Fleet" — a pirate-ship agent orchestrator (Straw Hat Pirates first)

## What we're building
A desktop app that runs multiple AI coding/research agents at once and shows them as a pirate crew working aboard a detailed, animated pixel-art ship. It is functionally similar to "Munder Difflin" (an office-themed agent orchestrator), but themed around One Piece. Each agent is a crew member at a station on the ship. You can watch them work, talk to them, approve their requests and give tasks to the captain, who hands work out to the crew.

The first build includes only the **Straw Hat Pirates aboard the Thousand Sunny**. The architecture must make it easy to add more crews later as data packs: Heart Pirates (Polar Tang), Whitebeard Pirates (Moby Dick) and Beast Pirates.

Work in the phases at the bottom. **Stop after each phase** and summarize what you built and how to run it before you continue.

---

## Tech stack
- **Electron** + **Vite** + **React** + **TypeScript** (strict mode)
- **PixiJS v8** for the ship scene: pixel-perfect rendering, `SCALE_MODES.NEAREST`, integer scaling only, no anti-aliasing
- **node-pty** + **xterm.js** for real terminal sessions per agent
- **Zustand** for UI state
- **better-sqlite3** for persistence (sessions, tasks, memory, activity log)
- **Electron safeStorage** for API keys (never store keys in plain text)
- Main/renderer separation with a typed IPC layer (`contextBridge`, no `nodeIntegration` in the renderer)

---

## App layout (mirror Munder Difflin's structure)
1. **Top bar:** app icon, version, active crew/ship name, mode indicator ("auto mode on/off"), plus buttons for day/night toggle, settings, fullscreen, and a **ship selector** dropdown.
2. **Left (about 70%): the ship scene.** A side-view cross-section of the Thousand Sunny, with rooms visible like a dollhouse, on an animated ocean.
3. **Right: "Captain's Deck" command panel.** It shows the selected agent's portrait, status pill and one-line status, an `auto` toggle and an `IDE` button (opens the agent's working folder in the user's editor). Tabs:
   - `terminal` — live xterm view of the agent's PTY (font-size +/− control)
   - `log` — structured monitor of tool calls and outputs
   - `bounties` — task board (todo / in progress / done), with tasks assigned to crew members
   - `den den mushi` — the "ask me" queue: permission requests and questions from agents waiting on the user. The tab badge rings/animates when something is waiting.
   - `triggers` — scheduled and recurring tasks
   - `memory` — shared crew memory (notes the agents persist across sessions)
   - `graph` — node graph of the captain → crew task delegation
   - `activity` — timeline of everything that happened
   - `skills` — reusable instructions/prompts per agent
   - `temps` — temp/scratch files produced by agents
   - Bottom: a **queue** input ("Message Luffy…") with `voice`, `+ files`, `+ folder` and `send` buttons.
4. **Bottom strip: crew roster cards.** Each card shows the portrait, name, role badge (e.g. CAPTAIN), status (idle / working / waiting / error), provider + model, context-usage %, uptime, a `talk` button and an info button. Ends with a **"+ recruit crew"** button.

Clicking a character in the ship scene or on a roster card selects that agent in the Captain's Deck.

Visual style: warm parchment and wood UI chrome, pixel fonts for headers (e.g. "Press Start 2P" or "Pixelify Sans"), a monospace body, and subtle nautical details (rope borders, brass rivets, wanted-poster style cards). Seasonal decorations are optional and data-driven, like Munder Difflin's Halloween pumpkins.

---

## The ship scene
The ship is an original design you create (see the Art section). Build it as a **tile/room map defined in data** (`ship.json`), not hardcoded. Each room has a station (a work spot where an agent sits or stands), ambient props and walkable paths between rooms (stairs, ladders, deck).

Rooms and default occupants:
| Room | Default crew member |
|---|---|
| Figurehead / front deck | Luffy |
| Crow's nest gym (weights, lookout window) | Zoro |
| Galley & dining room | Sanji |
| Navigator's room / map room | Nami |
| Library (shared with the map room) | Robin |
| Usopp Factory (workshop) | Usopp |
| Infirmary | Chopper |
| Engine room / workshop | Franky |
| Aquarium bar / lawn deck with piano | Brook |
| Helm (ship's wheel) | Jinbe |

Scene details that make it feel alive:
- Animated ocean with parallax layers (far water, near waves hitting the hull), drifting clouds and the occasional seagull
- A gentle ship bob (1–2px vertical sway, never sub-pixel jitter)
- Day/night cycle tied to the user's local clock, with lanterns that glow at night
- Optional weather (light rain, fog) as a cosmetic toggle
- The flag (original emblem) and sails animate in the wind
- Camera: fit-to-panel by default, with integer zoom steps and drag to pan

---

## Crew = agents (fixed default roles, editable)
Each character has a **default role and system prompt**. The user can reassign any character's role, provider, model and system prompt in settings.

| Character | Default role | What they do |
|---|---|---|
| **Luffy** | Captain / orchestrator (the "boss") | Receives the user's goal, breaks it into bounties, delegates to the crew, merges results |
| **Nami** | Navigator / planner | Writes specs, plans and step-by-step routes for tasks |
| **Robin** | Researcher | Web and docs research, reading codebases, summarizing findings |
| **Franky** | Builder / engineer | Writes most of the code |
| **Usopp** | Tester / QA | Writes and runs tests, finds edge cases |
| **Chopper** | Doctor / debugger | Diagnoses failing builds, errors and stack traces |
| **Zoro** | Refactorer / heavy lifter | Large refactors and long-running grind tasks |
| **Sanji** | Provisioner | Dependencies, environment setup, docs and context "meals" for other agents |
| **Jinbe** | Helmsman / reviewer | Code review and stability checks before anything merges |
| **Brook** | Bard / reporter | Changelogs, summaries, status reports to the user |

Agents start hidden or "off duty". The user activates them from the roster, or the captain recruits them on demand.

---

## Agent engine: multiple providers
Create a provider adapter interface, so that each agent can run on a different backend:

```ts
interface AgentProvider {
  id: string;                 // "claude-code-cli", "codex-cli", "anthropic-api", "openai-api", "ollama"
  start(config: AgentConfig): Promise<AgentSession>;
}
interface AgentSession {
  send(message: string, attachments?: Attachment[]): void;
  approve(requestId: string, decision: "allow" | "deny"): void;
  stop(): Promise<void>;
  on(event: "output" | "status" | "toolCall" | "permissionRequest" | "usage" | "exit", cb: (e) => void): void;
}
```

Implement:
1. **Claude Code CLI via node-pty.** This is the primary adapter. Parse output for status, permission prompts and context usage where possible.
2. **OpenAI Codex CLI via node-pty**
3. **Anthropic API**, using the `@anthropic-ai/sdk` streaming API with tool use
4. **OpenAI API**
5. **Ollama** (local models)

Requirements:
- Every adapter emits the same normalized events, so the UI and animation system never care which provider is running.
- Each agent gets its own working directory. When agents share a git repo, use **git worktrees per agent** to avoid write conflicts.
- Permission requests from any provider flow into the Den Den Mushi queue.
- Track tokens, cost and context % per agent and show them on the roster card.

---

## Orchestration flow
1. The user messages the captain (Luffy) through the queue box.
2. The captain produces a plan of bounties (tasks) with an assignee, dependencies and acceptance criteria. Bounties appear on the `bounties` board and as edges in the `graph`.
3. Assigned crew members start working. In the scene, they walk to their station and switch to their working animation.
4. Crew members report back with results. The captain reviews them (or routes them to Jinbe for review) and either closes the bounty or reassigns it.
5. In auto mode, approvals for safe actions are automatic. Anything risky (deleting files, network access outside an allowlist, pushing to git) always goes to the Den Den Mushi queue.
6. Everything is logged to `activity` and persisted in SQLite, so sessions survive restarts.

---

## Art: you (the agent) build it
You produce all the art for this build in code, so it is reproducible, versioned and easy to tweak. This covers the ship, ocean, sky, props, UI icons, speech bubbles and every crew sprite.

**Originality rule:** all art must be your own original design. Do not recreate any existing anime or manga characters, ships, logos or flags, One Piece included. Crew members are original pirate characters, one for each role slot. Their names, roles and personalities come from the crew data, but how they look is your own invention. The same goes for the ship and the flag.

### Art pipeline
- Author pixel art as **palette-indexed grids** in `art-src/`, with one TypeScript file per character or prop. Frames are arrays of strings, one character per palette index. Each crew shares a palette file (`art-src/palettes/strawhats.ts`, 32–48 colors, with ramps for skin, hair, cloth, wood, metal and water).
- `npm run art` uses a Node build script (`pngjs` or `sharp`) to compile the sources into **sprite sheet PNGs + Aseprite-format JSON** under `assets/crews/<crewId>/`. The runtime loader is then identical for generated art and hand-made sheets.
- Use helper functions instead of hand-typing every pixel: mirroring, palette swaps, outline generation, shading-ramp fills, and frame tweening for bobbing and breathing. The final output must still look hand-pixeled, not blurry or procedural.

### Character art spec
- Detailed SNES-era action sprite style: about 48×64px frames at 1x, displayed at integer 2–3x, with 3–4-tone shading per material, a top-left light source, and a 1px dark selective outline.
- Every crew member needs a distinct silhouette, a signature color and a prop that fits their role: a captain's coat, a navigator's chart, a researcher's book, a builder's wrench, a doctor's bag, a cook's pan, a musician's instrument, a helmsman's wheel and so on.
- Required animation tags and frame counts: `idle` (4), `walk` (6), `work` (4–6), `think` (2–4), `waiting` (2), `error` (2), `celebrate` (6). Each ambient behavior gets its own tag of 4–8 frames, such as `ambient_weights` or `ambient_smoke`.
- Portraits: 64×64 bust for the roster cards and the Captain's Deck.

### Ship and environment art spec
- An **original three-deck pirate ship**, drawn as a side-view cross-section with every room visible, built from 16×16 tiles plus larger hand-placed set pieces. It has its own carved figurehead, masts, sails and an original flag emblem.
- Detailed room interiors, one per station: weight rack, stove and hanging pans, chart table, bookshelves, workbench, medicine cabinet, engine, piano, ship's wheel, and so on.
- Sky gradients for day, dusk and night, with layered clouds, 3 parallax ocean layers and foam where the waves hit the hull. Add seagulls, lanterns with a night glow and a flag that waves in the wind.
- UI art: status icons, speech and thought bubbles, the "!" and "…" markers, a ringing snail-phone icon for the Den Den Mushi queue, and rope and brass frame pieces.

### Review loop
- Build a dev-only **Art Preview** screen that shows every sheet with each animation playing, at 1x and display scale, on both light and dark backgrounds.
- After each art batch, render screenshots of the preview and of the ship scene, then critique them yourself: are the silhouettes readable at small size, are the palettes and outlines consistent, is there any jitter or are any frames missing? Fix the problems before moving on, and show me the screenshots at the end of the phase.

### Swapping art later
If `characters/<id>/override/` contains a sprite sheet + Aseprite JSON, load it instead of the generated art. Document the frame size, tags and feet anchor point in `ASSETS.md`, so I can drop in replacement art for any character or for the ship.

Asset layout:
```
assets/crews/strawhats/
  crew.json                 # crew metadata, ship reference, characters, roles
  ship/ship.json            # room map, stations, paths, props
  ship/tiles/*.png
  characters/<id>/
    <id>.png                # sprite sheet
    <id>.json               # Aseprite JSON export (frames + tags)
    portrait.png            # roster/command-panel portrait
    character.json          # default role, prompt, ambient behaviors, flavor lines
```

- Parse the **Aseprite JSON format** (frame tags = animation names). Support per-animation frame durations and loop/once.
- Pixel-perfect: integer scale, nearest-neighbor, sprites snapped to whole pixels.

### Agent state → animation
A state machine per character, driven by normalized provider events:
- `idle` → idle loop at their station, or wandering nearby
- `working` (output streaming / tool calls) → `work`
- `thinking` (no output for >N seconds but still running) → `think` with a "…" bubble
- `waiting_for_user` → `waiting` plus a ringing Den Den Mushi icon above their head
- `error` → `error` plus a red "!" bubble; click it to jump to the log
- `task_done` → `celebrate` once, then back to idle

Status animations **always take priority** over ambient ones.

---

## Making the crew feel alive (ambient behaviors)
An **ambient behavior scheduler** gives each character a chance every 2–5 minutes (randomized, with a per-character cooldown) to play a short personality moment. Ambient moments may play during `idle` and during long-running `working`/`thinking` stretches (e.g. while doing research). They must never hide a `waiting_for_user` or `error` state, and they end instantly if one occurs.

Behaviors are data-driven in each `character.json`:
```json
"ambient": [
  { "id": "lift_weights", "anim": "ambient_weights", "durationSec": [8, 15], "room": "crows_nest", "weight": 3, "bubble": ["…498…499…500"] },
  { "id": "nap", "anim": "ambient_sleep", "durationSec": [10, 20], "weight": 2, "bubble": ["zzz"] }
]
```

Default ideas to wire up (create the matching ambient animations for each crew member):
- **Zoro:** lifts giant weights in the crow's nest, naps against a wall, gets lost walking to the wrong room
- **Sanji:** smokes a cigarette at the galley door, cooks with pans flipping, hearts appear when Nami or Robin walks by
- **Luffy:** sits on the lion figurehead, sneaks into the galley to steal meat, stretches
- **Nami:** draws maps, counts berries, bonks Luffy
- **Robin:** reads a book, sips coffee
- **Usopp:** tinkers in his factory, tells a tall tale to Chopper
- **Chopper:** grinds medicine, gets excited listening to Usopp
- **Franky:** strikes his signature pose, works on the engine
- **Brook:** plays the violin or piano, sips tea
- **Jinbe:** steers the helm, looks out to sea

**Multi-character interactions** are rarer events, scheduled only when both characters are idle or ambient-eligible:
- Luffy sneaks into the galley → Sanji kicks him out
- Zoro and Sanji bump into each other → short argument with comic dust cloud
- Usopp tells a story → Chopper and Luffy gather to listen
- Brook plays → nearby crew bob along

Add a settings slider for ambient frequency (off / chill / lively) and a "quiet mode" that disables bubbles.

---

## Multi-crew architecture (future-proofing)
- Everything crew-specific lives in `assets/crews/<crewId>/`. The engine must not hardcode Straw Hat names anywhere outside that folder.
- The ship selector lists Straw Hats (active) plus Heart Pirates, Whitebeard Pirates and Beast Pirates as locked "coming soon" entries, read from a `crews/index.json`.
- Switching crews swaps the ship map, roster, roles and ambient behaviors, while keeping the user's sessions and tasks.

---

## Build phases (stop after each one)
1. **Shell:** Electron + React scaffold, typed IPC, full panel layout with mock data, the settings screen, and safeStorage for API keys.
2. **One real agent:** the Claude Code CLI adapter via node-pty, the live terminal tab, status detection, and the Den Den Mushi approvals queue.
3. **Art pipeline + ship art:** the `art-src/` format, the `npm run art` build script, the Art Preview screen, and the full ship, ocean, sky and props art. Run the review loop.
4. **Crew art:** all 10 crew members with the required animations and portraits. Run the review loop.
5. **Ship scene:** PixiJS renderer, the data-driven ship map, ocean/sky/day-night, the Aseprite sprite loader with override support, and the click-to-select agent.
6. **Animation state machine:** status → animation mapping and pathfinding between rooms.
7. **Orchestration:** the captain plans and delegates, plus the bounty board, graph, activity log, worktrees per agent and SQLite persistence.
8. **More providers:** Codex CLI, Anthropic API, OpenAI API and Ollama adapters, with a per-agent provider/model picker.
9. **Ambient life:** ambient animations for every character, the scheduler, multi-character interactions and frequency settings.
10. **Polish:** memory, skills, triggers, temps tabs, keyboard shortcuts, performance pass (the scene should hold 60fps with all 10 agents active) and packaging with electron-builder.

## Acceptance criteria for the first build
- I can start the app, activate Luffy plus at least 3 crew members, give Luffy a goal, and watch tasks get delegated and completed.
- Each active crew member visibly reflects their real agent state in the ship scene within 1 second of a state change.
- Permission requests from any agent show up in the Den Den Mushi tab and can be approved or denied.
- Ambient behaviors play naturally and never hide a waiting or error state.
- Adding a new crew requires only a new folder in `assets/crews/`, with no engine code changes.
- All art is generated from `art-src/` by `npm run art`, looks consistent across the ship and crew, and any character can be swapped for a dropped-in override sheet.
- No API keys in plain text; no `nodeIntegration` in the renderer.
