// Builds assets/library/shots.html: mock gameplay frames grouped by game design, for choosing the look and camera.
// Run: node tools/shots.mjs
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const dir = 'assets/gameplay-shots/';
const DESIGNS = [
  ['f', 'Chosen direction · the run through Lanka, stage by stage', 'Camera behind Hanuman, three lanes, swipe to dodge. From the street where he is spotted, up the steps, through the palace, to Sita and the fire.'],
  ['g', 'The route from above', 'Sea gate at the bottom, bazaar street, the grand stairway, Ravana\'s palace at the top, the Ashoka grove behind it.'],
  ['a', 'A · Bazaar street', 'Camera low behind Hanuman. Narrow torch-lit street, lanes to switch, obstacles to jump and slide.'],
  ['b', 'B · Rooftops', 'Camera behind and above. Leaping roof to roof over the city, palace on the hill ahead.'],
  ['c', 'C · Side view', 'Camera side-on like a film. Layers of city behind, guards chasing in frame.'],
  ['d', 'D · Royal avenue from above', 'Camera high. Wide avenue, statues, squads of guards, the whole city grid visible.'],
  ['e', 'Story moments (same in every design)', 'The quiet meeting with Sita and the final escape.'],
];
const BEAT = {
  'f1-spotted': '1 · Spotted: guards right behind him', 'f2-turn': '2 · A turn: swipe left or right', 'f3-steps': '3 · The grand stairway up to the palace',
  'f4-palace-court': '4 · Palace courtyard, guards at the doors', 'f5-pillared-hall': '5 · Inside: the pillared hall', 'f6-inner-corridor': '6 · Inside: corridors and steps',
  'f7-ashoka-gate': '7 · Quiet walk into the Ashoka grove', 'f8-tail-lit': '8 · Captured: the tail is set on fire', 'g1-lanka-map': 'Lanka and the route',
  'a1-bazaar-chase': 'The chase', 'a2-bazaar-fire': 'Tail on fire', 'a3-bazaar-chase-portrait': 'The chase, phone held upright',
  'b1-rooftop-run': 'The chase', 'b2-rooftop-fire': 'Tail on fire', 'c1-side-chase': 'The chase', 'c2-side-giant': 'Giant Hanuman',
  'd1-avenue-high': 'The chase', 'd2-avenue-fire': 'Giant Hanuman, tail on fire', 'e1-ashoka-grove': 'Sita in the Ashoka grove',
  'e2-escape-flight': 'Flying away from burning Lanka',
};
const files = existsSync(root + dir) ? readdirSync(root + dir) : [];
const shots = Object.keys(BEAT).map(id => {
  const f = files.find(x => x === `${id}-1.clean.jpg`) || files.find(x => x === `${id}-1.jpg`);
  return f ? { id, f } : null;
}).filter(Boolean);
const section = ([k, title, how]) => {
  const mine = shots.filter(s => s.id[0] === k);
  if (!mine.length) return '';
  return `<section><h2>${title}</h2><p class="how">${how}</p><div class="grid">${mine.map(s =>
    `<figure class="${s.id.includes('portrait') ? 'tall' : ''}"><a href="../gameplay-shots/${s.f}" target="_blank"><img loading="lazy" src="../gameplay-shots/${s.f}" alt="${BEAT[s.id]}"></a><figcaption><b>${/^[fg]/.test(s.id) ? '' : s.id.slice(0, 2).toUpperCase()}</b> ${BEAT[s.id]}</figcaption></figure>`).join('')}</div></section>`;
};
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hanuman Mission · Game look options</title>
<style>
:root{--bg:#0e0b08;--panel:#18130e;--line:#3a2c1c;--gold:#e8b44c;--ink:#f3e9d8;--mute:#a8977f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,Segoe UI,sans-serif}
.top{padding:28px 32px 18px;border-bottom:1px solid var(--line)}
h1{margin:0;font:600 26px/1.2 Georgia,serif;color:var(--gold)}.sub{color:var(--mute);margin-top:6px;max-width:900px}
.sub a{color:var(--gold)}main{padding:8px 32px 60px;max-width:1700px}
h2{font:600 20px Georgia,serif;color:var(--gold);margin:30px 0 4px}.how{color:var(--mute);margin:0 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr));gap:16px;align-items:start}
figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
figure.tall{max-width:360px}img{display:block;width:100%;height:auto}
figcaption{padding:10px 14px;color:var(--mute)}figcaption b{color:var(--gold);margin-right:8px}
@media(max-width:600px){.top,main{padding-left:14px;padding-right:14px}}
</style></head><body>
<header class="top"><h1>Hanuman Mission · how the game could look</h1>
<p class="sub">These are painted mock-ups, not the running game: each one shows a different camera and world for the same chase through Lanka at night. The chosen direction is at the top: camera behind Hanuman, swipe controls. The earlier options A to D are kept below for comparison. Click a picture to see it full size. <a href="index.html">Asset library</a></p></header>
<main>${DESIGNS.map(section).join('') || '<p class="how">Generating…</p>'}</main></body></html>`;
writeFileSync(root + 'assets/library/shots.html', html);
console.log('wrote assets/library/shots.html', shots.length, 'shots');
