import { initialState, transition } from '@shutteros/core/runtime/game';
import type { GameState, Intent } from '@shutteros/core/model/game';
import type { GameConfig } from '@shutteros/core/model/configuration';

/**
 * A wake-up source, not a countdown. `now` and tick callbacks share one timeline;
 * callbacks may be delayed or coalesced, so dispatch reads the current time itself.
 * The returned subscription cleanup belongs to the runtime's lifetime.
 */
export interface Clock {
  now(): number;
  subscribe(tick: () => void): () => void;
}

/**
 * Bind the pure reducer to a clock and a synchronous snapshot sink.
 * Game.svelte owns disposal when replacing configuration or unmounting; components
 * receive only dispatch and snapshots. Late callbacks become inert after disposal,
 * as exercised by tests/unit/runtime.test.ts.
 */
export function createRuntime(
  config: GameConfig,
  clock: Clock,
  publish: (state: GameState) => void,
) {
  let state = initialState(clock.now());
  let disposed = false;
  function dispatch(intent: Intent) {
    if (disposed) return;
    state = transition(state, intent, clock.now(), config);
    publish(state);
  }
  publish(state);
  const unsubscribe = clock.subscribe(() => dispatch({ type: 'tick' }));
  return {
    dispatch,
    dispose() {
      disposed = true;
      unsubscribe();
    },
  };
}
