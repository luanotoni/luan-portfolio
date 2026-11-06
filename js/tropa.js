// The Empire lands on the page: a squad of white-armoured troopers rappels onto the blocks and shoots at the
// ship, and now and then the dark lord in the black helmet comes with a red saber. Their shots knock the
// ship off the cursor and wear its hull down; he pulls it with the Force and bats bolts back.
// A laser hit makes a trooper flicker and disintegrate into pixels; the lord takes several, then fades out.
(() => {
  const K = window.pixelKit;
  if (!K || K.reduce || !K.worldHit) return;
  const { P, Px, line, make, blit, ag, hits, burst, droid, ship, clamp, pick, sfx } = K;
  const D = () => K.dpr;
  const say = (t, ms = 2800) => droid?.say(t, ms), quiet = (t, ms = 3000) => (K.quiet || say)(t, ms);

  // ---------- sprites, drawn pixel by pixel, facing right ----------
  const grid = (rows, w) => { const p = new Px(w, rows.length); rows.forEach((r, y) => [...r.padEnd(w, '.')].forEach((c, x) => c !== '.' && p.set(x, y, c))); return p; };
  const TROOPER_HEAD = [
    '.....kkkkkk.....',
    '...kkWWWWWWkk...',
    '..kWWWWWWWWWWk..',
    '.kWWWWWWWWWWWlk.',
    '.kWllllllllllWk.',
    'kWWKKKWWWWKKKWlk',
    'kWKKKKWWWWKKKKlk',
    'kmWKKKWllWKKKWmk',
    'kmWWWWWllWWWWWmk',
    '.kWWKdKddKdKWWk.',
    '.kWKWWWWWWWWKWk.',
    '..kkWWWWWWWWkk..',
  ];
  const TROOPER_BODY = [
    '...kkkllllkkk...',
    '..kWWWKKKKWWWk..',
    '.kWWlWWWWWWlWWk.',
    '.kWlKWWllWWKlWk.',
    '.kWWKWWWWWWKWWk.',
    '..kKKWWWWWWKKk..',
    '..kmmdmmmmdmmk..',
    '...kWWWKKWWWk...',
  ];
  const LEGS = [[
    '...kWWWkkWWWk...',
    '...kKKKkkKKKk...',
    '...kWWWkkWWWk...',
    '..kWWWWkkWWWWk..',
    '..kkkkkk.kkkkkk.',
  ], [
    '...kWWWkkWWWk...',
    '..kKKKk..kKKKk..',
    '..kWWWk..kWWWk..',
    '.kWWWWk..kWWWWk.',
    '.kkkkkk..kkkkkk.',
  ]];
  const LORD = [
    '.......dddddd.......',
    '.....ddkkkkkkdd.....',
    '....dkmllmkkkkkd....',
    '...dkmlkkkkkkkkkd...',
    '...dkmkkkkkkkkkkd...',
    '..dkkkkkkkkkkkkkkd..',
    '..dkkKKKKKKKKKKkkd..',
    '..dkKxxxKKKKxxxKkd..',
    '.dkkKxxxKmmKxxxKkkd.',
    '.dkkKKKKKmmKKKKKkkd.',
    'dkkkkKKKmllmKKKkkkkd',
    'dkkkkKKmlKKlmKKkkkkd',
    'dkkkkkKKmllmKKkkkkkd',
    '.ddkkkkKKmmKKkkkkdd.',
    '...dddddddddddddd...',
    '..dkmmkkkkkkkkmmkd..',
    '.dkkkkmmmmmmkkkkkkd.',
    '.dkkkkmrgbymkkkkkkd.',
    '.dkkkkmmmmmmkkkkkkd.',
    '.dkkkkkkkkkkkkkkkkd.',
    '.dkkkmlmlKKmlmkkkkd.',
    '.dkkkkkkkkkkkkkkkkd.',
    'dkxkkkkkkkkkkkkkkxkd',
    'dkxkkkkkkkkkkkkkkxkd',
    'dkxkkkkkkkkkkkkkkxkd',
    'dxkkkkkkkdkkkkkkkkxd',
    'dxkkkkkkkdkkkkkkkkxd',
    'dxkkkkkkd.dkkkkkkkxd',
    '.dxkkkkkd.dkkkkkkxd.',
    '..ddkkKKd.dKKkkkdd..',
    '....ddddd.ddddd.....',
  ];
  const cache = new Map();
  function trooperCanvas(step, aim, sarge, flash) {
    const key = `t${step}${aim}${sarge}${flash}`; if (cache.has(key)) return cache.get(key);
    const p = new Px(30, 26), body = grid([...TROOPER_HEAD, ...TROOPER_BODY, ...LEGS[step]], 16);
    for (let y = 0; y < body.h; y++) for (let x = 0; x < 16; x++) { const c = body.a[y * 16 + x]; if (c) p.set(x + 4, y + 1, c); }
    if (sarge) { p.set(6, 14, 'o'); p.set(7, 14, 'o'); p.set(6, 15, 'o'); }
    // arm and blaster, aimed: -2 (up) .. 1 (a bit down)
    const a = aim * 0.42, sx = 16, sy = 15, hx = sx + Math.cos(a) * 4, hy = sy + Math.sin(a) * 4;
    line(p, sx, sy, hx, hy, 'W', 2);
    line(p, hx, hy, hx + Math.cos(a) * 8, hy + Math.sin(a) * 8, 'd', 2);
    line(p, hx, hy, hx + Math.cos(a) * 7, hy + Math.sin(a) * 7, 'm');
    p.set(Math.round(hx + Math.cos(a) * 9), Math.round(hy + Math.sin(a) * 9), 'l');
    p.outline('k');
    if (flash) p.a = p.a.map((c) => (c ? 'W' : c));
    const c = p.canvas(); cache.set(key, c); return c;
  }
  function lordCanvas(grip, flash) {
    const key = `l${grip}${flash}`; if (cache.has(key)) return cache.get(key);
    const p = new Px(26, 32), body = grid(LORD, 20);
    for (let y = 0; y < body.h; y++) for (let x = 0; x < 20; x++) { const c = body.a[y * 20 + x]; if (c) p.set(x + 2, y + 1, c); }
    if (grip) { line(p, 18, 17, 24, 11, 'k', 2); p.set(25, 10, 'x'); p.set(24, 10, 'x'); }
    else { line(p, 18, 18, 21, 21, 'k', 2); p.set(21, 22, 'd'); p.set(22, 22, 'm'); }
    if (flash) p.a = p.a.map((c) => (c ? 'W' : c));
    const c = p.canvas(); cache.set(key, c); return c;
  }
  const flip = (c) => { const [f, g] = make(c.width, c.height); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return f; };
  const flipCache = new WeakMap();
  const faced = (c, face) => { if (face > 0) return c; if (!flipCache.has(c)) flipCache.set(c, flip(c)); return flipCache.get(c); };

  // ---------- where they stand: the tops of the page's own blocks ----------
  const PLAT = '.sec-head h2, .repo, .feature-media, .work-list li, .license, .about-text h2, .statement, .tools-text h2, .contact h2, .mail, .contact-foot, .wordmark';
  const plats = () => [...document.querySelectorAll(PLAT)].map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.width > 90 && r.top > 100 && r.top < innerHeight - 40);

  const S = innerWidth >= 900 ? 3 : 2, units = [], red = [];
  let nextSquad = performance.now() + 26000, nextLord = performance.now() + 65000, beat = 0, gone = 0;
  try { gone = +localStorage.getItem('tropa') || 0; } catch {}
  const aimPoint = () => (ship.alive ? ship.pos : null);

  function spawn(kind, el, r, offX) {
    const u = { kind, el, off: offX, y: -60, state: 'drop', face: 1, hp: kind === 'lord' ? 10 : 1, sarge: false, fireT: 1 + Math.random() * 1.5, burst: 0, walk: (Math.random() < 0.5 ? -1 : 1), step: 0, flash: 0, gripT: 7, gripping: 0, life: kind === 'lord' ? 70 : 55 };
    u.hit = { rect: () => { if (u.state === 'out') return null; const w = (u.kind === 'lord' ? 9 : 8) * S, h = (u.kind === 'lord' ? 31 : 25) * S; return { left: u.x - w, top: u.y - h, right: u.x + w, bottom: u.y }; }, onHit: (b) => hurt(u, b) };
    hits.push(u.hit); units.push(u); return u;
  }
  function squad() {
    const ps = plats(); if (!ps.length) return;
    const n = 3 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) { const [el, r] = ps[(Math.random() * ps.length) | 0]; const u = spawn('trooper', el, r, 20 + Math.random() * Math.max(10, r.width - 40)); u.sarge = i === 0; u.y = -60 - i * 50; }
    sfx().tone(400, 0.5, 'square', 0.015, 200);
    droid?.emote('!'); quiet(pick(['Stormtroopers! Desintegra eles com a nave!', 'Desceu um esquadrão do Império! Cuidado com a nave!', 'Stormtroopers na página! Eles miram mal, mas miram muito.']), 3200);
  }
  function lord() {
    if (units.some((u) => u.kind === 'lord')) return;
    const ps = plats(); if (!ps.length) return;
    const sp = ship.pos, [el, r] = ps.sort((a, b) => Math.abs(a[1].top - sp.y) - Math.abs(b[1].top - sp.y))[0];
    spawn('lord', el, r, clamp(sp.x - r.left, 20, r.width - 20));
    sfx().tone(70, 1.2, 'sawtooth', 0.03, 50);
    droid?.emote('!'); quiet('O Vader chegou. Ele rebate os tiros com o sabre: atira quando ele estiver usando a Força.', 4200);
  }
  document.addEventListener('imperio', (e) => { if (e.detail === 'tropa') squad(); if (e.detail === 'lorde') lord(); });

  function disintegrate(u, b) {
    u.state = 'out';
    const c = u.kind === 'lord' ? lordCanvas(0, 0) : trooperCanvas(0, 0, u.sarge, 0), cv = faced(c, u.face), w = cv.width * S, h = cv.height * S;
    const rect = { left: u.x - w / 2, top: u.y - h, width: w, height: h };
    K.pixelize(cv, rect, 1, b ? b.x : u.x, b ? b.y : u.y - h / 2, u.kind === 'lord' ? 120 : 180, { g: -40, floor: false, drag: 0.97, life: 1.4, va: 0, up: 30 });
    burst(u.x, u.y - h / 2, 10, 'h', 160, 0.6);
    sfx().tone(1400, 0.35, 'sine', 0.025, 300);
    const k = hits.indexOf(u.hit); if (k >= 0) hits.splice(k, 1);
  }
  function hurt(u, b) {
    if (u.state === 'out') return;
    if (u.kind === 'lord' && !u.gripping && u.state !== 'drop' && Math.random() < 0.55) {
      // the saber bats the bolt back at the ship
      const sp = ship.pos, sx = u.x + u.face * 14, sy = u.y - 40, d = Math.hypot(sp.x - sx, sp.y - sy) || 1;
      red.push({ x: sx, y: sy, vx: (sp.x - sx) / d * 900, vy: (sp.y - sy) / d * 900, life: 2, dmg: 10 });
      burst(sx, sy, 8, 'r', 200, 0.3); sfx().tone(900, 0.12, 'sawtooth', 0.03, 1800); u.parry = 0.2;
      if (K.once('parry', 20000)) say('Ele rebateu! Espera ele levantar a mão pra usar a Força e atira.', 3000);
      return;
    }
    u.hp -= b.power || 1; u.flash = 0.15;
    if (u.hp > 0) { sfx().tone(200, 0.1, 'square', 0.03, 120); u.off -= u.face * 8; return; }
    disintegrate(u, b);
    if (u.kind === 'lord') { say('O Vader se desintegrou! Ele volta, ele sempre volta.', 3600); droid?.emote('♥'); }
    else { gone++; try { localStorage.setItem('tropa', gone); } catch {} if (K.once('tk', 6000)) say(gone === 1 ? 'Um stormtrooper a menos!' : `${gone} stormtroopers desintegrados até agora.`, 2200); }
  }

  function fireAt(u, sx, sy, spread, speed, dmg) {
    const t = aimPoint(); if (!t) return;
    const a = Math.atan2(t.y - sy, t.x - sx) + (Math.random() - 0.5) * spread;
    red.push({ x: sx, y: sy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 2.2, dmg });
    sfx().tone(700, 0.08, 'square', 0.015, 300);
  }

  function step(dt, now) {
    if (now > nextSquad && !document.querySelector('dialog[open]')) { squad(); nextSquad = now + 75000 + Math.random() * 30000; }
    if (now > nextLord && !document.querySelector('dialog[open]')) { lord(); nextLord = now + 150000 + Math.random() * 60000; }
    for (const u of units) {
      if (u.state === 'out') continue;
      const r = u.el.getBoundingClientRect();
      u.life -= dt; u.flash = Math.max(0, u.flash - dt); u.parry = Math.max(0, (u.parry || 0) - dt);
      u.x = r.left + clamp(u.off, 12, r.width - 12);
      if (u.state === 'drop') { u.y += 420 * dt; if (u.y >= r.top) { u.y = r.top; u.state = 'stand'; burst(u.x, u.y, 6, 'm', 120, 0.3); if (u.kind === 'lord') { K.quake(300); K.ring(u.x, u.y, 60, 'r', true); } } continue; }
      u.y = r.top;
      if (!document.contains(u.el) || r.bottom < -200 || r.top > innerHeight + 200) { u.offscreen = (u.offscreen || 0) + dt; if (u.offscreen > 6) u.state = 'out'; continue; }
      u.offscreen = 0;
      const t = aimPoint();
      if (t) u.face = t.x >= u.x ? 1 : -1;
      if (u.life <= 0) { u.state = 'leave'; }
      if (u.state === 'leave') { u.state = 'out'; burst(u.x, u.y - 20, 6, 'c', 100, 0.5); const k = hits.indexOf(u.hit); if (k >= 0) hits.splice(k, 1); continue; }
      if (u.kind === 'trooper') {
        if (Math.random() < dt * 0.4) u.walk = -u.walk;
        u.off += u.walk * 22 * dt; if (u.off < 12 || u.off > r.width - 12) u.walk = -u.walk;
        u.step += dt * 6;
        if ((u.fireT -= dt) <= 0) { u.burst = 2 + (Math.random() < 0.5 ? 1 : 0); u.fireT = 1.8 + Math.random() * 1.6; }
        if (u.burst > 0 && ((u.bt = (u.bt || 0) - dt) <= 0)) { u.bt = 0.13; u.burst--; const [mx, my] = muzzle(u); fireAt(u, mx, my, 0.3, 620, 7); }
      } else {
        // the lord walks toward the ship and, when it is near, grips it with the Force
        if (t) { const dx = t.x - u.x; if (Math.abs(dx) > 90) u.off += Math.sign(dx) * 30 * dt; }
        u.step += dt * 3;
        if (u.gripping > 0) { u.gripping -= dt; }
        else if ((u.gripT -= dt) <= 0 && t && Math.hypot(t.x - u.x, t.y - u.y) < 520) {
          u.gripping = 1.8; u.gripT = 7 + Math.random() * 3;
          ship.grip(u.x + u.face * 70, u.y - 150, 1800, 9);
          sfx().tone(60, 1.6, 'triangle', 0.04, 45);
          if (K.once('grip', 30000)) say('Ele tá segurando a nave com a Força! Agora ele tá aberto: atira!', 3000);
        }
        if (!u.gripping && Math.random() < dt * 0.25 && t) fireAt(u, u.x + u.face * 30, u.y - 44, 0.15, 700, 12);
        if ((beat -= dt) <= 0) { beat = 3.2; sfx().tone(95, 1.1, 'triangle', 0.012, 80); }
      }
    }
    for (let i = units.length - 1; i >= 0; i--) if (units[i].state === 'out') { const k = hits.indexOf(units[i].hit); if (k >= 0) hits.splice(k, 1); units.splice(i, 1); }
    // their bolts: they knock the ship around and break the page where they land
    for (const b of red) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (ship.alive) { const sp = ship.pos; if (Math.hypot(sp.x - b.x, sp.y - b.y) < 20) { ship.damage(b.dmg, b.vx * 0.9, b.vy * 0.9); b.life = 0; continue; } }
      if (b.x < -20 || b.y < -20 || b.x > innerWidth + 20 || b.y > innerHeight + 20) b.life = 0;
    }
    for (let i = red.length - 1; i >= 0; i--) if (red[i].life <= 0) red.splice(i, 1);
  }
  const muzzle = (u) => {
    const t = aimPoint(), shx = u.x + u.face * 4 * S, shy = u.y - 11 * S, ang = t ? Math.atan2(t.y - shy, Math.abs(t.x - shx)) : 0, aim = clamp(Math.round(ang / 0.42), -2, 1), a = aim * 0.42;
    u.aim = aim; return [shx + u.face * Math.cos(a) * 13 * S, shy + Math.sin(a) * 13 * S];
  };

  function draw(now) {
    const d = D();
    for (const u of units) {
      if (u.state === 'out' || u.y < -80 || u.y > innerHeight + 80) continue;
      if (u.state === 'drop') { ag.fillStyle = P.d; ag.fillRect((u.x - 1) * d, 0, 2 * d, Math.max(0, u.y - (u.kind === 'lord' ? 62 : 50)) * d); }
      if (u.kind === 'trooper') {
        const c = faced(trooperCanvas(u.state === 'stand' ? (u.step | 0) & 1 : 0, u.aim ?? 0, u.sarge, u.flash > 0 ? 1 : 0), u.face);
        blit(c, u.x - (u.face > 0 ? 12 : 18) * S, u.y - 26 * S, S);
      } else {
        const c = faced(lordCanvas(u.gripping > 0 ? 1 : 0, u.flash > 0 ? 1 : 0), u.face);
        blit(c, u.x - 13 * S, u.y - 32 * S, S);
        // the red saber
        if (!u.gripping) {
          const hx = u.x + u.face * 8 * S, hy = u.y - 10 * S, a = u.parry > 0 ? -Math.PI / 2 + u.face * 0.2 : -Math.PI / 2 + u.face * (0.55 + Math.sin(now / 700) * 0.1), L = 24 * S;
          const ex = hx + Math.cos(a) * L, ey = hy + Math.sin(a) * L;
          for (const [wd, col, al] of [[7, 'r', 0.35], [4, 'r', 0.9], [2, 'W', 1]]) { ag.globalAlpha = al; ag.strokeStyle = P[col]; ag.lineWidth = wd * d; ag.lineCap = 'round'; ag.beginPath(); ag.moveTo(hx * d, hy * d); ag.lineTo(ex * d, ey * d); ag.stroke(); }
          ag.globalAlpha = 1; ag.lineCap = 'butt';
        } else {
          ag.strokeStyle = P.h; ag.globalAlpha = 0.3; ag.lineWidth = 2 * d; const sp = ship.pos;
          for (let i = 0; i < 3; i++) { ag.beginPath(); ag.moveTo((u.x + u.face * 24) * d, (u.y - 44) * d); ag.quadraticCurveTo(((u.x + sp.x) / 2 + (Math.random() - 0.5) * 40) * d, ((u.y + sp.y) / 2 - 30) * d, sp.x * d, sp.y * d); ag.stroke(); }
          ag.globalAlpha = 1;
        }
      }
    }
    for (const b of red) { const l = Math.hypot(b.vx, b.vy), ux = b.vx / l, uy = b.vy / l; for (let k = 0; k < 7; k++) { ag.fillStyle = k < 2 ? P.W : P.r; ag.fillRect(Math.round(b.x - ux * k * 3) * d, Math.round(b.y - uy * k * 3) * d, 3 * d, 3 * d); } }
  }
  K.layers.push({ step, draw });
  K.tropa = { units, trooperCanvas, lordCanvas };
})();
