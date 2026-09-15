# Architecture overview

ShutterOS is a static application with a deterministic TypeScript game core and a Svelte interface. It has no backend. Session progress lives in memory and is discarded when the session ends.

## Responsibilities

| Layer                    | Responsibility                                                                 |
| ------------------------ | ------------------------------------------------------------------------------ |
| `packages/core`          | Game state, permitted actions, outcomes, progression and semantic projections. |
| `packages/components`    | Screens, input drafts, window geometry, focus and visual guidance.             |
| `src/lib/contract`       | Decode and validate external configuration.                                    |
| `src/lib/infrastructure` | Browser time, configuration loading, branding assets and legal notices.        |
| `src/lib/app`            | Connect the game to browser services and manage their lifetimes.               |

Dependencies point toward the core. It compiles without DOM types or runtime dependencies. Components emit typed intents; they do not assign results. ESLint and [boundary tests](../tests/unit/boundaries.test.ts) enforce import boundaries.

The typed text catalogue currently groups scenario copy and interface labels in `core/data`; configuration likewise carries both game settings and branding. These shared data contracts do not give the transition engine access to browser services.

## State and interaction

A player action follows **view → app runtime → core transition → state → view**. The runtime supplies time explicitly, so transitions are reproducible without a browser. Native application actions and questionnaire choices use the same commands and outcome rules, defined in the [activity matrix](../packages/core/src/data/activities.ts).

The core owns the session deadline, assistance progression and recorded outcomes. Window movement, resizing, visual hint targets and keyboard focus remain presentation state. Minimising an activity reports its visibility to the core so assistance time pauses without extending the session deadline.

## Invariants

- Every action is checked against the session deadline, including after browser timers have been delayed.
- Navigation preserves unfinished decisions. Replays never replace the first recorded result.
- An action's outcome and its assessment are distinct: a safe USB action after opening the unchecked text file receives a caution assessment.
- Session reset remounts the views to clear drafts and dialogs. Language preference survives outside that boundary.
- External configuration is validated before entering the game; invalid input produces an error screen.

## Delivery

The same application is built as a static site and as a standalone HTML file. The public product site adds the demo, guides, generated API reference and Storybook; this documentation tooling is separate from the game runtime.

See [verification](verification.md) for checks, [publication](publishing.md) for artifacts and hosting, and [kiosk setup](kiosk.md) for deployment responsibilities.
