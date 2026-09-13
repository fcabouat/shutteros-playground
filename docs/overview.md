# Architecture overview

ShutterOS is a static Svelte application with a separate TypeScript core. The core decides what happens in the game; the browser supplies time, configuration and player actions. Session data stays in memory, with no backend or saved scores.

## Code organisation

| Location                 | Owns                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `packages/core`          | Game state, decisions, progression and derived view data.                   |
| `src/lib/contract`       | Validation of the external configuration JSON.                              |
| `src/lib/infrastructure` | Browser clock, configuration loading and mapping, images and legal notices. |
| `src/lib/components`     | Rendering, input drafts, window layout and focus.                           |
| `src/lib/app`            | Connecting the core to the browser and managing their lifetimes.            |

A player action follows **component → app runtime → core transition → updated state → component**. Components emit intents; the core returns the next state. For example, disconnecting the simulated network moves the incident to its reporting step. Moving or minimising its window is handled by the view.

The core compiles without DOM types or external dependencies. ESLint restricts imports between layers, and [boundary tests](../tests/unit/boundaries.test.ts) check these restrictions. Configuration passes through a strict decoder before reaching the core; invalid settings produce an error screen.

## Session behaviour

There is one deadline, set at login. Before handling an action, the runtime reads the current time and the core checks whether the session has expired. A click after the deadline therefore resets the session, even if a background tab delayed the clock callback. Periodic callbacks refresh the display and trigger expiry when nobody interacts. There are no per-scenario countdowns.

Guided finish continues an unfinished situation, then covers the remaining ones using the same deadline. Replays show new consequences without replacing the first recorded result. An incident’s completed isolation step survives navigation, so the player can return to reporting it. See the [transition code](../packages/core/src/runtime/game.ts) and [game-rule tests](../packages/core/tests/game.test.ts).

Minimising preserves a window’s draft. Logout and expiry create a new session generation: Svelte remounts the session views, clearing drafts and dialogs as well as game progress. Language is owned outside that reset boundary, so the player’s language choice survives. Browser resources are created after mount and disposed when the application is replaced or unmounted.

## Distribution

`pnpm build` produces the static game in `dist/` and a standalone file in `dist/portable/shutteros.html`. The static game loads its configuration at startup; the standalone edition embeds it during the build.

`pnpm build:site` assembles the public product site in `dist/site/`, including a demo built for `/demo/`, translated guides, the generated core API and Storybook. Documentation generation is separate from the game runtime. See [publication](publishing.md) for base paths and artifacts, [verification](verification.md) for checks, and [kiosk setup](kiosk.md) for host responsibilities.
