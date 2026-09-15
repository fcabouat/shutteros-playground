import type { Scene } from '@shutteros/core/model/game';

/** Visual cues belong to the desktop; the core only tracks assistance progression. */
export function hintTarget(scene: Scene): string | undefined {
  if (scene.kind !== 'challenge' || scene.step !== 'choose') return undefined;
  switch (scene.id) {
    case 'usb':
      return 'eject';
    case 'incident':
      return 'network-status';
    case 'mail':
      return 'sender-details';
    case 'spoof':
      return 'personal-destination';
    case 'ai':
      return 'tool';
    default:
      return undefined;
  }
}
