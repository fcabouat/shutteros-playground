# Architecture overview

ShutterOS is a static Svelte application with a separate TypeScript core. The core decides what happens in the game; the browser supplies time, configuration and player actions. Session data stays in memory, with no backend or saved scores.

## Code organisation

| Location                 | Owns                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `packages/core`          | Game state, decisions, progression and derived view data.                   |
| `src/lib/contract`       | Validation of the external configuration JSON.                              |
| `src/lib/infrastructure` | Browser clock, configuration loading and mapping, images and legal notices. |
| `packages/components`    | Svelte rendering, input drafts, window layout and focus.                    |
| `src/lib/app`            | Connecting the core to the browser and managing their lifetimes.            |

A player action follows **component → app runtime → core transition → updated state → component**. Components emit intents; the core returns the next state. For example, disconnecting the simulated network moves the incident to its reporting step. Moving or minimising its window is handled by the view, which reports whether the activity is visible so assistance time can pause.

The core compiles without DOM types or external dependencies. The Svelte components compile independently of the SvelteKit application and depend only on the core and their UI libraries. ESLint restricts imports between layers, and [boundary tests](../tests/unit/boundaries.test.ts) check these restrictions. Configuration passes through a strict decoder before reaching the core; invalid settings produce an error screen.

## Session behaviour

There is one deadline, set at login. Before handling an action, the runtime reads the current time and the core checks whether the session has expired. A click after the deadline therefore resets the session, even if a background tab delayed the clock callback. Periodic callbacks refresh the display and trigger expiry when nobody interacts. There are no per-scenario countdowns.

Guided finish continues an unfinished situation, then covers the remaining ones using the same deadline. Replays show new consequences without replacing the first recorded result. Each unfinished activity retains its decision step and assistance level across navigation; the incident’s isolation step therefore survives a return to the desktop. See the [transition code](../packages/core/src/runtime/game.ts) and [game-rule tests](../packages/core/tests/game.test.ts).

Minimising preserves a window’s draft. Logout and expiry create a new session generation: Svelte remounts the session views, clearing drafts and dialogs as well as game progress. Language is owned outside that reset boundary, so the player’s language choice survives. Browser resources are created after mount and disposed when the application is replaced or unmounted.

## Activity matrix and assistance

[`data/activities.ts`](../packages/core/src/data/activities.ts) defines each activity’s family, actions, outcomes, next step and first hint target. Both native application controls and guided choices send the same intents. Tests enumerate this matrix and check progression; translations supply presentation copy rather than duplicating the rules.

Assistance is progressive: one hint identifies a control, the next opens the choices. Players may request either without waiting. Otherwise, each level is offered after two minutes of visible activity without progression; repeated clicks do not postpone it. Hidden or minimised activities pause this assistance clock. Guided completion opens the choices immediately. These delays never shorten the session or mark an answer wrong.

The login hint appears after three failed attempts or two minutes after first input. An untouched login screen can wait indefinitely. Notifications for account, update and lock routines are shown only on the free desktop. Guidance occupies its own workspace row and, when expanded, a bounded column beside the window.

The remaining-activity count includes the seven scenarios and one workstation-protection activity. Its three steps (password, updates and locking) must all be completed before the normal completion flow reaches the recap. Desktop guidance can open this activity without waiting for notifications.

The desktop guide only names a destination; it does not reveal or consume activity hints. In free exploration, each new decision step starts with fresh assistance time. Continuing either mail opens the other unfinished message. The recap keeps its heading and actions visible while its activity list scrolls independently.

## Distribution

`pnpm build` produces the static game in `dist/` and a standalone file in `dist/portable/shutteros.html`. The static game loads its configuration at startup; the standalone edition embeds it during the build.

`pnpm build:site` assembles the public product site in `dist/site/`, including a demo built for `/demo/`, translated guides, the generated core API and Storybook. Documentation generation is separate from the game runtime. See [publication](publishing.md) for base paths and artifacts, [verification](verification.md) for checks, and [kiosk setup](kiosk.md) for host responsibilities.
