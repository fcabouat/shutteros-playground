import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Inventory packages contributing rendered JS, rather than the entire lockfile.
 * Absolute package roots let the packaging step read the matching installed licenses;
 * package-notices.mjs consumes and removes this build-only manifest before distribution.
 * Tailwind's generated CSS is added there because it does not appear as rendered JS.
 */
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
