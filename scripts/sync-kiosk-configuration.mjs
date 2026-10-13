import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectRoot, distRoot } from './build-paths.mjs';
import { readKioskConfiguration } from './kiosk-config-source.mjs';

const { source, sourcePath } = readKioskConfiguration(projectRoot);
writeFileSync(resolve(distRoot, 'kiosk-config.json'), source);
console.log(
  sourcePath === resolve(projectRoot, 'static/kiosk-config.json')
    ? 'Prepared public kiosk configuration'
    : 'Prepared local private kiosk configuration',
);
