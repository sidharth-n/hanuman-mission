// Packs the flat texture images into one sheet for the city buildings, plus a small glow sheet for lit windows and lamps.
// Run: node tools/atlas.mjs   (needs ffmpeg)
// Writes game/public/assets/tex/{city.jpg,city-glow.jpg,paving.jpg} and game/src/atlas.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const src = id => `${root}assets/textures-flow/${id}/${id}-1.clean.jpg`;
const out = `${root}game/public/assets/tex/`;
const W = 2048, H = 1024;

// name: [x, y, w, h on the sheet, tile width and height in metres (0 = stretch to fit), source id, crop x, y, w, h]
const CELLS = {
  stone:   [0, 0, 512, 512, 3, 3, 'wall-stone', 0, 0, 880, 880],
  plaster: [512, 0, 512, 512, 3, 3, 'wall-plaster', 0, 0, 880, 880],
  roof:    [1024, 0, 512, 512, 3.4, 3.4, 'roof-tiles', 0, 0, 880, 880],
  tower:   [1536, 0, 512, 512, 3, 3, 'tower', 0, 0, 880, 880],
  door:    [0, 512, 320, 512, 0, 0, 'door', 52, 42, 664, 1258],
  window:  [320, 512, 320, 512, 0, 0, 'window', 222, 48, 580, 928],
  wood:    [640, 512, 256, 256, 1.6, 1.6, 'wood', 0, 0, 880, 880],
  paving:  [640, 768, 256, 256, 2, 2, 'paving', 0, 0, 880, 880],
  frieze:  [896, 512, 1024, 256, 2, 0.5, 'frieze', 0, 168, 1136, 284],
  lotus:   [896, 768, 1024, 128, 2, 0.25, 'frieze', 0, 615, 1080, 135],
};
// flat colours: [x, y, w, h, colour on the sheet, colour on the glow sheet]
const FLAT = {
  gold: [896, 896, 128, 128, '0x9c7630', '0x000000'],
  dark: [1024, 896, 128, 128, '0x1c1814', '0x000000'],
  lamp: [1152, 896, 128, 128, '0xd08a3a', '0xff9436'],
  ember: [1280, 896, 128, 128, '0x5a2a12', '0x000000'],
};

mkdirSync(out, { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

function sheet(file, scale, glow) {
  const inputs = ['-f', 'lavfi', '-i', `color=c=0x1c1814:s=${W * scale}x${H * scale}`], chains = []; let last = '0', n = 1;
  const put = (label, x, y) => { chains.push(`[${last}][${label}]overlay=${x * scale}:${y * scale}[o${n}]`); last = `o${n}`; n++; };
  if (glow) chains.push(`[0]lutrgb=r=0:g=0:b=0[blk]`), last = 'blk';
  for (const [name, [x, y, w, h, , , id, cx, cy, cw, ch]] of Object.entries(CELLS)) {
    if (glow && name !== 'window') continue;
    inputs.push('-i', src(id)); const i = inputs.filter(a => a === '-i').length - 1;
    // on the glow sheet keep only the orange lamplight behind the lattice, softened a little
    const keep = `if(gt(r(X,Y),105)*lt(g(X,Y),0.74*r(X,Y)),1,0)`;
    const extra = glow ? `,format=rgb24,geq=r='min(255,1.7*r(X,Y)*${keep})':g='min(255,1.7*g(X,Y)*${keep})':b='min(255,1.7*b(X,Y)*${keep})',gblur=sigma=1.6` : '';
    chains.push(`[${i}]crop=${cw}:${ch}:${cx}:${cy},scale=${w * scale}:${h * scale}:flags=lanczos${extra}[c${i}]`);
    put(`c${i}`, x, y);
  }
  for (const [x, y, w, h, colour, glowColour] of Object.values(FLAT)) {
    inputs.push('-f', 'lavfi', '-i', `color=c=${glow ? glowColour : colour}:s=${w * scale}x${h * scale}`);
    const i = inputs.filter(a => a === '-i').length - 1; put(`${i}`, x, y);
  }
  ff([...inputs, '-filter_complex', chains.join(';'), '-map', `[${last}]`, '-frames:v', '1', '-q:v', glow ? '4' : '3', out + file]);
  console.log(file, Math.round(statSync(out + file).size / 1024), 'KB');
}

sheet('city.jpg', 1, false);
sheet('city-glow.jpg', 0.5, true);
ff(['-i', src('paving'), '-vf', 'crop=880:880:0:0,scale=512:512:flags=lanczos', '-frames:v', '1', '-q:v', '4', out + 'paving.jpg']);
console.log('paving.jpg', Math.round(statSync(out + 'paving.jpg').size / 1024), 'KB');

const cells = {};
for (const [name, [x, y, w, h, tw, th]] of Object.entries(CELLS)) cells[name] = [x, y, w, h, tw, th];
for (const [name, [x, y, w, h]] of Object.entries(FLAT)) cells[name] = [x, y, w, h, -1, -1];   // -1: one flat colour
writeFileSync(`${root}game/src/atlas.json`, JSON.stringify({ w: W, h: H, cells }, null, 1) + '\n');
console.log('wrote game/src/atlas.json');
