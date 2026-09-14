import { describe, it, expect } from 'vitest';
import { createRuntime } from '../../src/lib/app/runtime';
import { configure } from '../../src/lib/infrastructure/configuration';
import type { GameState } from '@shutteros/core/model/game';
import configuration from '../../static/kiosk-config.json';

describe('runtime lifecycle', () => {
  it('catches up after a suspended clock and stops publishing once disposed', () => {
    const decoded = configure(configuration);
    if (!decoded.ok) throw new Error('Invalid test configuration');
    // Separate time advancement from tick delivery to model a suspended browser
    // without real sleeps. Keeping the callback also lets us deliver it after cleanup.
    let now = 0;
    let tick = () => {};
    let unsubscribed = false;
    const snapshots: GameState[] = [];
    const runtime = createRuntime(
      decoded.config,
      {
        now: () => now,
        subscribe: (callback) => {
          tick = callback;
          return () => {
            unsubscribed = true;
          };
        },
      },
      (snapshot) => snapshots.push(snapshot),
    );
    runtime.dispatch({ type: 'login', password: 'password' });
    expect(snapshots.at(-1)?.phase).toBe('session');
    now = decoded.config.sessionDurationMs + 1;
    tick();
    expect(snapshots.at(-1)).toMatchObject({ phase: 'login', reason: 'expired' });
    const count = snapshots.length;
    runtime.dispose();
    tick();
    runtime.dispatch({ type: 'login', password: 'password' });
    expect(unsubscribed).toBe(true);
    expect(snapshots).toHaveLength(count);
  });
});
