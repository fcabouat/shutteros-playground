# Architecture overview

ShutterOS is designed for a shared kiosk: a short learning experience, simple deployment, and a fresh session for each participant. The architecture keeps the simulation independent of browser behavior and organisation-specific configuration.

## Key decisions

- **Static delivery.** SvelteKit prerenders the shell; the browser runs the game. Deployment needs a static file server, with no application backend, account system or participant database.
- **Ephemeral state.** Progress stays in memory. Reset discards domain state and remounts the session components to clear their drafts and dialogs. Saved games and score exports are outside the product scope.
- **Explicit configuration.** A versioned JSON contract is validated before mapping to runtime units and defaults. Invalid settings produce diagnostics instead of a silently repaired configuration.
- **One session deadline.** Free exploration and guided progression share the same state machine and global clock. Guided mode covers unanswered situations without granting extra session time.

## Boundaries and ownership

| Layer                    | Responsibility                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `packages/core`          | Pure transitions, outcomes, timing rules and projections; receives configuration and numeric time. |
| `src/lib/contract`       | External JSON shape and validation, independent of the core model.                                 |
| `src/lib/infrastructure` | Browser clock, bounded file loading, legal notices and contract-to-core mapping.                   |
| `src/lib/components`     | Props-based views, local drafts, window geometry and focus; emits player intents.                  |
| `src/lib/app`            | Composition, runtime subscriptions, resource loading, cancellation and cleanup.                    |

The interaction path is **view intent → app runtime → core transition → snapshot → view props**. Outcomes belong to the core; window placement and presentation belong to components. Minimizing keeps a view mounted but hidden and inert. Closing sends a domain intent. Language belongs to the mounted application, independently of a player's score. Translation entries own complete phrases, including articles and agreement; configurable names remain standalone labels rather than grammatical fragments.

The core is a separate package because its manifest, ES2022-only TypeScript environment and import restrictions enforce a useful boundary. Other layers remain folders: they have no independent consumer or release lifecycle. [Boundary tests](../tests/unit/boundaries.test.ts) exercise forbidden imports and ambient clocks. A global event log or normalized entity store would add machinery without serving this bounded simulation.

## Runtime invariants

Player actions and ticks both settle elapsed time before progression. First outcomes and outstanding incident-reporting steps survive navigation. Replaying shows the new consequence while retaining the first result and the original session deadline. These rules are documented beside the [transition](../packages/core/src/runtime/game.ts) and exercised by its [tests](../packages/core/tests/game.test.ts).

Browser configuration and time enter after mount to preserve hydration consistency. The composition root owns load cancellation, runtime disposal and the session reset boundary.

## Delivery and verification

The HTTP edition loads configuration from `dist/`; the portable edition embeds it at build time in `dist/portable/shutteros.html`. Both use the same decoder, application and core, and include license notices.

Storybook injects bounded scenarios into screens. CI exercises unit rules, static and portable browser journeys, packaging, and the Pages base path. See [verification](verification.md) for coverage and acceptance checks. Comprehension, accessibility on the target device, host isolation and Ubuntu boot integration require deployment validation; the web simulation does not provide an OS security boundary.
