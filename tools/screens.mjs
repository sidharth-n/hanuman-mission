// Builds assets/library/screens.html: mock-ups of the game's screens (menu, in-run display, fight, settings, results), for choosing the look.
// Run: node tools/screens.mjs
import { readdirSync, writeFileSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const dir = 'assets/screens/';
const SCREENS = [
  ['s01-title', 'Title and main menu', 'Style A: carved stone and beaten gold'],
  ['s13-title-b', 'Title and main menu', 'Style B: temple mural and painted palm leaf'],
  ['s02-loading', 'Loading', 'Shown until every model and picture is ready'],
  ['s03-run', 'Running, phone upright', 'Distance, lamps collected, strength meter, flight and giant buttons'],
  ['s04-run-wide', 'Running, phone sideways or desktop', 'The same display on a wide screen'],
  ['s05-flight', 'Wind flight', 'The boost: he flies over everything for a few seconds'],
  ['s06-fight', 'Fight', 'Guards block the way; strike and dodge, then run on'],
  ['s11-story', 'Story moment', 'Sita in the grove; the lines of text are placeholders'],
  ['s10-map', 'Map of Lanka', 'The six chapters along the route'],
  ['s07-settings', 'Settings', 'Also the pause screen'],
  ['s08-captured', 'Captured', 'When the guards catch him'],
  ['s09-victory', 'Victory', 'After Lanka burns'],
  ['s12-icons', 'Icon set', 'Lamp, mace, ring, hair jewel, flight, giant, shield, sword and the menu icons'],
];
const files = existsSync(root + dir) ? readdirSync(root + dir) : [];
const cards = SCREENS.map(([id, title, note]) => {
  const f = files.find(x => x === `${id}-1.clean.jpg`) || files.find(x => x === `${id}-1.jpg`);
  if (!f) return '';
  const cls = id === 's04-run-wide' ? 'wide' : id === 's12-icons' ? 'square' : '';
  return `<figure class="${cls}" id="${id}"><a href="../screens/${f}" target="_blank"><img loading="lazy" src="../screens/${f}" alt="${title}"></a><figcaption><b>${title}</b><span>${note}</span></figcaption></figure>`;
}).filter(Boolean);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hanuman Mission · Screens</title>
<style>
:root{--bg:#0e0b08;--panel:#18130e;--line:#3a2c1c;--gold:#e8b44c;--ink:#f3e9d8;--mute:#a8977f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,Segoe UI,sans-serif}
.top{padding:28px 32px 18px;border-bottom:1px solid var(--line)}
h1{margin:0;font:600 26px/1.2 Georgia,serif;color:var(--gold)}.sub{color:var(--mute);margin-top:6px;max-width:900px}
.sub a{color:var(--gold)}main{padding:24px 32px 60px;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:18px;align-items:start;max-width:1700px}
figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
figure.wide{grid-column:span 2}img{display:block;width:100%;height:auto}
figcaption{padding:10px 14px}figcaption b{color:var(--gold);display:block;font:600 16px Georgia,serif}figcaption span{color:var(--mute)}
@media(max-width:700px){.top,main{padding-left:14px;padding-right:14px}figure.wide{grid-column:auto}}
</style></head><body>
<header class="top"><h1>Hanuman Mission · the screens</h1>
<p class="sub">Painted mock-ups of every screen, to choose the look before the real ones are built. They are not the running game. Click a picture to see it full size. <a href="index.html">Asset library</a> · <a href="shots.html">Gameplay frames</a></p></header>
<main>${cards.join('') || '<p>Generating…</p>'}</main></body></html>`;
writeFileSync(root + 'assets/library/screens.html', html);
console.log('wrote assets/library/screens.html', cards.length, 'screens');
