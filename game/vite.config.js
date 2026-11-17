import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// One short name for every model and picture the game is built with. It changes whenever any of them does, and the
// game asks for them under it, so no browser and no offline cache ever answers with an old one.
function stamp() {
  const hash = createHash('md5');
  const walk = dir => {
    let list = []; try { list = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const at = join(dir, e.name);
      if (e.isDirectory()) walk(at);
      else if (/\.(glb|jpg|png|webp|woff2)$/.test(e.name)) hash.update(at).update(readFileSync(at));
    }
  };
  walk('public/assets'); walk('public/ui');
  return hash.digest('hex').slice(0, 10);
}

export default defineConfig({ base: './', define: { __STAMP__: JSON.stringify(stamp()) }, build: { target: 'es2020', chunkSizeWarningLimit: 900 } });
