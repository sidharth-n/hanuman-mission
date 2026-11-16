// Usage: node img.mjs <asset-name> <variant> "<prompt>"   -> assets/concepts/<asset>/<variant>.png
import { config } from 'dotenv'; config({ path: new URL('../.env', import.meta.url).pathname, quiet: true });
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d';
import { writeFileSync, mkdirSync } from 'node:fs';
const [asset, variant, prompt] = process.argv.slice(2);
const lux3d = createLux3dClient({ apiKey: process.env.AHOLO_API_KEY, region: 'com' });
const t0 = Date.now();
const taskId = await lux3d.multimodalToImage.create({ prompt });
const done = await lux3d.tasks.waitFor(taskId);
const secs = ((Date.now() - t0) / 1000).toFixed(0);
const dir = new URL(`../assets/concepts/${asset}/`, import.meta.url).pathname; mkdirSync(dir, { recursive: true });
writeFileSync(dir + `${variant}.json`, JSON.stringify({ asset, variant, prompt, taskId, secs, result: done }, null, 2));
const urls = [...new Set(JSON.stringify(done).match(/https?:[^"]+?\.(png|jpe?g|webp)[^"]*/gi) || [])];
for (const [i, u] of urls.entries()) { const b = Buffer.from(await (await fetch(u)).arrayBuffer()); const f = `${variant}${i ? '-' + i : ''}.png`; writeFileSync(dir + f, b); console.log(`[${asset}/${variant}] ${secs}s saved ${f} ${(b.length/1e3).toFixed(0)} KB`); }
if (!urls.length) console.log(`[${asset}/${variant}] ${secs}s no image url found`, JSON.stringify(done).slice(0, 300));
