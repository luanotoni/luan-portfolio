// Defesa da VPC: Space Invaders with Galaga dives. Invaders are malicious requests, the shields are the
// security layers in front of the Conduit VPC, and each life is an availability zone.
(() => {
  const W = 320, H = 240;
  const C = {
    bg: '#050f16', ink: '#f3f5f8', muted: '#7d8ca6', orange: '#ff7a1f', peach: '#ffb27a',
    blue: '#6f97ff', shield: '#3a6df0', red: '#ff4b2b',
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SPR = {
    bot: [
      ['00011000', '00111100', '01111110', '11011011', '11111111', '00100100', '01011010', '10100101'],
      ['00011000', '00111100', '01111110', '11011011', '11111111', '01011010', '10000001', '01000010'],
    ],
    sqli: [
      ['00100000100', '00010001000', '00111111100', '01101110110', '11111111111', '10111111101', '10100000101', '00011011000'],
      ['00100000100', '10010001001', '10111111101', '11101110111', '11111111111', '01111111110', '00100000100', '01000000010'],
    ],
    ddos: [
      ['000011110000', '011111111110', '111111111111', '111001100111', '111111111111', '000110011000', '001101101100', '110000000011'],
      ['000011110000', '011111111110', '111111111111', '111001100111', '111111111111', '001110011100', '011001100110', '001100001100'],
    ],
    ufo: [['0000011111100000', '0001111111111000', '0011111111111100', '0110110110110110', '1111111111111111', '0011100110011100', '0001000000001000']],
    ship: [['00000200000', '00000100000', '00001110000', '00001110000', '10001110001', '10011111001', '11111111111', '11111111111', '11011111011', '10001010001']],
  };
  const TYPES = {
    ddos: { color: C.orange, pts: 30 },
    sqli: { color: C.peach, pts: 20 },
    bot: { color: C.blue, pts: 10 },
  };

  function sprite(rows, color, accent = C.orange) {
    const c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((v, x) => {
      if (v === '0') return;
      g.fillStyle = v === '2' ? accent : color;
      g.fillRect(x, y, 1, 1);
    }));
    return c;
  }
  const IMG = {
    bot: SPR.bot.map((f) => sprite(f, TYPES.bot.color)),
    sqli: SPR.sqli.map((f) => sprite(f, TYPES.sqli.color)),
    ddos: SPR.ddos.map((f) => sprite(f, TYPES.ddos.color)),
    ufo: [sprite(SPR.ufo[0], C.red)],
    ship: [sprite(SPR.ship[0], C.ink)],
  };

  // Legend beside the screen uses the same sprites.
  document.querySelectorAll('canvas[data-sprite]').forEach((c) => {
    const g = c.getContext('2d');
    const img = IMG[c.dataset.sprite][0];
    g.drawImage(img, Math.floor((c.width - img.width) / 2), 0);
  });

  const canvas = document.getElementById('game');
  const screen = document.getElementById('screen');
  if (!canvas || !screen) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const startBtn = document.getElementById('start');
  const bestEl = document.getElementById('best');
  const soundBtn = document.getElementById('sound');

  // 3×5 bitmap font, rows top to bottom.
  const FONT = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', ' ': '000000000000000', ':': '000010000010000', '.': '000000000000010', ',': '000000000010100',
    '!': '010010010000010', '-': '000000111000000', '=': '000111000111000', '/': '001001010100100', '?': '111001010000010', "'": '010010000000000',
  };
  function text(str, x, y, color = C.ink, s = 1, align = 'left') {
    const chars = [...str.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()];
    const width = chars.length * 4 * s - s;
    let cx = align === 'center' ? Math.round(x - width / 2) : align === 'right' ? x - width : x;
    ctx.fillStyle = color;
    for (const ch of chars) {
      const g = FONT[ch] || FONT['?'];
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
      cx += 4 * s;
    }
  }

  // Scanlines, drawn once and laid over every frame.
  const scan = document.createElement('canvas');
  scan.width = W; scan.height = H;
  { const g = scan.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 1; y < H; y += 2) g.fillRect(0, y, W, 1); }

  const sky = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: Math.random() * 18 + 4, c: Math.random() < 0.15 ? C.orange : Math.random() < 0.5 ? C.muted : C.ink }));

  // ---------- sound ----------
  let audio = null, soundOn = false;
  function tone(freq, dur, type = 'square', vol = 0.05, slide = 0) {
    if (!soundOn) return;
    audio ??= new AudioContext();
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
  }
  function boom(dur = 0.25, vol = 0.08) {
    if (!soundOn) return;
    audio ??= new AudioContext();
    const len = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = audio.createBufferSource(), g = audio.createGain();
    g.gain.value = vol; s.buffer = buf; s.connect(g).connect(audio.destination); s.start();
  }
  soundBtn?.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.textContent = soundOn ? 'Som ligado' : 'Som desligado';
    if (soundOn) { audio ??= new AudioContext(); audio.resume(); tone(660, 0.08); }
  });

  // ---------- state ----------
  let best = 0;
  try { best = Number(localStorage.getItem('vpc-best')) || 0; } catch {}
  const showBest = () => { if (bestEl) bestEl.textContent = `Recorde neste navegador: ${best}`; };
  showBest();

  const keys = { left: false, right: false, fire: false };
  let state = 'title', stateT = 0, score = 0, wave = 1, lives = 3, shake = 0;
  let player, bullets, ebullets, invaders, particles, popups, bunkers, ufo;
  let fx, fy, dir, animT, frame, diveT, fireT, ufoT, march = 0, total;

  const COLS = 8, ROWS = 5, CW = 18, CH = 14;
  const ROW_TYPE = ['ddos', 'sqli', 'sqli', 'bot', 'bot'];
  const BUNKER = ['0000111111111111110000', '0001111111111111111000', '0011111111111111111100', '0111111111111111111110',
    '1111111111111111111111', '1111111111111111111111', '1111111111111111111111', '1111111111111111111111',
    '1111111111111111111111', '1111110000000000111111', '1111100000000000011111', '1111000000000000001111',
    '1111000000000000001111', '1111000000000000001111'];
  const LAYERS = ['WAF', 'SG', 'NACL'];

  function buildBunkers() {
    bunkers = LAYERS.map((label, i) => ({
      label, x: Math.round(W * (i + 1) / 4 - 11), y: H - 56, w: 22, h: 14,
      px: Uint8Array.from(BUNKER.join(''), (v) => +v),
    }));
  }
  function buildWave() {
    invaders = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const type = ROW_TYPE[r];
      const w = IMG[type][0].width;
      invaders.push({ type, r, c, w, h: 8, x: 0, y: 0, alive: true, dive: null });
    }
    total = invaders.length;
    fx = (W - (COLS - 1) * CW - 12) / 2; fy = 28 + Math.min(wave - 1, 5) * 5; dir = 1;
    animT = 0; frame = 0; diveT = 3; fireT = 1.2; ufoT = 12 + Math.random() * 10;
    bullets = []; ebullets = []; ufo = null;
    buildBunkers();
    place();
  }
  function slot(v) { return { x: fx + v.c * CW + (12 - v.w) / 2, y: fy + v.r * CH }; }
  function place() { for (const v of invaders) if (v.alive && !v.dive) Object.assign(v, slot(v)); }

  function reset() {
    score = 0; wave = 1; lives = 3; particles = []; popups = [];
    player = { x: W / 2 - 5, y: H - 22, w: 11, h: 10, cool: 0, inv: 0 };
    buildWave();
  }
  reset();

  function start() {
    reset();
    setState('count');
    startBtn.hidden = true;
    screen.focus({ preventScroll: true });
  }
  function setState(s) { state = s; stateT = 0; }

  function burst(x, y, color, n = 10, speed = 50) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * speed + 10;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, color });
    }
  }
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function erode(b, x, y, r = 2) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (i * i + j * j > r * r + Math.random() * 2) continue;
      const px = Math.floor(x - b.x) + i, py = Math.floor(y - b.y) + j;
      if (px >= 0 && py >= 0 && px < b.w && py < b.h) b.px[py * b.w + px] = 0;
    }
  }
  function bunkerAt(x, y) {
    for (const b of bunkers) {
      const px = Math.floor(x - b.x), py = Math.floor(y - b.y);
      if (px >= 0 && py >= 0 && px < b.w && py < b.h && b.px[py * b.w + px]) return b;
    }
    return null;
  }

  function loseLife() {
    lives -= 1;
    burst(player.x + 5, player.y + 5, C.orange, 26, 70);
    burst(player.x + 5, player.y + 5, C.ink, 12, 40);
    boom(0.5, 0.12);
    if (!reduce) shake = 0.4;
    ebullets = [];
    for (const v of invaders) if (v.dive) v.dive.phase = 'back', v.y = -10;
    setState(lives > 0 ? 'dying' : 'over');
    if (lives <= 0) endGame();
  }
  function endGame() {
    if (score > best) { best = score; try { localStorage.setItem('vpc-best', String(best)); } catch {} showBest(); }
    setTimeout(() => { startBtn.textContent = 'Jogar de novo'; startBtn.hidden = false; }, 1200);
  }

  // ---------- update ----------
  function update(dt) {
    stateT += dt;
    for (const s of sky) { s.y += s.v * dt * (state === 'play' ? 1 : 0.4); if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
    particles = particles.filter((p) => (p.x += p.vx * dt, p.y += p.vy * dt, p.vx *= 0.96, p.vy *= 0.96, (p.life -= dt) > 0));
    popups = popups.filter((p) => (p.y -= 12 * dt, (p.life -= dt) > 0));
    shake = Math.max(0, shake - dt);

    if (state === 'count') { if (stateT > 3.4) setState('play'); return; }
    if (state === 'dying') { if (stateT > 1.4) { player.x = W / 2 - 5; player.inv = 2; setState('play'); } return; }
    if (state === 'wave') { if (stateT > 1.8) { wave += 1; buildWave(); setState('play'); } return; }
    if (state !== 'play') return;

    // player
    const sp = 110;
    if (keys.left) player.x -= sp * dt;
    if (keys.right) player.x += sp * dt;
    player.x = Math.max(4, Math.min(W - player.w - 4, player.x));
    player.cool -= dt; player.inv = Math.max(0, player.inv - dt);
    if (keys.fire && player.cool <= 0 && bullets.length < 2) {
      bullets.push({ x: player.x + 5, y: player.y - 2, w: 1, h: 5 });
      player.cool = 0.3;
      tone(880, 0.09, 'square', 0.035, 330);
    }
    bullets = bullets.filter((b) => (b.y -= 230 * dt) > -6);

    // formation
    const alive = invaders.filter((v) => v.alive);
    if (!alive.length) { setState('wave'); tone(523, 0.12); setTimeout(() => tone(784, 0.2), 120); return; }
    const speed = 9 + 48 * (1 - alive.length / total) + wave * 3;
    fx += dir * speed * dt;
    const inFormation = alive.filter((v) => !v.dive);
    const xs = inFormation.map((v) => slot(v).x);
    if (xs.length) {
      const minX = Math.min(...xs), maxX = Math.max(...inFormation.map((v) => slot(v).x + v.w));
      if ((dir > 0 && maxX > W - 6) || (dir < 0 && minX < 6)) { dir *= -1; fy += 5; }
    }
    animT += dt * (0.8 + speed / 25);
    if (animT > 1) { animT = 0; frame ^= 1; tone([62, 55, 49, 46][march++ % 4], 0.08, 'square', 0.04); }
    place();

    // Galaga dives
    diveT -= dt;
    if (diveT <= 0 && inFormation.length > 3) {
      const pool = inFormation.filter((v) => v.r >= 1);
      const v = (pool.length ? pool : inFormation)[(Math.random() * (pool.length || inFormation.length)) | 0];
      v.dive = { phase: 'down', t: 0, shot: false };
      diveT = Math.max(1.1, 3.6 + Math.random() * 2.5 - wave * 0.35);
      tone(300, 0.35, 'sawtooth', 0.03, 900);
    }
    for (const v of alive) {
      if (!v.dive) continue;
      const d = v.dive; d.t += dt;
      if (d.phase === 'down') {
        v.y += (70 + wave * 6) * dt;
        v.x += (player.x - v.x) * dt * 1.1 + Math.sin(d.t * 5) * 45 * dt;
        if (!d.shot && v.y > 90) { d.shot = true; ebullets.push({ x: v.x + v.w / 2, y: v.y + 8, w: 1, h: 4, vy: 120 }); }
        if (v.y > H + 8) { d.phase = 'back'; v.y = -10; }
      } else {
        const s = slot(v);
        v.x += (s.x - v.x) * Math.min(1, dt * 4);
        v.y += 70 * dt;
        if (v.y >= s.y) v.dive = null;
      }
    }

    // enemy fire
    fireT -= dt;
    if (fireT <= 0 && ebullets.length < 3 + Math.floor(wave / 2)) {
      const cols = {};
      for (const v of inFormation) if (!cols[v.c] || cols[v.c].r < v.r) cols[v.c] = v;
      const shooters = Object.values(cols);
      if (shooters.length) {
        const v = shooters[(Math.random() * shooters.length) | 0];
        ebullets.push({ x: v.x + v.w / 2, y: v.y + 8, w: 1, h: 4, vy: 85 + wave * 6 });
      }
      fireT = (0.5 + Math.random() * 0.9) / (1 + wave * 0.15);
    }
    ebullets = ebullets.filter((b) => (b.y += b.vy * dt) < H + 4);

    // zero-day
    ufoT -= dt;
    if (!ufo && ufoT <= 0) {
      const from = Math.random() < 0.5 ? -1 : 1;
      ufo = { x: from < 0 ? -16 : W, y: 14, w: 16, h: 7, vx: -from * 42, pts: [50, 100, 150, 300][(Math.random() * 4) | 0] };
      ufoT = 16 + Math.random() * 12;
    }
    if (ufo) { ufo.x += ufo.vx * dt; if (ufo.x < -20 || ufo.x > W + 4) ufo = null; else if ((stateT * 8 | 0) % 2) tone(1400, 0.03, 'sine', 0.015); }

    // player bullets
    for (const b of bullets) {
      const bk = bunkerAt(b.x, b.y);
      if (bk) { erode(bk, b.x, b.y, 2); b.y = -99; continue; }
      if (ufo && hit(b, ufo)) {
        score += ufo.pts; popups.push({ x: ufo.x + 8, y: ufo.y, t: String(ufo.pts), life: 1 });
        burst(ufo.x + 8, ufo.y + 3, C.red, 22, 60); boom(0.35); ufo = null; b.y = -99; continue;
      }
      for (const v of alive) {
        if (!v.alive || !hit(b, v)) continue;
        v.alive = false; b.y = -99;
        const t = TYPES[v.type];
        score += v.dive ? t.pts * 2 : t.pts;
        burst(v.x + v.w / 2, v.y + 4, t.color, 12);
        boom(0.18, 0.05);
        break;
      }
      for (const e of ebullets) if (Math.abs(e.x - b.x) < 2 && Math.abs(e.y - b.y) < 5) { e.y = H + 9; b.y = -99; }
    }
    bullets = bullets.filter((b) => b.y > -50);

    // enemy bullets and bodies
    for (const e of ebullets) {
      const bk = bunkerAt(e.x, e.y + 3);
      if (bk) { erode(bk, e.x, e.y + 3, 2); e.y = H + 9; continue; }
      if (player.inv <= 0 && hit(e, player)) { loseLife(); return; }
    }
    for (const v of alive) {
      if (!v.alive) continue;
      for (const b of bunkers) if (hit(v, b)) for (let y = 0; y < 8; y += 2) for (let x = 0; x < v.w; x += 2) erode(b, v.x + x, v.y + y, 1);
      if (player.inv <= 0 && hit(v, player)) { v.alive = false; burst(v.x, v.y, TYPES[v.type].color); loseLife(); return; }
      if (!v.dive && v.y + 8 >= player.y) { lives = 1; loseLife(); return; }
    }
  }

  // ---------- draw ----------
  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(((Math.random() * 2 - 1) * 3) | 0, ((Math.random() * 2 - 1) * 3) | 0);
    ctx.fillStyle = C.bg; ctx.fillRect(-4, -4, W + 8, H + 8);
    for (const s of sky) { ctx.fillStyle = s.c; ctx.fillRect(s.x | 0, s.y | 0, 1, s.v > 16 ? 2 : 1); }

    // HUD
    text('BLOQUEADAS', 6, 4, C.muted);
    text(String(score).padStart(5, '0'), 50, 4, C.ink);
    text('RECORDE', W - 30, 4, C.muted, 1, 'right');
    text(String(Math.max(best, score)).padStart(5, '0'), W - 6, 4, C.ink, 1, 'right');
    text('AZ', 6, H - 9, C.muted);
    ['A', 'B', 'C'].forEach((z, i) => {
      const up = i < lives;
      ctx.fillStyle = up ? C.orange : '#233047';
      ctx.fillRect(18 + i * 10, H - 10, 8, 7);
      text(z, 20 + i * 10, H - 9, up ? C.bg : C.muted);
    });
    text(`ONDA ${wave}`, W - 6, H - 9, C.muted, 1, 'right');
    ctx.fillStyle = '#1b2a44'; ctx.fillRect(0, H - 13, W, 1);

    if (state === 'title') {
      text('DEFESA DA VPC', W / 2, 52, C.orange, 3, 'center');
      text('REGIAO US-EAST-1', W / 2, 74, C.muted, 1, 'center');
      const rows = [['ddos', '= 30'], ['sqli', '= 20'], ['bot', '= 10'], ['ufo', '= ???']];
      rows.forEach(([k, label], i) => {
        const img = IMG[k][0];
        ctx.drawImage(img, W / 2 - 22 - img.width / 2, 98 + i * 14);
        text(label, W / 2 - 6, 99 + i * 14, C.ink);
      });
      text('ENTER OU TOQUE EM COMECAR', W / 2, 160, C.ink, 1, 'center');
    }

    // bunkers
    for (const b of bunkers) {
      ctx.fillStyle = C.shield;
      for (let i = 0; i < b.px.length; i++) if (b.px[i]) ctx.fillRect(b.x + (i % b.w), b.y + ((i / b.w) | 0), 1, 1);
      text(b.label, b.x + 11, b.y + 17, C.muted, 1, 'center');
    }

    if (state !== 'title') {
      for (const v of invaders) if (v.alive) ctx.drawImage(IMG[v.type][v.dive ? (stateT * 6 | 0) % 2 : frame], v.x | 0, v.y | 0);
      if (ufo) { ctx.drawImage(IMG.ufo[0], ufo.x | 0, ufo.y); text('ZERO-DAY', ufo.x + 8, ufo.y - 7, C.red, 1, 'center'); }
      const blink = player.inv > 0 && (stateT * 10 | 0) % 2;
      if (state !== 'dying' && state !== 'over' && !blink) ctx.drawImage(IMG.ship[0], player.x | 0, player.y | 0);
      ctx.fillStyle = C.ink; for (const b of bullets) ctx.fillRect(b.x | 0, b.y | 0, 1, 5);
      ctx.fillStyle = C.orange;
      for (const e of ebullets) { const z = (e.y / 3 | 0) % 2; ctx.fillRect((e.x + z) | 0, e.y | 0, 1, 2); ctx.fillRect((e.x - z) | 0, (e.y + 2) | 0, 1, 2); }
    }
    for (const p of particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x | 0, p.y | 0, 1, 1); }
    ctx.globalAlpha = 1;
    for (const p of popups) text(p.t, p.x, p.y | 0, C.red, 1, 'center');

    if (state === 'count') {
      const n = Math.floor(stateT / 0.8);
      const word = ['3', '2', '1'][n] ?? 'JA!';
      text(word, W / 2, 112, n > 2 ? C.orange : C.ink, n > 2 ? 3 : 4, 'center');
    }
    if (state === 'wave') { text(`ONDA ${wave} BLOQUEADA`, W / 2, 104, C.orange, 2, 'center'); text('PROXIMA LEVA A CAMINHO', W / 2, 122, C.muted, 1, 'center'); }
    if (state === 'dying') text(`AZ ${'ABC'[lives]} FORA DO AR`, W / 2, 112, C.orange, 2, 'center');
    if (state === 'paused') { text('PAUSADO', W / 2, 104, C.ink, 3, 'center'); text('P PARA CONTINUAR', W / 2, 126, C.muted, 1, 'center'); }
    if (state === 'over') {
      text('TERRAFORM DESTROY', W / 2, 80, C.orange, 3, 'center');
      text('AS TRES AZS CAIRAM', W / 2, 104, C.muted, 1, 'center');
      text(`BLOQUEADAS: ${score}`, W / 2, 120, C.ink, 2, 'center');
      if (score && score >= best) text('NOVO RECORDE!', W / 2, 138, C.orange, 1, 'center');
    }
    ctx.restore();
    ctx.drawImage(scan, 0, 0);
  }

  // ---------- loop ----------
  let visible = false, last = 0, raf = 0;
  function tick(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    update(dt);
    draw();
    raf = visible ? requestAnimationFrame(tick) : 0;
  }
  function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  const pause = () => { if (state === 'play' || state === 'count') setState('paused'); };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) wake(); else pause();
  }, { threshold: 0.15 }).observe(screen);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  draw();

  // ---------- input ----------
  const playing = () => ['play', 'count', 'paused', 'dying', 'wave'].includes(state);
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', ArrowUp: 'fire' };
  addEventListener('keydown', (e) => {
    const focused = screen.contains(document.activeElement);
    if (e.code === 'Enter' && focused && (state === 'title' || state === 'over')) { e.preventDefault(); start(); return; }
    if (!playing() || !visible) return;
    if (e.code === 'KeyP' || e.code === 'Escape') { setState(state === 'paused' ? 'play' : 'paused'); if (state === 'paused') stateT = 0; return; }
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { keys.left = keys.right = keys.fire = false; });
  startBtn.addEventListener('click', start);
  screen.addEventListener('click', (e) => { if (e.target === canvas && state === 'paused') setState('play'); });

  document.querySelectorAll('.pad button').forEach((b) => {
    const k = b.dataset.key;
    const on = (e) => { e.preventDefault(); keys[k] = true; b.classList.add('is-down'); if (state === 'title' || state === 'over') start(); if (state === 'paused') setState('play'); };
    const off = () => { keys[k] = false; b.classList.remove('is-down'); };
    b.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, off));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
})();
