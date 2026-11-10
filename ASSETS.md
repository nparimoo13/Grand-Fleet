# Grand Fleet assets

## Generating art

```powershell
pnpm art              # all crews with ship/ship.json (currently strawhats)
pnpm art strawhats    # one crew
```

Sources live in `art-src/` (palette-indexed character grids). Ship, sky, ocean, flag and UI icons for Phase 3 are composed in TypeScript from `ship/ship.json` room layout.

Outputs land in `assets/crews/<crewId>/ship/`:

| File | Purpose |
|------|---------|
| `scene.png` | Full cross-section (tile size × map size pixels) |
| `sky-day.png`, `sky-night.png` | Sky gradients |
| `ocean-far.png`, `ocean-mid.png`, `ocean-near.png` | Tileable parallax strips |
| `flag.png` + `flag.json` | Original flag wave (4 frames) |
| `ui-icons.png` + `ui-icons.json` | Den Den Mushi, ! and … markers |
| `art.json` | Manifest consumed by the app |

The renderer loads images via the `grandfleet://` protocol (maps to the packaged `assets/` folder).

## Character overrides

To replace generated crew art, drop files in:

```
assets/crews/<crewId>/characters/<id>/override/
  <id>.png          # sprite sheet
  <id>.json         # Aseprite export (JSON data, hash or array, with frame tags)
```

Both files must exist; the main process checks on load (`CrewPack.spriteOverrides`) and the ship scene merges the sheet into the characters atlas at start-up. A sheet that fails to load is skipped with a console warning.

- **Tags are animations.** Each tag replaces the generated animation of the same name: `idle`, `walk`, `work` are used today (`think`, `waiting`, `error`, `celebrate`, `ambient_*` arrive with Phases 6 and 9). Tags you leave out keep the generated frames.
- **Frame size** is yours, but the generated crew are **24×32**; the feet anchor is the **bottom-centre** of the frame box, and sprites face **right** (the scene mirrors them for left).
- Frames play at the scene's fixed rate; per-frame durations and loop direction in the Aseprite file are ignored for now.
- Colours are re-lit by the lighting pass like the generated art, so draw them in plain, unlit colours. There is no hand-drawn cast shadow; override characters get none until a shadow frame convention is added.
- A roster `portrait.png` override is not loaded yet (portraits come from the generated `ui` sheet).

## Originality

All art is original. Do not copy existing anime/manga ships, characters, logos or flags. Crew *names* in data are placeholders; silhouettes and emblems must be your own.
