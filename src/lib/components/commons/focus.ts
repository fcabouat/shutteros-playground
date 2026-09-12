/** Screen navigation gets a focus destination; timer updates keep the current focus. */
export function focusScreen(node: HTMLElement, key: string) {
  let current = key;
  const focus = () => node.focus({ preventScroll: true });
  focus();
  return {
    update(next: string) {
      if (next !== current) {
        current = next;
        focus();
      }
    },
  };
}
