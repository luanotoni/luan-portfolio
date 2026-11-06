// The battle station over the hero: a grey moon-sized sphere with a dish. Now and then it charges the dish
// and fires at the Earth (or the Moon). Lasers leave craters on it; a hit on the small port under the
// trench, or enough hits anywhere, breaks it into pixels. A new one shows up two minutes later.
(() => {
  const K = window.pixelKit;
  if (!K || K.reduce || !K.worldHit) return;
  const { P, Px, sphere, ag, hits, burst, droid, clamp, pick, sfx, dither, ramp, lambert } = K;
  const D = () => K.dpr;
  const say = (t, ms = 3000) => droid?.say(t, ms), quiet = (t, ms = 3000) => (K.quiet || say)(t, ms);
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const DISH = [-0.36, -0.4, 0.27], PORT = [0.3, 0.12];
  function stationPx(R, o) {
    const n = Math.ceil(R * 2) + 2, p = new Px(n, n), c = n / 2;
    sphere(p, c, c, R, ['x', 'd', 'm', 'l'], {
      detail: (x, y, nx, ny, nz, I) => {
        for (const h of o.holes) { const d = Math.hypot(nx - h[0], ny - h[1]); if (d < h[2]) return d < h[2] * 0.55 ? (o.hot && dither(x, y, 0.35 + 0.3 * Math.sin(o.t * 9 + h[0] * 20)) ? 'o' : 'K') : 'x'; }
        const dx = nx - DISH[0], dy = ny - DISH[1], dd = Math.hypot(dx, dy);
        if (dd < DISH[2]) {
          if (dd < 0.05) return o.charge > 0 ? 'g' : 'd';
          if (dd > DISH[2] * 0.86) return 'l';
          if (o.charge > 0 && dither(x, y, o.charge * 0.6)) return 'g';
          return ramp(lambert(-dx / DISH[2], -dy / DISH[2], 0.6) * 0.85, x, y, ['x', 'd', 'm', 'l']);
        }
        if (Math.abs(ny - 0.04) < 0.035) return Math.abs(ny - 0.04) < 0.013 ? 'K' : 'x';
        const lat = Math.asin(clamp(-ny, -1, 1)), lon = Math.atan2(nx, nz), hs = ((Math.floor(lon * 7) * 73856093) ^ (Math.floor(lat * 7) * 19349663)) >>> 0;
        if (I < 0.4 && hs % 7 === 0 && (x + y) % 3 === 0) return 'y';
        if (hs % 5 === 0) return ramp(I * 0.86, x, y, ['x', 'd', 'm', 'l']);
        return null;
      },
    });
    return p;
  }

  const st = { hp: 30, holes: [], gone: false, back: 0, charge: 0, fire: 0, next: performance.now() + 30000, target: null, cv: null, dirty: true, t: 0, x: -999, y: -999, R: 34, S: 2, on: false, shown: false };
  let wins = 0; try { wins = +localStorage.getItem('estacao') || 0; } catch {}
  const geom = () => {
    const r = hero.getBoundingClientRect(), small = innerWidth < 700;
    st.S = small ? 1 : 2; st.R = 34;
    st.x = r.left + r.width * (small ? 0.72 : 0.66) + Math.sin(st.t * 0.25) * 6;
    st.y = r.top + r.height * (small ? 0.12 : 0.22) + Math.sin(st.t * 0.33) * 3;
    st.on = !st.gone && r.bottom > 0 && st.y - st.R * st.S < innerHeight && st.y + st.R * st.S > 0;
  };
  const rad = () => st.R * st.S;
  const portXY = () => [st.x + PORT[0] * rad(), st.y + PORT[1] * rad()];
  const dishXY = () => [st.x + DISH[0] * rad(), st.y + DISH[1] * rad()];
  const focus = () => { const [dx, dy] = dishXY(), [nx, ny] = [DISH[0], DISH[1]], l = Math.hypot(nx, ny); return [dx + nx / l * rad() * 0.7, dy + ny / l * rad() * 0.7 - rad() * 0.1]; };

  function breakApart(port) {
    st.gone = true; st.back = performance.now() + 120000; st.charge = 0; st.fire = 0;
    const cv = st.cv, w = cv.width * st.S, rect = { left: st.x - w / 2, top: st.y - w / 2, width: w, height: w };
    K.pixelize(cv, rect, 2, st.x, st.y, 520, { g: 0, floor: false, drag: 0.988, life: 3.2 });
    burst(st.x, st.y, 60, 'o', 700, 1); burst(st.x, st.y, 40, 'y', 500, 0.8); burst(st.x, st.y, 30, 'W', 600, 0.6);
    K.ring(st.x, st.y, rad() * 5, 'W', true); K.ring(st.x, st.y, rad() * 2.2, 'c'); K.flash = 0.8; K.quake(700);
    sfx().tone(50, 1.4, 'sawtooth', 0.07, 20); sfx().tone(900, 0.6, 'sine', 0.03, 120);
    wins++; try { localStorage.setItem('estacao', wins); } catch {}
    droid?.emote('♥');
    say(port ? 'Bem no duto de exaustão! Um tiro em um milhão!' : wins > 1 ? `Estação de batalha número ${wins} virou pixel. O Império não aprende.` : 'A estação de batalha virou poeira! Você salvou a Terra.', 4000);
  }
  hits.push({
    rect: () => (st.on ? { left: st.x - rad() * 0.85, top: st.y - rad() * 0.85, right: st.x + rad() * 0.85, bottom: st.y + rad() * 0.85 } : null),
    onHit: (b) => {
      const [px, py] = portXY();
      if (Math.hypot(b.x - px, b.y - py) < 7 + st.S * 2) { breakApart(true); return; }
      const nx = (b.x - st.x) / rad(), ny = (b.y - st.y) / rad();
      if (nx * nx + ny * ny > 1) return;
      st.holes.push([nx, ny, 0.07 + Math.random() * 0.06]); if (st.holes.length > 40) st.holes.shift();
      st.hp -= b.power || 1; st.dirty = true;
      burst(b.x, b.y, 8, 'o', 220, 0.5); burst(b.x, b.y, 6, 'm', 180, 0.7); sfx().tone(180, 0.12, 'square', 0.03, 70);
      if (st.hp === 24 && K.once('st-hint', 60000)) say('Ela aguenta muito tiro. Mira no duto pequeno embaixo da trincheira!', 3200);
      if (st.hp <= 0) breakApart(false);
    },
  });

  // the superlaser: charge the dish, then a beam at the target, which breaks apart
  function pickTarget() {
    for (const sel of ['.p-hero', '.name .moon']) {
      const img = document.querySelector(sel), b = img && K.bodyOf(img);
      if (!b || b.gone) continue;
      const r = img.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) return b;
    }
    return null;
  }
  document.addEventListener('imperio', (e) => { if (e.detail === 'estacao') { st.next = 0; if (st.gone) st.back = performance.now(); } });

  function step(dt, now) {
    st.t += dt; geom();
    if (st.gone) { if (now > st.back) { st.gone = false; st.hp = 30; st.holes = []; st.dirty = true; st.next = now + 40000; if (K.once('st-back', 1000)) quiet('O Império montou outra estação de batalha. Claro que montou.', 3200); } return; }
    if (st.on && !st.shown) { st.shown = true; }
    if (!st.charge && !st.fire && now > st.next && st.on && !document.querySelector('dialog[open]')) {
      st.target = pickTarget();
      if (st.target) { st.charge = 0.001; droid?.emote('!'); quiet('A estação tá carregando o superlaser! Atira no duto embaixo da trincheira!', 4200); sfx().tone(80, 5, 'sawtooth', 0.015, 400); }
      else st.next = now + 15000;
    }
    if (st.charge) {
      st.charge += dt / 6; st.dirty = true;
      if (st.charge >= 1) { st.charge = 0; st.fire = 1.3; sfx().tone(300, 1.3, 'sawtooth', 0.05, 60); }
    } else if (st.fire) {
      st.fire = Math.max(0, st.fire - dt);
      const r = st.target.img.getBoundingClientRect();
      if (Math.random() < 0.6) burst(r.left + r.width / 2 + (Math.random() - 0.5) * 20, r.top + r.height / 2 + (Math.random() - 0.5) * 20, 3, 'g', 300, 0.4);
      if (st.fire === 0) { K.breakBody(st.target, 'station'); st.target = null; st.next = now + 55000 + Math.random() * 35000; st.dirty = true; }
    }
    if (st.hp < 12 && Math.random() < 0.4) K.fx.push({ x: st.x + (Math.random() - 0.5) * rad(), y: st.y + (Math.random() - 0.5) * rad(), vx: 0, vy: -30, g: -20, life: 0.6, col: Math.random() < 0.5 ? 'o' : 'd', s: 2 });
  }
  function draw(now) {
    if (!st.on) return;
    if (st.dirty || (st.hp < 15 && now - (st.drawn || 0) > 100)) { st.drawn = now; st.cv = stationPx(st.R, { holes: st.holes, charge: st.charge || (st.fire ? 1 : 0), hot: st.hp < 15, t: st.t }).canvas(st.cv); st.dirty = false; }
    const w = st.cv.width;
    K.blit(st.cv, st.x - (w * st.S) / 2, st.y - (w * st.S) / 2, st.S);
    const d = D(), [px, py] = portXY();
    ag.fillStyle = ((now / 400) | 0) & 1 ? P.o : P.O; ag.fillRect((px - 1) * d, (py - 1) * d, 3 * d, 2 * d);
    if (st.charge) {
      // brackets on the port so the visitor knows where to aim
      const k = 9 + Math.sin(now / 90) * 2; ag.fillStyle = P.o;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ag.fillRect((px + sx * k - (sx > 0 ? 4 : 0)) * d, (py + sy * k) * d, 5 * d, 2 * d); ag.fillRect((px + sx * k) * d, (py + sy * k - (sy > 0 ? 4 : 0)) * d, 2 * d, 5 * d); }
      const [fx, fy] = focus(), [cx, cy] = dishXY(), R2 = DISH[2] * rad() * 0.9;
      ag.strokeStyle = P.g; ag.lineWidth = 2 * d; ag.globalAlpha = Math.min(1, st.charge * 1.5);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + now / 900; ag.beginPath(); ag.moveTo((cx + Math.cos(a) * R2) * d, (cy + Math.sin(a) * R2) * d); ag.lineTo(fx * d, fy * d); ag.stroke(); }
      ag.globalAlpha = 1; ag.fillStyle = P.W; const s = 2 + st.charge * 6; ag.fillRect((fx - s / 2) * d, (fy - s / 2) * d, s * d, s * d);
    }
    if (st.fire && st.target) {
      const [fx, fy] = focus(), r = st.target.img.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
      for (const [wd, col, al] of [[14, 'g', 0.35], [7, 'g', 0.9], [3, 'W', 1]]) { ag.globalAlpha = al; ag.strokeStyle = P[col]; ag.lineWidth = (wd + Math.random() * 2) * d; ag.beginPath(); ag.moveTo(fx * d, fy * d); ag.lineTo(tx * d, ty * d); ag.stroke(); }
      ag.globalAlpha = 1;
    }
  }
  K.layers.unshift({ step, back: draw });
  K.station = st;
})();
