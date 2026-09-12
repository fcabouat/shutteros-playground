export function browserClock() {
  const wallOrigin = Date.now();
  const monotonicOrigin = performance.now();
  return {
    now: () => wallOrigin + Math.max(Date.now() - wallOrigin, performance.now() - monotonicOrigin),
    subscribe(tick: () => void) {
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
