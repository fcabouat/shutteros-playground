import { describe, expect, it, vi } from 'vitest';
import { blocksKioskKey, createKioskInput } from '../../src/lib/infrastructure/kiosk-input';

function key(key: string, extra: Record<string, unknown> = {}) {
  return {
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    isComposing: false,
    getModifierState: () => false,
    ...extra,
  };
}

function host(search = '?kiosk=1') {
  const view = Object.assign(new EventTarget(), { location: { search } });
  const doc = Object.assign(new EventTarget(), {
    fullscreenElement: null as unknown,
    documentElement: {
      requestFullscreen: vi.fn(async () => {
        doc.fullscreenElement = {};
      }),
    },
    exitFullscreen: vi.fn(async () => {
      doc.fullscreenElement = null;
    }),
  });
  const keyboard = { lock: vi.fn(async () => {}), unlock: vi.fn() };
  const guard = createKioskInput(
    view as unknown as Window,
    doc as unknown as Document,
    { keyboard } as unknown as Navigator,
  );
  return { view, doc, keyboard, guard };
}

describe('kiosk input policy', () => {
  it.each([
    'a',
    'é',
    '!',
    ' ',
    'Dead',
    'Process',
    'Tab',
    'Enter',
    'Escape',
    'ArrowLeft',
    'Backspace',
    'CapsLock',
  ])('preserves typing and navigation: %s', (value) => {
    expect(blocksKioskKey(key(value))).toBe(false);
  });
  it('preserves AltGraph, composition and the operator reset', () => {
    expect(
      blocksKioskKey(key('@', { ctrlKey: true, altKey: true, getModifierState: () => true })),
    ).toBe(false);
    expect(blocksKioskKey(key('Unidentified', { isComposing: true }))).toBe(false);
    expect(blocksKioskKey(key('Home', { ctrlKey: true, altKey: true }))).toBe(false);
  });
  it.each([
    key('w', { ctrlKey: true }),
    key('N', { ctrlKey: true }),
    key('F4', { altKey: true }),
    key('F12'),
    key('Meta', { metaKey: true }),
  ])('blocks browser commands delivered to the page: $key', (event) => {
    expect(blocksKioskKey(event)).toBe(true);
  });
});

describe('kiosk input lifetime', () => {
  it('blocks browser mouse gestures only in kiosk mode and preserves normal scrolling', () => {
    for (const search of ['', '?kiosk=1']) {
      const { guard, view } = host(search);
      const send = (type: string, extra = {}) =>
        view.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), extra));
      expect(send('contextmenu')).toBe(search === '');
      expect(send('auxclick', { button: 1 })).toBe(search === '');
      expect(send('wheel', { ctrlKey: true })).toBe(search === '');
      expect(send('wheel', { ctrlKey: false })).toBe(true);
      guard.dispose();
      expect(send('contextmenu')).toBe(true);
    }
  });
  it.each(['', '?kiosk=0', '?kiosk=true'])(
    'leaves ordinary browsing unchanged (%s)',
    async (search) => {
      const { guard, keyboard, doc, view } = host(search);
      await guard.activate();
      doc.fullscreenElement = {};
      const event = Object.assign(
        new Event('keydown', { cancelable: true }),
        key('w', { ctrlKey: true }),
      );
      view.dispatchEvent(event);
      guard.dispose();
      expect(event.defaultPrevented).toBe(false);
      expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
      expect(keyboard.lock).not.toHaveBeenCalled();
      expect(keyboard.unlock).not.toHaveBeenCalled();
    },
  );
  it('captures delivered shortcuts only in fullscreen and cleans up', async () => {
    const { guard, view, doc, keyboard } = host();
    const event = () =>
      Object.assign(new Event('keydown', { cancelable: true }), key('w', { ctrlKey: true }));
    expect(view.dispatchEvent(event())).toBe(true);
    await guard.activate();
    expect(keyboard.lock).toHaveBeenCalledOnce();
    expect(view.dispatchEvent(event())).toBe(false);
    guard.dispose();
    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
    expect(view.dispatchEvent(event())).toBe(true);
  });
  it('does not retry on fullscreen exit and releases a late lock', async () => {
    const { guard, doc, keyboard } = host();
    let release!: () => void;
    keyboard.lock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const activation = guard.activate();
    await vi.waitFor(() => expect(keyboard.lock).toHaveBeenCalledOnce());
    doc.fullscreenElement = null;
    doc.dispatchEvent(new Event('fullscreenchange'));
    release();
    await activation;
    expect(keyboard.unlock).toHaveBeenCalledTimes(2);
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledOnce();
    guard.dispose();
  });
  it('handles disposal while fullscreen is pending', async () => {
    const { guard, doc, keyboard } = host();
    let release!: () => void;
    doc.documentElement.requestFullscreen.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            doc.fullscreenElement = {};
            resolve();
          };
        }),
    );
    const activation = guard.activate();
    guard.dispose();
    release();
    await activation;
    expect(keyboard.lock).not.toHaveBeenCalled();
    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
  });
  it('ignores unavailable or rejected APIs without interrupting login', async () => {
    const { guard, doc, keyboard } = host();
    doc.documentElement.requestFullscreen.mockRejectedValue(new Error('Denied'));
    await expect(guard.activate()).resolves.toBeUndefined();
    expect(keyboard.lock).not.toHaveBeenCalled();
    guard.dispose();
    const unsupported = createKioskInput(
      { location: { search: '' } } as Window,
      {} as Document,
      {} as Navigator,
    );
    await expect(unsupported.activate()).resolves.toBeUndefined();
    unsupported.dispose();
  });
});
