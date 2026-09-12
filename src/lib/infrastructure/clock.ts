/**
 * Combine wall elapsed time (including suspension) with a monotonic elapsed clock
 * (resistant to wall-clock rollback). Forward wall-clock jumps may expire a game
 * early; the core clamps accepted samples so a rollback does not refund play time.
 * This needs a mounted browser; Game.svelte creates it inside onMount.
 */
export function browserClock() {
  const wallOrigin = Date.now();
  const monotonicOrigin = performance.now();
  return {
    now: () => wallOrigin + Math.max(Date.now() - wallOrigin, performance.now() - monotonicOrigin),
    subscribe(tick: () => void) {
      // Intervals are throttled in background tabs. Lifecycle events request an
      // immediate deadline check on return; a suspended process cannot reset the UI.
      const interval = window.setInterval(tick, 250);
      document.addEventListener('visibilitychange', tick);
      window.addEventListener('pageshow', tick);
      window.addEventListener('focus', tick);
      return () => {
        window.clearInterval(interval);
        document.removeEventListener('visibilitychange', tick);
        window.removeEventListener('pageshow', tick);
        window.removeEventListener('focus', tick);
      };
    },
  };
}
