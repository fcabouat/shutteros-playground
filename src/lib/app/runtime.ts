import { initialState, transition } from '@shutteros/core/runtime/game';
import type { GameState, Intent } from '@shutteros/core/model/game';
import type { GameConfig } from '@shutteros/core/model/configuration';

export interface Clock {
  now(): number;
  subscribe(tick: () => void): () => void;
}

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
