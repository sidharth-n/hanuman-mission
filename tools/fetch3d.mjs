// Collect results of already-started Lux3D tasks. Usage: node fetch3d.mjs tag:taskId ...
import { config } from 'dotenv'; config({ path: new URL('../.env', import.meta.url).pathname, quiet: true });
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY, region: 'com' });
await Promise.all(process.argv.slice(2).map(async arg => {
  const [tag, id] = arg.split(':'); const dir = `${root}assets/lux3d/${tag}/`; mkdirSync(dir, { recursive: true });
  try {
    const done = await lux3d.tasks.waitFor(Number(id));
    writeFileSync(dir + 'task.json', JSON.stringify({ tag, taskId: Number(id), result: done }, null, 2));
    const url = (JSON.stringify(done).match(/https?:[^"]+?\.glb[^"]*/) || [])[0];
    const b = Buffer.from(await (await fetch(url)).arrayBuffer()); writeFileSync(dir + 'model.glb', b);
    console.log(`[${tag}] ${(b.length / 1e6).toFixed(1)} MB`);
  } catch (e) { console.log(`[${tag}] FAILED: ${e.message}`); }
}));
