import { tick } from 'svelte';

/** Focus follows navigation, after Svelte has installed the destination DOM.
 * Generation and connectivity guards prevent a queued update stealing focus after removal.
 */
export function focusScreen(node: HTMLElement, key: string) {
  let current = key;
  let generation = 0;
  const focus = async () => {
    const request = ++generation;
    await tick();
    if (request !== generation || !node.isConnected) return;
    const activeWindow = [...node.querySelectorAll<HTMLElement>('[data-window-focus]')].find(
      (element) => !element.closest('[hidden], [inert]'),
    );
    (activeWindow ?? node).focus({ preventScroll: true });
  };
  void focus();
  return {
    update(next: string) {
      if (next !== current) {
        current = next;
        void focus();
      }
    },
    destroy() {
      ++generation;
    },
  };
}
