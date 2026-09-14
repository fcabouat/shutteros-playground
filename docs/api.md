# Core API

This reference documents the TypeScript game library in `packages/core`. It has no HTTP endpoints. The application supplies validated configuration, player actions and the current time; the core returns game state without accessing the browser.

## Start here

- [`model/game.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/model/game.ts) defines `GameState`, `Intent` and the scenario identifiers. [`model/configuration.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/model/configuration.ts) defines the configuration received by the core.
- [`runtime/game.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/runtime/game.ts) contains `initialState()` and `transition()`. These create a session and process actions, including expiry, guided progression and replay.
- [`projections/game.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/projections/game.ts) derives what the UI needs: remaining time, available situations, results and reminders.
- [`services/passwords.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/services/passwords.ts) checks fictional login phrases; [`services/knowledge.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/services/knowledge.ts) handles the optional learning questions.

The `data/` folder holds scenario text and translations. For how this library connects to Svelte and the browser, see the [architecture overview](https://github.com/fcabouat/shutteros-playground/blob/main/docs/overview.md).
