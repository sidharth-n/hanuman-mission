// Multi-view G1: node gen3d-mv.mjs <tag> <faceCount> img1 img2 ...  (first image is the main reference)
import { config } from 'dotenv'; config({ path: new URL('../.env', import.meta.url).pathname, quiet: true });
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const [tag, faces, ...imgs] = process.argv.slice(2);
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY, region: 'com' });
const dir = `${root}assets/lux3d/${tag}/`; mkdirSync(dir, { recursive: true });
const t0 = Date.now();
const taskId = await lux3d.imgTo3d.createFromFiles(imgs.map(i => root + i), { version: 'G1', faceCount: Number(faces), outputFormat: ['glb'] });
console.log(`[${tag}] task ${taskId} started`);
const done = await lux3d.tasks.waitFor(taskId, { timeoutMs: 20 * 60 * 1000 });
const secs = Math.round((Date.now() - t0) / 1000);
writeFileSync(dir + 'task.json', JSON.stringify({ tag, version: 'G1', faceCount: Number(faces), sources: imgs, taskId, secs, result: done }, null, 2));
const url = (JSON.stringify(done).match(/https?:[^"]+?\.glb[^"]*/) || [])[0];
const b = Buffer.from(await (await fetch(url)).arrayBuffer()); writeFileSync(dir + 'model.glb', b);
console.log(`[${tag}] done in ${secs}s, ${(b.length / 1e6).toFixed(1)} MB`);
