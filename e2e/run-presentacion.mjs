// Lanza el guion de presentacion usando los browsers locales de Playwright
// (los mismos que ya tenes en .playwright-browsers). Equivalente a:
//   PLAYWRIGHT_BROWSERS_PATH=./.playwright-browsers node e2e/presentacion-video.mjs

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = path.join(root, 'e2e', 'presentacion-video.mjs');

const result = spawnSync(process.execPath, [script], {
    cwd: root,
    stdio: 'inherit',
    env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.playwright-browsers')
    }
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
