/** Browser convenience guard, not an OS boundary. Only the kiosk launcher opts in. */
type KeyInput = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'getModifierState' | 'isComposing'
>;

const navigationKeys = new Set([
  'Tab',
  'Enter',
  'Escape',
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Shift',
  'CapsLock',
]);

export function blocksKioskKey(event: KeyInput): boolean {
  // Preserve the operator reset before filtering modifiers. AltGraph produces
  // Ctrl+Alt on some keyboards; treating it as a shortcut breaks AZERTY input.
  if (event.ctrlKey && event.altKey && !event.metaKey && event.key === 'Home') return false;
  if (event.getModifierState('AltGraph')) return false;
  if (event.ctrlKey || event.altKey || event.metaKey) return true;
  if (event.isComposing || event.key === 'Dead' || event.key === 'Process') return false;
  return !navigationKeys.has(event.key) && [...event.key].length !== 1;
}

type KeyboardLock = { lock(): Promise<void>; unlock(): void };

/**
 * The owner calls activate directly from a login gesture: fullscreen cannot be
 * reacquired from a timer or fullscreenchange. A rejected/absent API leaves the
 * game playable and host recovery authoritative. A long Escape remains a browser
 * escape hatch. The normal demo never installs listeners or requests fullscreen.
 */
export function createKioskInput(view: Window, doc: Document, nav: Navigator) {
  const enabled = new URLSearchParams(view.location.search).get('kiosk') === '1';
  const candidate = (nav as Navigator & { keyboard?: KeyboardLock }).keyboard;
  const keyboard =
    typeof candidate?.lock === 'function' && typeof candidate.unlock === 'function'
      ? candidate
      : undefined;
  let disposed = false;
  let pending = false;
  let generation = 0;
  let ownsFullscreen = false;

  const unlock = () => {
    keyboard?.unlock();
  };
  const fullscreenChanged = () => {
    if (!doc.fullscreenElement) {
      ownsFullscreen = false;
      ++generation;
      unlock();
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (doc.fullscreenElement && blocksKioskKey(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const contextmenu = (event: Event) => event.preventDefault();
  const auxclick = (event: MouseEvent) => {
    if (event.button !== 0) event.preventDefault();
  };
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey) event.preventDefault();
  };
  if (enabled) {
    view.addEventListener('keydown', keydown, true);
    view.addEventListener('contextmenu', contextmenu);
    view.addEventListener('auxclick', auxclick);
    // Normal scrolling and touch remain available. Only the browser zoom chord is suppressed.
    view.addEventListener('wheel', wheel, { passive: false });
    doc.addEventListener('fullscreenchange', fullscreenChanged);
  }

  return {
    async activate(): Promise<void> {
      if (
        !enabled ||
        disposed ||
        pending ||
        !keyboard?.lock ||
        !doc.documentElement.requestFullscreen
      )
        return;
      pending = true;
      const attempt = generation;
      try {
        if (!doc.fullscreenElement) {
          await doc.documentElement.requestFullscreen();
          ownsFullscreen = true;
        }
        if (disposed || attempt !== generation || !doc.fullscreenElement) return;
        await keyboard.lock();
        // A pending lock may resolve after exit/disposal; release that late result.
        if (disposed || attempt !== generation || !doc.fullscreenElement) unlock();
      } catch {
        // Unsupported, denied, or lost activation must not interrupt a game.
      } finally {
        pending = false;
        if (disposed && ownsFullscreen && doc.fullscreenElement) {
          void doc.exitFullscreen().catch(() => {});
        }
      }
    },
    dispose() {
      disposed = true;
      ++generation;
      if (!enabled) return;
      view.removeEventListener('keydown', keydown, true);
      view.removeEventListener('contextmenu', contextmenu);
      view.removeEventListener('auxclick', auxclick);
      view.removeEventListener('wheel', wheel);
      doc.removeEventListener('fullscreenchange', fullscreenChanged);
      unlock();
      if (ownsFullscreen && doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
    },
  };
}
