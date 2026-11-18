// The collector's card of a finished run, drawn on a canvas (1080 x 1350, the 4:5 that a chat and a feed show whole) over the
// card's own plate (ui/brand/card-plate.jpg: the gold edge, the picture's frame, the gold seal, the fine lines and the address;
// without it the card is drawn plain, as it was before): the art,
// the name of Hanuman the run earned and what it means, the player's name beside a seal drawn from this run, the score, the
// place on today's board, the lamps, how many of the twelve names are collected, the card's number, and the game's address.
// Fetched only when a card is shown. Letters are spaced by hand: not every phone spaces letters on a canvas.
import { seal } from './scores.js';
export const SITE = 'hanumanmission.com';      // the address printed on the card (Sid, 19 Nov: the .com on the card; the link sent with it is the same address since the domain was joined)
const img = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
export async function drawCard(d) {
  const W = 1080, H = 1350, c = document.createElement('canvas'), x = c.getContext('2d'); c.width = W; c.height = H;
  const HEAD = 'Cinzel, "Trajan Pro", Georgia, serif', TEXT = '"Cormorant Garamond", Georgia, serif', GL = '#fbe7ae', G = '#e8b44c', GD = '#b07a24', INK = '#f3e9d8', QUIET = '#b9a98d';
  await Promise.all([document.fonts.load(`900 40px ${HEAD}`), document.fonts.load(`700 40px ${HEAD}`), document.fonts.load(`500 40px ${TEXT}`), document.fonts.load(`italic 500 40px ${TEXT}`)]).catch(() => {});
  const [plate, art, sl] = await Promise.all([img('ui/brand/card-plate.jpg').catch(() => null), img(`ui/brand/cards/${d.title}.jpg`).catch(() => img('ui/brand/card-art.jpg')).catch(() => null),      // each name has its own picture of him
    img('data:image/svg+xml;utf8,' + encodeURIComponent(seal(d.name + '-' + d.score + '-' + d.lamps, G).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" '))).catch(() => null)]);
  const rr = (X, Y, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); };
  // letters set apart by hand; align: 'left' | 'center' | 'right'
  const spaced = (t, X, Y, sp, align = 'left') => { const ws = [...t].map(ch => x.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1); let px = align === 'center' ? X - total / 2 : align === 'right' ? X - total : X; x.textAlign = 'left'; [...t].forEach((ch, i) => { x.fillText(ch, px, Y); px += ws[i] + sp; }); return total; };
  const fit = (t, font, size, max, sp = 0) => { let s = size; for (; s > 20; s -= 2) { x.font = font.replace('#', s); const w = x.measureText(t).width + sp * s * (t.length - 1); if (w <= max) break; } return s; };
  const bg = x.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.9); bg.addColorStop(0, '#2c231a'); bg.addColorStop(0.7, '#120e0b'); bg.addColorStop(1, '#120e0b'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  if (plate) x.drawImage(plate, 0, 0, W, H); else { x.lineWidth = 3; x.strokeStyle = GD; rr(18, 18, W - 36, H - 36, 30); x.stroke(); x.lineWidth = 2; x.strokeStyle = 'rgba(232,180,76,.55)'; rr(27, 27, W - 54, H - 54, 22); x.stroke(); }
  // the head: the game's name, the card's number
  x.fillStyle = GL; x.font = `700 30px ${HEAD}`; spaced('HANUMAN MISSION', 68, 92, 10); x.fillStyle = QUIET; x.font = `700 15px ${HEAD}`; spaced('A RAMAYANA ACTION GAME', 68, 118, 6.3);
  x.font = `700 20px ${HEAD}`; spaced('CARD', 1012, 82, 4, 'right'); x.fillStyle = GL; x.font = `700 40px ${HEAD}`; spaced(d.no ? 'No. ' + String(d.no).padStart(4, '0') : 'No. 0001', 1012, 126, 3, 'right');
  // the art, and over its foot the name earned
  const [AX, AY, AW, AH] = plate ? [62, 150, 956, 718] : [60, 150, 960, 720]; x.save(); rr(AX, AY, AW, AH, plate ? 9 : 14); x.clip();      // on the plate the picture sits just inside the frame drawn there
  if (art) x.drawImage(art, AX, AY, AW, AH); else { x.fillStyle = '#1b2248'; x.fillRect(AX, AY, AW, AH); }
  const sh = x.createLinearGradient(0, AY, 0, AY + AH); sh.addColorStop(0.52, 'rgba(12,8,5,0)'); sh.addColorStop(0.92, 'rgba(12,8,5,.92)'); x.fillStyle = sh; x.fillRect(AX, AY, AW, AH); x.restore();
  if (!plate) { x.lineWidth = 2; x.strokeStyle = GD; rr(AX, AY, AW, AH, 14); x.stroke(); }
  const who = (d.name || 'Vanara').toUpperCase() + ' IS NOW', hs = fit(who, `700 #px ${HEAD}`, 30, 860, 0.3); x.save(); x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 12; x.fillStyle = INK; x.font = `700 ${hs}px ${HEAD}`; spaced(who, W / 2, 678, hs * 0.3, 'center'); x.restore();
  const title = d.title.toUpperCase(), ts = fit(title, `900 #px ${HEAD}`, 104, 880, 0.08); x.font = `900 ${ts}px ${HEAD}`;
  const gold = x.createLinearGradient(0, 784 - ts * 0.74, 0, 786); gold.addColorStop(0, '#fff6d6'); gold.addColorStop(0.3, '#f6d274'); gold.addColorStop(0.62, '#d9a23c'); gold.addColorStop(0.8, '#b87f28'); gold.addColorStop(1, '#f0c868');      // beaten gold: light at the head of the letters, deep in the body, a last light at the foot
  x.save(); x.shadowColor = 'rgba(255,160,40,.45)'; x.shadowBlur = 34; x.fillStyle = gold; spaced(title, W / 2, 784, ts * 0.08, 'center'); x.restore();      // the fire's glow around it
  x.save(); x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14; x.shadowOffsetY = 6; x.fillStyle = gold; spaced(title, W / 2, 784, ts * 0.08, 'center'); x.restore();
  x.fillStyle = INK; x.font = `italic 500 ${fit(d.meaning, `italic 500 #px ${TEXT}`, 40, 880)}px ${TEXT}`; x.textAlign = 'center'; x.save(); x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 10; x.fillText(d.meaning, W / 2, 834); x.restore();
  // who carries it, beside the seal of this run
  if (sl && !plate) x.drawImage(sl, 78, 896, 150, 150);      // the plate bears a seal of gold
  x.fillStyle = QUIET; x.font = `700 20px ${HEAD}`; spaced('I BURNED LANKA', 256, 946, 6);
  const dare = 'CAN YOU BEAT ME?', ws = fit(dare, `900 #px ${HEAD}`, 62, 740, 0.05); x.fillStyle = INK; x.font = `900 ${ws}px ${HEAD}`; spaced(dare, 256, 1016, ws * 0.05);
  // the numbers of the run (on the plate each stands after its dividing line)
  if (!plate) { x.strokeStyle = 'rgba(232,180,76,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(84, 1072); x.lineTo(996, 1072); x.stroke(); }
  [['SCORE', Math.round(d.score).toLocaleString('en-US')], ['RANK TODAY', d.rank ? '#' + d.rank : '–'], ['LAMPS', String(d.lamps)], ['NAMES', d.names + ' / 12']].forEach(([k, v], i) => {
    const X = (plate ? [84, 316, 618, 846] : [84, 330, 600, 820])[i]; x.fillStyle = QUIET; x.font = `700 17px ${HEAD}`; spaced(k, X, 1114, 3.7); x.fillStyle = GL; x.font = `700 46px ${HEAD}`; x.textAlign = 'left'; x.fillText(v, X, 1170); });
  x.fillStyle = QUIET; x.font = `700 24px ${HEAD}`; spaced(d.date || '', 84, plate ? 1295 : 1284, 3.8); if (!plate) { x.fillStyle = GL; spaced(SITE.toUpperCase(), 996, 1284, 2.4, 'right'); }      // the plate carries the address
  return c;
}
