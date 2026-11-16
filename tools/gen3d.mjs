// Image-to-3D for approved concepts. Usage: node gen3d.mjs  (reads JOBS below; max 4 at once, Aholo allows 5)
import { config } from 'dotenv'; config({ path: new URL('../.env', import.meta.url).pathname, quiet: true });
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY, region: 'com' });
const C = 30000, S = 20000;
const JOBS = (process.argv[2] ? JSON.parse(process.argv[2]) : [
  ['hanuman', 'G1-Turbo', C], ['lankini', 'G1-Turbo', C], ['guard', 'G1-Turbo', C], ['sita', 'G1-Turbo', C],
  ['ravana', 'G1-Turbo', C], ['lanka-gate', 'G1-Turbo', S], ['palace', 'G1-Turbo', S], ['ashoka-tree', 'G1-Turbo', S],
  ['gada', 'G1-Turbo', 10000], ['hanuman', 'G1', C],
]);
async function run([id, version, faceCount]) {
  const tag = `${id}-${version === 'G1' ? 'g1' : 'turbo'}`;
  const dir = `${root}assets/lux3d/${tag}/`; mkdirSync(dir, { recursive: true });
  if (existsSync(dir + 'model.glb')) return console.log(`[${tag}] already done, skipped`);
  const img = `${root}assets/concepts-flow/${id}/${id}-1.clean.jpg`;
  const t0 = Date.now();
  const taskId = await lux3d.imgTo3d.createFromFile(img, { version, faceCount, outputFormat: ['glb'] });
  console.log(`[${tag}] task ${taskId} started`);
  const done = await lux3d.tasks.waitFor(taskId, { timeoutMs: 15 * 60 * 1000 }).catch(e => ({ error: String(e?.message || e) }));
  const secs = Math.round((Date.now() - t0) / 1000);
  writeFileSync(dir + 'task.json', JSON.stringify({ id, version, faceCount, source: img.replace(root, ''), taskId, secs, result: done }, null, 2));
  if (done.error) throw new Error(`[${tag}] failed after ${secs}s: ${done.error}`);
  const url = (JSON.stringify(done).match(/https?:[^"]+?\.glb[^"]*/) || [])[0];
  if (!url) throw new Error(`[${tag}] no GLB in result`);
  const b = Buffer.from(await (await fetch(url)).arrayBuffer()); writeFileSync(dir + 'model.glb', b);
  console.log(`[${tag}] done in ${secs}s, ${(b.length / 1e6).toFixed(1)} MB`);
}
const queue = [...JOBS]; let failed = false;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length && !failed) { const j = queue.shift(); try { await run(j); } catch (e) { failed = true; console.log('STOP:', e.message); } }
}));
console.log(failed ? 'stopped at first failure' : 'all done');
