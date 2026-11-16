// Usage: node gen.mjs <name> <G1|G1-Turbo> "<prompt>"
import { config } from 'dotenv'; config({ path: new URL('../.env', import.meta.url).pathname, quiet: true });
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { writeFileSync, mkdirSync } from 'node:fs';
const [name, version, prompt] = process.argv.slice(2);
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY, region: 'com' });
const t0 = Date.now();
const taskId = await lux3d.textTo3d.create({ prompt, version, outputFormat: ['glb'] });
console.log(`[${name}] task ${taskId} created`);
const done = await lux3d.tasks.waitFor(taskId);
const secs = ((Date.now() - t0) / 1000).toFixed(0);
const dir = new URL(`../assets/lux3d/${name}/`, import.meta.url).pathname; mkdirSync(dir, { recursive: true });
writeFileSync(dir + 'task.json', JSON.stringify({ name, version, prompt, taskId, secs, result: done }, null, 2));
const urls = JSON.stringify(done).match(/https?:[^"]+?\.glb[^"]*/g) || [];
console.log(`[${name}] done in ${secs}s; glb urls: ${urls.length}`);
for (const [i, u] of urls.entries()) { const r = await fetch(u); const b = Buffer.from(await r.arrayBuffer()); writeFileSync(dir + `model${i ? '-' + i : ''}.glb`, b); console.log(`  saved model${i ? '-' + i : ''}.glb ${(b.length/1e6).toFixed(1)} MB`); }
