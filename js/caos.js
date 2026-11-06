// Chaos layer on top of js/pixel.js (window.pixelKit): lasers break the page apart and it rebuilds itself.
// Text comes apart glyph by glyph, planets and photos get craters and break into pixels.
(() => {
  const K = window.pixelKit;
  if (!K || K.reduce) return;
  const { P, make, ag, hits, burst, droid, clamp, pick, sfx, dither } = K;
  const D = () => K.dpr;
  const say = (t, ms = 2800) => droid?.say(t, ms);
  const cool = {};
  const once = (k, ms) => { const n = performance.now(); if ((cool[k] || 0) > n) return false; cool[k] = n + ms; return true; };
  K.once = once;

  // ---------- pieces: bits of a canvas that drift, spin and fade ----------
  const bits = [], rings = [];
  K.flash = 0;
  function bit(img, sx, sy, sw, sh, x, y, w, h, vx, vy, o = {}) {
    bits.push({ img, sx, sy, sw, sh, x, y, w, h, vx, vy, a: 0, va: o.va ?? (Math.random() - 0.5) * 10, g: o.g ?? 1400, floor: o.floor ?? true, life: (o.life ?? 2.2) * (0.7 + Math.random() * 0.6), drag: o.drag ?? 1 });
    if (bits.length > 1500) bits.splice(0, bits.length - 1500);
  }
  K.ring = (x, y, r, col = 'W', flat = false) => rings.push({ x, y, r: 4, max: r, col, flat, life: 1 });
  K.shock = K.ring;
  K.quake = (ms = 420) => { const b = document.body; b.classList.remove('quake'); void b.offsetWidth; b.classList.add('quake'); setTimeout(() => b.classList.remove('quake'), ms); };
  // split a canvas shown at `rect` into square bits pushed away from (ox, oy)
  K.pixelize = function (cv, rect, cell, ox, oy, speed, o = {}) {
    const k = rect.width / cv.width;
    let data = null; try { data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; } catch {}
    for (let y = 0; y < cv.height; y += cell) for (let x = 0; x < cv.width; x += cell) {
      const mx = Math.min(cv.width - 1, x + (cell >> 1)), my = Math.min(cv.height - 1, y + (cell >> 1));
      if (data && data[(my * cv.width + mx) * 4 + 3] < 60) continue;
      const px = rect.left + (x + cell / 2) * k, py = rect.top + (y + cell / 2) * k;
      const a = Math.atan2(py - oy, px - ox) + (Math.random() - 0.5) * 0.5, v = speed * (0.35 + Math.random() * 0.9);
      bit(cv, x, y, cell, cell, px, py, cell * k, cell * k, Math.cos(a) * v, Math.sin(a) * v - (o.up || 0), o);
    }
  };
  function stepBits(dt) {
    for (const s of bits) {
      s.vy += s.g * dt; if (s.drag !== 1) { const f = Math.pow(s.drag, dt * 60); s.vx *= f; s.vy *= f; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt; s.life -= dt;
      if (s.floor && s.y > innerHeight - s.h / 2) { s.y = innerHeight - s.h / 2; s.vy *= -0.3; s.vx *= 0.6; s.va *= 0.5; }
    }
    for (let i = bits.length - 1; i >= 0; i--) if (bits[i].life <= 0 || bits[i].y > innerHeight + 300) bits.splice(i, 1);
    for (const r of rings) { r.r += (r.max - r.r) * Math.min(1, dt * 4) + dt * 30; r.life -= dt * 1.3; }
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1);
    K.flash = Math.max(0, K.flash - dt * 1.8);
  }
  function drawBits() {
    const d = D(); ag.imageSmoothingEnabled = false;
    for (const s of bits) { ag.save(); ag.globalAlpha = clamp(s.life * 1.6, 0, 1); ag.translate(s.x * d, s.y * d); ag.rotate(s.a); ag.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, (-s.w / 2) * d, (-s.h / 2) * d, s.w * d, s.h * d); ag.restore(); }
    for (const r of rings) { ag.globalAlpha = clamp(r.life, 0, 1) * 0.85; ag.strokeStyle = P[r.col] || r.col; ag.lineWidth = (r.flat ? 4 : 2) * d; ag.beginPath(); ag.ellipse(r.x * d, r.y * d, r.r * d, (r.flat ? r.r * 0.16 : r.r) * d, r.flat ? -0.18 : 0, 0, 7); ag.stroke(); }
    ag.globalAlpha = 1;
  }
  function drawFlash() { if (K.flash > 0) { ag.globalAlpha = Math.min(0.7, K.flash); ag.fillStyle = P.W; ag.fillRect(0, 0, innerWidth * D(), innerHeight * D()); ag.globalAlpha = 1; } }

  // ======================================================================
  // Text: on the first hit the block is split into one span per glyph. Glyphs at the impact fly off,
  // the ones around get knocked out of line, past half the block the rest slides down.
  // Eleven seconds without a hit and it comes back from "backup".
  // ======================================================================
  const TEXT = 'h1, h2, h3, p, li, dt, dd, a, button, figcaption, kbd, label, .mail, summary';
  const SKIP = 'dialog, .bot-say, .skip, .visually-hidden, script, style, input, textarea, .obs, .route';
  const broken = new Set();
  const hostOf = (el) => { const h = el?.closest?.(TEXT) || el; return !h || h.closest(SKIP) ? null : h; };
  function caretAt(x, y) {
    if (document.caretPositionFromPoint) { const c = document.caretPositionFromPoint(x, y); return c && { node: c.offsetNode, off: c.offset }; }
    const r = document.caretRangeFromPoint?.(x, y); return r && { node: r.startContainer, off: r.startOffset };
  }
  const rng = document.createRange();
  // the block under (x, y), only when a visible glyph is really there, so bolts pass between lines
  function textAt(el, x, y) {
    if (el.classList?.contains('ch')) return el._gone ? null : hostOf(el.parentElement);
    const c = caretAt(x, y);
    if (!c || c.node?.nodeType !== 3 || !el.contains(c.node)) return null;
    if (c.node.parentElement?._gone) return null;
    const t = c.node.data;
    for (const i of [c.off - 1, c.off]) {
      if (i < 0 || i >= t.length || !t[i].trim()) continue;
      rng.setStart(c.node, i); rng.setEnd(c.node, i + 1); const r = rng.getBoundingClientRect();
      if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top && y <= r.bottom) return hostOf(c.node.parentElement);
    }
    return null;
  }
  function split(h) {
    if (h._ch && h._ch[0]?.isConnected) return h._ch;
    const out = [];
    if (h instanceof SVGTextElement) {
      const t = h.textContent; h.textContent = '';
      for (const c of t) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'tspan'); s.textContent = c; h.append(s); if (c.trim()) out.push(s); }
    } else {
      const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT), nodes = [];
      while (w.nextNode()) { const n = w.currentNode; if (n.data.trim() && !n.parentElement.closest('.ch, svg, ' + SKIP)) nodes.push(n); }
      for (const n of nodes) {
        const f = document.createDocumentFragment();
        for (const c of n.data) { if (!c.trim()) { f.append(c); continue; } const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; f.append(s); out.push(s); }
        n.replaceWith(f);
      }
    }
    h._ch = out; h._lost = 0; return out;
  }
  const glyphCache = new Map();
  function glyphCanvas(s, r) {
    const cs = getComputedStyle(s), svg = s instanceof SVGElement, fs = svg ? r.height * 0.9 : parseFloat(cs.fontSize) || 16;
    let ch = s.textContent; if (cs.textTransform === 'uppercase') ch = ch.toUpperCase();
    const q = clamp(26 / fs, 0.1, 1), col = svg ? cs.fill : cs.color, key = `${ch}|${fs}|${col}|${cs.fontFamily}|${cs.fontWeight}`;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const [c, g] = make(Math.max(2, Math.ceil(r.width * q) + 2), Math.max(2, Math.ceil(r.height * q) + 2));
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${fs * q}px ${cs.fontFamily}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, c.width / 2, c.height / 2 + fs * q * 0.06);
    const im = g.getImageData(0, 0, c.width, c.height), a = im.data; for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 90 ? 255 : 0; g.putImageData(im, 0, 0);
    if (glyphCache.size > 400) glyphCache.clear();
    glyphCache.set(key, c); return c;
  }
  const hide = (s) => { s._gone = true; if (s instanceof SVGElement) s.style.fillOpacity = '0'; else s.style.opacity = '0'; };
  function popGlyph(s, ix, iy, pw, soft) {
    const r = s.getBoundingClientRect(); hide(s);
    if (!r.width || !visibleRectR(r)) return;
    const c = glyphCanvas(s, r), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (soft) { bit(c, 0, 0, c.width, c.height, cx, cy, r.width, r.height, (Math.random() - 0.5) * 80, -Math.random() * 120, { va: (Math.random() - 0.5) * 4, life: 2.6 }); return; }
    if (r.height > 46) { K.pixelize(c, r, Math.max(1, Math.round(c.height / 11)), ix, iy, 380 * pw, { up: 160, life: 2.4 }); return; }
    const a = Math.atan2(cy - iy, cx - ix), v = (220 + Math.random() * 320) * pw;
    bit(c, 0, 0, c.width, c.height, cx, cy, r.width, r.height, Math.cos(a) * v, Math.sin(a) * v - 220);
  }
  const visibleRectR = (r) => r.bottom > -40 && r.top < innerHeight + 40;
  function breakText(h, x, y, pw = 1) {
    const chars = split(h); if (!chars.length) return false;
    let best = -1, bd = 1e9;
    const rs = chars.map((s, i) => { if (s._gone) return null; const r = s.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y); if (d < bd) { bd = d; best = i; } return r; });
    if (best < 0) return false;
    const fs = rs[best].height, R = (fs < 40 ? clamp(fs * 0.6, 8, 26) : fs * 0.18) * pw;
    chars.forEach((s, i) => {
      const r = rs[i]; if (!r) return;
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (i === best || d < R) { popGlyph(s, x, y, pw); h._lost++; }
      else if (d < R * 2.6 && !(s instanceof SVGElement)) { s.classList.add('cracked'); s.style.position = 'relative'; const m = Math.min(6, fs * 0.14); s.style.left = `${((Math.random() - 0.5) * m).toFixed(1)}px`; s.style.top = `${(Math.random() * m).toFixed(1)}px`; }
    });
    h._back = performance.now() + 11000; broken.add(h);
    burst(x, y, 8, 'o', 240, 0.4); burst(x, y, 5, 'y', 180, 0.3); sfx().tone(240, 0.09, 'square', 0.025, 70);
    if (h._lost / chars.length > 0.5 && !h._fell) {
      h._fell = true; chars.forEach((s) => { if (!s._gone) { popGlyph(s, x, y, 0.2, true); h._lost++; } });
      if (once('fell', 9000)) say(pick(['Esse bloco de texto já era. O backup restaura em segundos.', 'Desmontou tudo! Calma, eu restauro.', 'Parágrafo fora do ar. Subindo de novo...']), 2600);
    }
    return true;
  }
  function restoreText(now) {
    for (const h of broken) {
      if (!h.isConnected) { broken.delete(h); continue; }
      if (now < h._back) continue;
      for (const s of h._ch || []) {
        if (!s._gone && !s.classList.contains('cracked')) continue;
        s._gone = false; s.style.opacity = ''; s.style.fillOpacity = ''; s.style.position = ''; s.style.left = ''; s.style.top = '';
        s.classList.remove('cracked'); s.classList.add('rebuilt'); setTimeout(() => s.classList.remove('rebuilt'), 700);
      }
      h._lost = 0; h._fell = false; broken.delete(h);
    }
  }
  function svgTextAt(t, x, y) {
    const chars = split(t);
    return chars.some((s) => { if (s._gone) return false; const r = s.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
  }

  // ======================================================================
  // Planets and photos: each hit leaves a crater in the pixels; at zero they break apart and re-form later
  // ======================================================================
  const BODY = '.planet, .name .moon, .lic-body img, .feature-media img';
  const HP = (img) => (img.matches('.p-hero') ? 14 : img.matches('.moon') ? 8 : img.matches('.p-leds') ? 16 : img.matches('.p-contact') ? 14 : img.closest('.lic-body') ? 4 : 6);
  const NAME = (img) => (img.matches('.p-hero') ? 'a Terra' : img.matches('.moon') ? 'a Lua' : img.matches('.p-leds') ? 'Júpiter' : img.matches('.p-contact') ? 'Saturno' : null);
  const AT = { 'a Terra': 'com a Terra', 'a Lua': 'com a Lua', Júpiter: 'com Júpiter', Saturno: 'com Saturno' };
  const bodies = new Map();
  function bodyOf(img) {
    let b = bodies.get(img); if (b) return b;
    if (!img.complete || !img.naturalWidth) return null;
    const cap = img.classList.contains('pixelated') ? img.naturalWidth : 200;
    const w = Math.min(img.naturalWidth, cap), h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth));
    const [cv, g] = make(w, h); g.drawImage(img, 0, 0, w, h);
    let ok = true; try { g.getImageData(0, 0, 1, 1); } catch { ok = false; }
    b = { img, cv, g, ok, orig: img.src, hp: HP(img), max: HP(img), gone: false, back: 0 };
    bodies.set(img, b); return b;
  }
  K.bodyOf = bodyOf;
  // the point in the image's own frame (Saturn is rotated)
  function local(img, x, y) {
    const r = img.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, w = img.offsetWidth || r.width, h = img.offsetHeight || r.height;
    const a = -(parseFloat(getComputedStyle(img).rotate) || 0) * Math.PI / 180, dx = x - cx, dy = y - cy;
    return { u: (dx * Math.cos(a) - dy * Math.sin(a)) / w + 0.5, v: (dx * Math.sin(a) + dy * Math.cos(a)) / h + 0.5, w, h, cx, cy };
  }
  function solidAt(b, x, y) {
    const L = local(b.img, x, y); if (L.u < 0 || L.u > 1 || L.v < 0 || L.v > 1) return null;
    if (!b.ok) return (L.u - 0.5) ** 2 + (L.v - 0.5) ** 2 < 0.22 ? L : null;
    const px = b.g.getImageData(Math.min(b.cv.width - 1, L.u * b.cv.width | 0), Math.min(b.cv.height - 1, L.v * b.cv.height | 0), 1, 1).data;
    return px[3] > 100 ? { ...L, col: `rgb(${px[0]},${px[1]},${px[2]})` } : null;
  }
  function crater(b, cx, cy, pw) {
    const R = Math.max(2, b.cv.width * 0.05) * (0.7 + pw * 0.5);
    const x0 = Math.max(0, Math.floor(cx - R - 1)), y0 = Math.max(0, Math.floor(cy - R - 1)), x1 = Math.min(b.cv.width, Math.ceil(cx + R + 1)), y1 = Math.min(b.cv.height, Math.ceil(cy + R + 1));
    if (x1 <= x0 || y1 <= y0) return;
    const im = b.g.getImageData(x0, y0, x1 - x0, y1 - y0), a = im.data, hot = b.hp < b.max * 0.5;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = ((y - y0) * (x1 - x0) + (x - x0)) * 4; if (a[i + 3] < 20) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R; if (d > 1.15) continue;
      if (d < 0.3 && hot) { a[i] = 255; a[i + 1] = 150; a[i + 2] = 60; continue; }
      const k = d < 0.55 ? (dither(x, y, 0.7) ? 0.2 : 0.32) : d < 0.85 ? 0.55 : 1.25;
      for (let c = 0; c < 3; c++) a[i + c] = clamp(a[i + c] * k, 0, 255);
    }
    b.g.putImageData(im, x0, y0);
  }
  function hitBody(b, x, y, pw, L) {
    if (b.ok) { crater(b, L.u * b.cv.width, L.v * b.cv.height, pw); b.img.src = b.cv.toDataURL(); b.img.classList.add('pixelated'); }
    b.hp -= pw;
    burst(x, y, 10, L.col || 'o', 260, 0.6); burst(x, y, 5, 'y', 180, 0.3); sfx().tone(140, 0.12, 'square', 0.03, 60);
    if (b.hp <= 0) breakBody(b);
    else if (b.hp < b.max * 0.35 && NAME(b.img) && once('hp' + b.img.className, 20000)) say(`Pega leve ${AT[NAME(b.img)]}! Já tá cheia de cratera.`, 2600);
  }
  function breakBody(b, cause) {
    if (b.gone) return;
    b.gone = true; b.back = performance.now() + 24000;
    const L = local(b.img, 0, 0), rect = { left: L.cx - L.w / 2, top: L.cy - L.h / 2, width: L.w, height: L.h }, big = L.w > 150;
    K.pixelize(b.cv, rect, Math.max(2, Math.round(b.cv.width / (big ? 20 : 8))), L.cx, L.cy, big ? 420 : 200, { g: 0, floor: false, drag: 0.985, life: 2.8 });
    b.img.style.opacity = '0';
    burst(L.cx, L.cy, 30, 'o', 520, 0.9); burst(L.cx, L.cy, 20, 'y', 380, 0.6);
    K.ring(L.cx, L.cy, L.w * 0.9, 'y');
    if (big) { K.ring(L.cx, L.cy, L.w * 2.2, 'c', true); K.flash = cause === 'station' ? 0.7 : 0.35; K.quake(600); }
    sfx().tone(60, 0.9, 'sawtooth', 0.06, 25);
    const n = NAME(b.img);
    if (cause === 'station' && n) say(`A estação de batalha desintegrou ${n}! Em 24 segundos ela se recompõe.`, 3600);
    else if (n) say(pick([`Você desintegrou ${n}! Volta em 24 segundos.`, `Lá se foi ${n}. Recompondo os pixels...`]), 3200);
    else if (once('photo', 15000)) say('A foto virou pixel. Literalmente.', 2400);
  }
  function restoreBodies(now) {
    for (const b of bodies.values()) {
      if (!b.gone || now < b.back) continue;
      b.gone = false; b.hp = b.max;
      b.img.addEventListener('load', () => { b.g.clearRect(0, 0, b.cv.width, b.cv.height); b.g.drawImage(b.img, 0, 0, b.cv.width, b.cv.height); }, { once: true });
      b.img.src = b.orig; b.img.style.opacity = '';
      b.img.classList.remove('reform'); void b.img.offsetWidth; b.img.classList.add('reform'); setTimeout(() => b.img.classList.remove('reform'), 1300);
    }
  }
  K.breakBody = breakBody;

  // ======================================================================
  // What a bolt hits at (x, y): text first (it is on top), then images in the flow, then the planets behind
  // ======================================================================
  function worldHit(x, y, pw = 1) {
    const el = document.elementFromPoint(x, y);
    if (el && !el.closest(SKIP)) {
      const wm = el.closest('.wordmark'), t = wm?.querySelector('text');
      if (t) { if (svgTextAt(t, x, y)) return breakText(t, x, y, pw); }
      else {
        const h = textAt(el, x, y); if (h) return breakText(h, x, y, pw);
        if (el.matches?.(BODY)) { const b = bodyOf(el), L = b && !b.gone && solidAt(b, x, y); if (L) { hitBody(b, x, y, pw, L); return true; } }
      }
    }
    for (const img of document.querySelectorAll('.planet')) {
      const r = img.getBoundingClientRect(); if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const b = bodyOf(img), L = b && !b.gone && solidAt(b, x, y); if (L) { hitBody(b, x, y, pw, L); return true; }
    }
    return false;
  }
  K.worldHit = worldHit;
  K.impact = (x, y, pw = 1) => K.rover?.impact?.(x, y, pw) || worldHit(x, y, pw);
  // sample the bolt's path so it cannot skip over a line of text in one frame
  K.boltHooks.push((b, ox, oy) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - ox, b.y - oy) / 9));
    for (let i = 1; i <= n; i++) {
      const x = ox + (b.x - ox) * i / n, y = oy + (b.y - oy) * i / n;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
      if (worldHit(x, y, b.power || 1)) return true;
    }
    return false;
  });

  // no ship on touch screens: a tap on anything that is not a control fires at that spot
  if (!K.ship.on) addEventListener('click', (e) => {
    if (e.target.closest('a, button, input, textarea, select, label, summary, [role="button"], .license, video, dialog, .obs')) return;
    const x = e.clientX, y = e.clientY, b = { x, y, vx: 0, vy: -1300, power: 1 };
    burst(x, y, 6, 'r', 160, 0.25);
    for (const h of hits) { const r = h.rect(); if (r && x > r.left && x < r.right && y > r.top && y < r.bottom) { h.onHit(b); return; } }
    K.impact(x, y);
  });

  K.layers.push({
    step(dt, now) { stepBits(dt); restoreText(now); restoreBodies(now); },
    draw: drawBits,
    over: drawFlash,
  });
})();
