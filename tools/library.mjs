// Builds assets/library/index.html from assets/manifest.json plus whatever files exist on disk.
// Run: node tools/library.mjs   then serve the repo root over http (GLB previews need http).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const m = JSON.parse(readFileSync(root + 'assets/manifest.json', 'utf8'));
const esc = (s = '') => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const list = d => (existsSync(root + d) ? readdirSync(root + d) : []);
const readJson = f => { try { return JSON.parse(readFileSync(root + f, 'utf8')); } catch { return null; } };

let spent = 0;
const card = a => {
  const cdir = `assets/concepts/${a.id}/`;
  const variants = list(cdir).filter(f => /^[a-z]\.png$/.test(f)).sort();
  const concepts = variants.map(f => {
    const v = f[0]; const meta = readJson(cdir + v + '.json') || {};
    return `<figure class="concept"><img loading="lazy" src="../concepts/${a.id}/${f}" alt="${esc(a.name)} concept ${v.toUpperCase()}">
      <figcaption><b>${v.toUpperCase()}</b><span>${meta.secs ? meta.secs + ' s' : ''}</span>
      ${meta.prompt ? `<details><summary>prompt</summary><p>${esc(meta.prompt)}</p></details>` : ''}</figcaption></figure>`;
  }).join('');
  const fdir = `assets/concepts-flow/${a.id}/`;
  const flowFiles = list(fdir).filter(f => /-\d+\.clean\.jpg$/.test(f)).sort();
  const flow = flowFiles.map(f => {
    const n = f.match(/-(\d+)\.clean/)[1];
    return `<figure class="concept"><img loading="lazy" src="../concepts-flow/${a.id}/${f}" alt="${esc(a.name)} Flow option ${n}">
      <figcaption><b>${n}</b><span>Flow${a.group === "Characters" ? ", T-pose" : ""}</span></figcaption></figure>`;
  }).join('');
  const sdir = `assets/concepts-flow-stylized/${a.id}/`;
  const stylized = list(sdir).filter(f => /-\d+\.clean\.jpg$/.test(f)).sort()
    .map(f => `<figure class="concept"><img loading="lazy" src="../concepts-flow-stylized/${a.id}/${f}" alt="${esc(a.name)} stylized"></figure>`).join('');
  const prompt = existsSync(root + `assets/prompts/flow/${a.id}.txt`) ? readFileSync(root + `assets/prompts/flow/${a.id}.txt`, 'utf8') : '';
  let model = '';
  const t = a.test3d && readJson(`assets/lux3d/${a.test3d}/task.json`);
  if (t) {
    const glb = `assets/lux3d/${a.test3d}/model.glb`;
    model = `<div class="model"><h4>3D test (made from text before the images-first rule)</h4>
      ${existsSync(root + glb) ? `<model-viewer src="../lux3d/${a.test3d}/model.glb" camera-controls auto-rotate shadow-intensity="1" exposure="1.1"></model-viewer>` : ''}
      <p class="meta">Lux3D ${esc(t.version)} · ${t.secs} s · 13 credits · 287k triangles, 18.6 MB (must be cut to about a tenth for the web)</p></div>`;
  }
  const label = d => d.endsWith('-g1-multiview') ? 'Lux3D G1 · 3 views · 300k faces' : d.endsWith('-g1') ? 'Lux3D G1 · 1 view · 300k faces' : 'Lux3D Turbo · 1 view';
  const models3d = list('assets/lux3d').filter(d => d.startsWith(a.id + '-') && d !== a.test3d && existsSync(`${root}assets/lux3d/${d}/model.glb`))
    .sort((x, y) => (y.includes('g1') - x.includes('g1')) || x.localeCompare(y))
    .map(d => {
      const t = readJson(`assets/lux3d/${d}/task.json`) || {};
      const mb = (statSync(`${root}assets/lux3d/${d}/model.glb`).size / 1e6).toFixed(1);
      const poster = existsSync(`${root}assets/lux3d/${d}/preview-1.png`) ? `poster="../lux3d/${d}/preview-1.png"` : '';
      return `<figure class="m3d"><model-viewer src="../lux3d/${d}/model.glb" ${poster} loading="lazy" reveal="interaction" camera-controls auto-rotate shadow-intensity="1" exposure="1.1"></model-viewer>
        <figcaption><b>${label(d)}</b><span>${mb} MB raw</span><a class="open3d" href="viewer.html#${d}">Open in 3D viewer ↗</a></figcaption></figure>`;
    }).join('');
  const picked = a.pick ? `<p class="picked">Approved image: option ${esc(a.pick.match(/-(\d+)\.clean/)?.[1] || '?')}</p>` : '';
  return `<article class="card" id="${a.id}">
    <header><h3>${esc(a.name)}</h3><span class="chip ${a.status}">${a.status === 'concept' ? 'awaiting your pick' : esc(a.status)}</span></header>
    <p class="where">${esc(a.where)}</p>
    ${models3d ? `<h4 class="round">3D from Lux3D</h4><div class="models">${models3d}</div>${picked}` : ''}
    <h4 class="round">Round 3 · Flow, realistic${flow && !a.pick ? ' · pick 1 or 2' : ''}</h4>
    <div class="concepts">${flow || '<p class="empty">Generating…</p>'}</div>
    ${prompt ? `<details class="p"><summary>prompt</summary><p>${esc(prompt)}</p></details>` : ''}
    ${a.note ? `<p class="note">${esc(a.note)}</p>` : ''}
    ${stylized ? `<details class="r1"><summary>Round 2 · Flow, stylized (dropped: too cartoon)</summary><div class="concepts small">${stylized}</div></details>` : ''}
    <details class="r1"><summary>Round 1 · Aholo image (older, not T-pose)</summary><div class="concepts small">${concepts || '<p class="empty">none</p>'}</div></details>
    <p class="needs">Next: ${esc(a.needs)}</p>
    ${model}
  </article>`;
};

const groups = [...new Set(m.assets.map(a => a.group))];
const counts = s => m.assets.filter(a => a.status === s).length;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.game)} · Asset library</title>
<script type="module" src="https://unpkg.com/@google/model-viewer@4/dist/model-viewer.min.js"></script>
<style>
:root{--bg:#0e0b08;--panel:#18130e;--line:#3a2c1c;--gold:#e8b44c;--ink:#f3e9d8;--mute:#a8977f;--red:#c0392b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,Segoe UI,sans-serif}
.top{padding:28px 32px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(14,11,8,.94);backdrop-filter:blur(6px);z-index:5}
h1{margin:0;font:600 26px/1.2 Georgia,serif;color:var(--gold);letter-spacing:.3px}
.sub{color:var(--mute);margin-top:4px}.stats{display:flex;gap:18px;margin-top:10px;color:var(--mute);font-size:13px}.stats b{color:var(--ink)}
main{padding:20px 32px 60px;max-width:1500px}h2{font:600 18px Georgia,serif;color:var(--gold);margin:28px 0 12px;border-bottom:1px solid var(--line);padding-bottom:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
.card header{display:flex;justify-content:space-between;align-items:center;gap:10px}h3{margin:0;font-size:18px}
.chip{font-size:12px;padding:3px 10px;border-radius:99px;border:1px solid var(--line);white-space:nowrap}
.chip.concept{color:var(--gold);border-color:var(--gold)}.chip.approved{color:#7fd17f;border-color:#7fd17f}.chip.rejected{color:var(--red);border-color:var(--red)}
.where{color:var(--mute);margin:4px 0 10px;font-size:13px}
.concepts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.concept{margin:0;background:#cfcfcf;border-radius:8px;overflow:hidden}.concept img{width:100%;display:block;aspect-ratio:1;object-fit:contain}
figcaption{background:var(--panel);padding:6px 2px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;color:var(--mute);font-size:12px}figcaption b{color:var(--gold);font-size:15px}
details{width:100%}summary{cursor:pointer}details p{margin:4px 0 0;color:var(--mute)}
.note{background:#2a1f12;border-left:3px solid var(--gold);padding:8px 10px;border-radius:4px;font-size:13px}
.needs{color:var(--mute);font-size:13px;margin:8px 0 0}.empty{color:var(--mute)}
.model{margin-top:12px;border-top:1px dashed var(--line);padding-top:10px}.model h4{margin:0 0 6px;font-size:13px;color:var(--mute);font-weight:500}
model-viewer{width:100%;height:340px;background:#cfcfcf;border-radius:8px}.meta{color:var(--mute);font-size:12px;margin:6px 0 0}
.round{margin:4px 0 8px;font-size:13px;color:var(--gold);font-weight:600}.r1{margin-top:10px;color:var(--mute);font-size:13px}.r1 .concepts{margin-top:8px}.small{grid-template-columns:repeat(auto-fit,minmax(120px,160px))}
.models{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.m3d{margin:0}.m3d model-viewer{height:300px}
.open3d{display:inline-block;margin-left:auto;background:#e8b44c;color:#1a1208;font-weight:600;padding:3px 10px;border-radius:6px;text-decoration:none;font-size:12px}.open3d.big{margin:0 10px 0 0;font-size:13px;padding:5px 12px}
.picked{color:#7fd17f;font-size:12px;margin:6px 0 0}
details.p{font-size:12px;color:var(--mute);margin-top:6px}
.rules{margin:16px 0 0;background:#1f1810;border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--mute)}.rules b{color:var(--ink)}
@media (max-width:560px){.top,main{padding-left:14px;padding-right:14px}.grid{grid-template-columns:1fr}}
</style></head><body>
<div class="top"><h1>${esc(m.game)} · Asset library</h1>
<div class="sub"><a class="open3d big" href="viewer.html">Open the 3D viewer ↗</a> Concept image first → your pick → 3D in Lux3D → rig and animate → into the game. Nothing becomes 3D until it is approved here.</div>
<div class="stats"><span><b>${m.assets.length}</b> assets</span><span><b>${counts('concept')}</b> awaiting your pick</span><span><b>${counts('approved')}</b> approved</span><span>Updated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST</span></div></div>
<main><div class="rules"><b>Built for phones and a fast first load:</b> Hanuman about 15 to 25k triangles, props 2 to 8k, textures 1024 px max and compressed, Act 1 playable at about 15 to 20 MB. Bold, clear shapes over fine detail.</div>${groups.map(g => `<h2>${esc(g)}</h2><div class="grid">${m.assets.filter(a => a.group === g).map(card).join('')}</div>`).join('')}</main>
</body></html>`;
// Full-screen 3D viewer: every generated model, one at a time, loads straight away.
const allModels = m.assets.flatMap(a => list('assets/lux3d')
  .filter(d => d.startsWith(a.id + '-') && existsSync(`${root}assets/lux3d/${d}/model.glb`))
  .sort((x, y) => (y.includes('g1') - x.includes('g1')) || x.localeCompare(y))
  .map(d => ({ id: d, name: a.name, kind: d === a.test3d ? 'Text-to-3D test' : d.endsWith('-g1-multiview') ? 'G1 · 3 views' : d.endsWith('-g1') ? 'G1 · best' : 'Turbo',
    mb: (statSync(`${root}assets/lux3d/${d}/model.glb`).size / 1e6).toFixed(1) })));
const viewer = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.game)} · 3D viewer</title>
<script type="module" src="https://unpkg.com/@google/model-viewer@4/dist/model-viewer.min.js"></script>
<style>*{box-sizing:border-box}html,body{margin:0;height:100%;background:#0e0b08;color:#f3e9d8;font:14px/1.4 -apple-system,system-ui,sans-serif}
.wrap{display:grid;grid-template-columns:260px 1fr;height:100%}nav{overflow:auto;border-right:1px solid #3a2c1c;padding:14px}
h1{font:600 18px Georgia,serif;color:#e8b44c;margin:0 0 4px}.hint{color:#a8977f;font-size:12px;margin:0 0 12px}
button{display:block;width:100%;text-align:left;background:#18130e;color:#f3e9d8;border:1px solid #3a2c1c;border-radius:8px;padding:8px 10px;margin:0 0 6px;cursor:pointer}
button span{display:block;color:#a8977f;font-size:12px}button.on{border-color:#e8b44c;background:#2a1f12}
main{position:relative}model-viewer{width:100%;height:100%;background:radial-gradient(#3b3530,#141110)}
.cap{position:absolute;left:16px;top:12px;font:600 20px Georgia,serif;color:#e8b44c;text-shadow:0 1px 4px #000}.cap span{display:block;font:13px system-ui;color:#d8c9b0}
.load{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);background:#000a;padding:6px 12px;border-radius:99px;color:#e8b44c;font-size:13px}
a{color:#e8b44c}@media (max-width:700px){.wrap{grid-template-columns:1fr;grid-template-rows:42% 58%}nav{order:2;border:0;border-top:1px solid #3a2c1c}}</style></head><body>
<div class="wrap"><nav><h1>3D viewer</h1><p class="hint">Real Lux3D models. Drag to turn, scroll or pinch to zoom, right-drag to move. <a href="index.html">Back to library</a></p><div id="list"></div></nav>
<main><model-viewer id="mv" camera-controls auto-rotate shadow-intensity="1" exposure="1.15" environment-image="neutral" interaction-prompt="none"></model-viewer>
<div class="cap" id="cap"></div><div class="load" id="load">Loading…</div></main></div>
<script>const M=${JSON.stringify(allModels)};const mv=document.getElementById('mv'),list=document.getElementById('list');
function show(i){const x=M[i];mv.src='../lux3d/'+x.id+'/model.glb';document.getElementById('cap').innerHTML=x.name+'<span>'+x.kind+' · '+x.mb+' MB raw</span>';
document.getElementById('load').style.display='block';[...list.children].forEach((b,j)=>b.classList.toggle('on',i===j));history.replaceState(null,'','#'+x.id)}
mv.addEventListener('load',()=>document.getElementById('load').style.display='none');
mv.addEventListener('progress',e=>{document.getElementById('load').textContent='Loading '+Math.round(e.detail.totalProgress*100)+'%'});
M.forEach((x,i)=>{const b=document.createElement('button');b.innerHTML=x.name+'<span>'+x.kind+' · '+x.mb+' MB</span>';b.onclick=()=>show(i);list.appendChild(b)});
const start=Math.max(0,M.findIndex(x=>x.id===location.hash.slice(1)));show(start);</script></body></html>`;
mkdirSync(root + 'assets/library', { recursive: true });
writeFileSync(root + 'assets/library/viewer.html', viewer);
writeFileSync(root + 'assets/library/index.html', html);
console.log('wrote assets/library/index.html', m.assets.length, 'assets');
