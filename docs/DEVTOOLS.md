# Developer Tools / Tuning Suite

- Runtime tunables are registered in `devtools/RuntimeConfig.js` via `DEFAULT_CONFIG` and `CONFIG_FIELDS`.
- Add a new tunable by adding it to both structures (path + metadata). The panel auto-renders fields from metadata.
- Presets and pinned fields are persisted in localStorage keys:
  - `symbolWizard.devtools.runtimeConfig.v1`
  - `symbolWizard.devtools.runtimePresets.v1`
  - `symbolWizard.devtools.pinnedFields.v1`
- Live updates happen because gameplay/render systems read `runtimeConfig.get(path)` during each tick.
- Hotkeys:
  - F1 panel
  - F2 debug overlays
  - F3 stats HUD
  - F5 save config
  - F6 quick-save preset
  - F8 reset focused field (panel)
  - F9 load saved config
  - Shift+F9 restore defaults
  - Ctrl+Z / Ctrl+Y undo-redo
  - `/` focuses panel search
