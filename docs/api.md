# Core API

ShutterOS has a small, framework-independent TypeScript core. It models the exercise, reduces player intents into the next state, and exposes read-only projections and learning services for the UI, Storybook scenarios, and tests. The generated TypeDoc reference covers the model, runtime, projections and services; this page is a map of those concepts.

The core is a domain library, not an HTTP API. It does not open ports, send requests, persist session data, or retain the entered password. Callers provide the current time and validated configuration, and receive a new immutable state.

## Main modules

- **Model** — `GameState`, `Scene`, `Intent`, challenge identifiers and result types define the domain vocabulary. `GameConfig` describes the validated runtime configuration. See [`model/game.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/model/game.ts) and [`model/configuration.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/model/configuration.ts).
- **Runtime** — `initialState()` creates the login state; `transition()` is the authoritative pure reducer. It applies intents against caller-supplied time, enforces the global deadline, and handles login, logout, lock, guided finish, replay, routines, and debrief. See [`runtime/game.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/runtime/game.ts).
- **Projections** — Read-only helpers such as `nextChallenge`, `allComplete`, `assessedCount`, `remainingSeconds`, `nextAmbientEvent`, and `incidentIsolated` derive UI facts without changing state. See [`projections/game.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/projections/game.ts).
- **Services** — `passwordHint()` and `passwordCategory()` implement the demo password lesson; `currentKnowledgeId()` and `knowledgeAnswer()` implement optional learning checks. See [`services/passwords.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/services/passwords.ts) and [`services/knowledge.ts`](https://github.com/fcabouat/shutteros-playground/blob/main/packages/core/src/services/knowledge.ts).

Content and translations live beside the domain code in `data/`; they supply labels and scenario explanations while the model and runtime retain the valid identifiers and their effects.
