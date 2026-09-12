import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Locate the nearest package root for every rendered node_modules module. */
export function bundleInventory(): Plugin {
  return {
    name: 'shutteros-bundle-inventory',
    generateBundle(_options, bundle) {
      const roots = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const [id, module] of Object.entries(output.modules)) {
          if (!id.includes('/node_modules/') || module.renderedLength === 0) continue;
          let directory = path.dirname(id.replace(/^\0/, '').split('?')[0]!);
          while (directory !== path.dirname(directory)) {
            const manifest = path.join(directory, 'package.json');
            if (existsSync(manifest)) {
              const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
              if (pkg.name) {
                roots.add(directory);
                break;
              }
            }
            directory = path.dirname(directory);
          }
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: 'bundled-packages.json',
        source: JSON.stringify([...roots]),
      });
    },
  };
}
