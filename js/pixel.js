// Pixel art layer: the starfighter cursor, C1-CD, and the observatory strip with its rover.
// Every sprite is modelled as a volume (sphere, cylinder, box) and shaded with a light from the top left,
// so the droid's dome really turns and the wheels, dishes and telescope really move.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const sfx = () => window.sfx || { tone() {}, chirp() {} };
  const daysSince = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  const dias = (d) => `${d} ${d === 1 ? 'dia' : 'dias'}`;

  // ---------- palette from the page's tokens ----------
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgb = (v) => { probe.clearRect(0, 0, 1, 1); probe.fillStyle = '#888'; probe.fillStyle = v; probe.fillRect(0, 0, 1, 1); return [...probe.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const tok = (n) => rgb(getComputedStyle(document.documentElement).getPropertyValue(n).trim());
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const dim = (a, t) => a.map((v) => v * t);
  const B0 = { K: tok('--color-paper'), x: tok('--color-steel-x'), w: tok('--color-cream'), W: tok('--color-ink'), l: tok('--color-steel-l'), m: tok('--color-steel-m'), d: tok('--color-steel-d'), o: tok('--color-accent'), p: tok('--color-accent-2'), b: tok('--color-blue'), r: tok('--color-red'), y: tok('--color-glow'), g: tok('--color-laser'), h: tok('--color-holo'), q: tok('--color-teal') };
  const C = { ...B0 };
  C.k = mix(B0.x, B0.K, 0.6); C.O = dim(mix(B0.o, B0.r, 0.4), 0.78); C.c = mix(B0.b, B0.W, 0.6); C.B = dim(B0.b, 0.55); C.R = dim(B0.r, 0.6);
  C.s = dim(mix(B0.w, B0.o, 0.25), 0.36); C.S = dim(C.s, 0.62); C.v = dim(mix(B0.w, B0.o, 0.25), 0.55); C.V = dim(C.s, 0.4);
  C.n = dim(mix(B0.x, B0.b, 0.25), 0.9); C.N = dim(C.n, 0.7);
  C.j = dim(mix(B0.w, B0.o, 0.4), 0.78); C.J = dim(C.j, 0.66); C.z = tok('--color-rust'); C.Z = dim(C.z, 0.62); C.A = mix(C.z, B0.w, 0.3);
  const P = Object.fromEntries(Object.entries(C).map(([k, [r, g, b]]) => [k, `rgb(${r | 0},${g | 0},${b | 0})`]));

  // ---------- a tiny sprite toolkit ----------
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dither = (x, y, t) => t * 16 > BAYER[y & 3][x & 3] + 0.5;
  const ramp = (I, x, y, tones) => { const f = clamp(I, 0, 0.999) * (tones.length - 1), i = Math.floor(f), fr = f - i; if (fr < 0.4) return tones[i]; if (fr > 0.6) return tones[i + 1]; return dither(x, y, (fr - 0.4) / 0.2) ? tones[i + 1] : tones[i]; };
  const LIGHT = [-0.5, -0.62, 0.6];
  const lambert = (nx, ny, nz) => clamp(LIGHT[0] * nx + LIGHT[1] * ny + LIGHT[2] * nz, 0, 1) * 0.82 + 0.12;
  class Px {
    constructor(w, h) { this.w = w; this.h = h; this.a = new Array(w * h).fill(0); }
    set(x, y, c) { x |= 0; y |= 0; if (c && x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = c; }
    clear(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[(y | 0) * this.w + (x | 0)] = 0; }
    outline(c = 'k') {
      const b = this.a.slice();
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (b[y * this.w + x]) continue;
        const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && b[yy * this.w + xx];
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.a[y * this.w + x] = c;
      }
      return this;
    }
    paint(g, ox = 0, oy = 0) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = this.a[y * this.w + x]; if (c) { g.fillStyle = P[c]; g.fillRect(ox + x, oy + y, 1, 1); } } }
    canvas(c) { c ||= document.createElement('canvas'); c.width = this.w; c.height = this.h; const g = c.getContext('2d'); g.clearRect(0, 0, this.w, this.h); this.paint(g); return c; }
  }
  function sphere(p, cx, cy, r, tones, opt = {}) {
    const ry = opt.ry || r;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / ry, q = nx * nx + ny * ny;
      if (q > 1 || (opt.maxY != null && y > opt.maxY)) continue;
      const nz = Math.sqrt(1 - q), I = lambert(nx, ny, nz);
      p.set(x, y, opt.detail?.(x, y, nx, ny, nz, I) || (opt.spec && I > 0.9 ? opt.spec : ramp(I, x, y, tones)));
    }
  }
  function cyl(p, x0, y0, w, h, tones, detail) {
    const c = x0 + w / 2, r = w / 2;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const nx = (x + 0.5 - c) / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx)), I = lambert(nx, 0, nz);
      p.set(x, y, detail?.(x, y, nx, I) || ramp(I, x, y, tones));
    }
  }
  function box(p, x0, y0, w, h, tones) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      let t = tones.length - 2;
      if (y === y0) t = tones.length - 1; else if (y === y0 + h - 1 || x === x0 + w - 1) t = 0; else if (x === x0) t = tones.length - 1;
      p.set(x, y, tones[clamp(t, 0, tones.length - 1)]);
    }
  }
  function line(p, x0, y0, x1, y1, c, th = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) p.set(Math.round(x) + a, Math.round(y) + b, c); }
  }
  const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };

  // ======================================================================
  // C1-CD, an astromech droid (30 x 38 art pixels)
  // ======================================================================
  const MOOD_LENS = { ok: ['B', 'b', 'c'], happy: ['b', 'c', 'W'], curious: ['B', 'b', 'c'], scared: ['B', 'c', 'W'], sulky: ['R', 'r', 'o'], tired: ['B', 'B', 'b'], sleep: ['k', 'x', 'x'] };
  function droidPx(o = {}) {
    const p = new Px(30, 38), sit = o.sit ? 2 : 0, look = o.look || 0;
    const lift = [o.step === 1 ? 1 : 0, o.step === 2 ? 1 : 0];
    [[2, 0], [24, 1]].forEach(([lx, i]) => {
      cyl(p, lx, 16 + sit, 3, 15 - sit, ['d', 'm', 'l']);
      const fy = 30 - lift[i];
      box(p, lx - 1, fy, 6, 4, ['k', 'd', 'm', 'l']); for (let x = lx - 1; x < lx + 5; x += 2) p.set(x, fy + 3, 'x');
      sphere(p, lx + 1.5, 16 + sit, 2.8, ['d', 'm', 'l', 'w']); p.set(lx + 1, 16 + sit, 'o');
    });
    if (!o.sit) { box(p, 12, 30, 6, 3, ['k', 'd', 'm', 'l']); p.set(13, 29, 'd'); p.set(16, 29, 'd'); }
    const by0 = 15 + sit, by1 = 30;
    cyl(p, 6, by0, 18, by1 - by0, ['d', 'm', 'l', 'w', 'W'], (x, y, nx, I) => {
      const ry = y - by0;
      if (ry === 7) return 'm';
      if (y >= by1 - 2) return ramp(I * 0.7, x, y, ['d', 'm', 'l']);
      if (x >= 9 && x <= 13 && ry >= 2 && ry <= 5) return ramp(I + (ry === 2 ? 0.2 : 0), x, y, ['O', 'o', 'p']);
      if (x >= 16 && x <= 20 && (ry === 2 || ry === 4)) return 'd';
      if (x >= 16 && x <= 20 && ry >= 9 && ry <= 11) return ry === 9 && x === 16 ? 'c' : ramp(I, x, y, ['B', 'b', 'c']);
      if (ry === 9 && (x === 9 || x === 11 || x === 13)) return (x - 9) / 2 < (o.lit ?? 3) ? 'y' : 'd';
      if (ry === 12 && x >= 9 && x <= 13) return 'd';
      return null;
    });
    for (let y = 13 + sit; y <= 14 + sit; y++) for (let x = 5; x <= 24; x++) { const nx = (x + 0.5 - 15) / 10; p.set(x, y, ramp(lambert(nx, 0, Math.sqrt(1 - nx * nx)) - (y === 14 + sit ? 0.25 : 0), x, y, ['O', 'o', 'p'])); }
    const cx = 15, cy = 13 + sit, r = 10.6, lens = MOOD_LENS[o.mood] || MOOD_LENS.ok, eyeLat = Math.asin(4.6 / r);
    sphere(p, cx, cy, r, ['d', 'm', 'l', 'w'], {
      maxY: cy, spec: 'W',
      detail: (x, y, nx, ny, nz, I) => {
        const cosLat = Math.sqrt(Math.max(0.001, 1 - ny * ny)), lat = Math.asin(-ny), lon = wrapA(Math.asin(clamp(nx / cosLat, -1, 1)) - look);
        if (y >= cy - 1) return ramp(I * 0.8, x, y, ['d', 'm', 'l']);
        const dl = wrapA(lon) * cosLat * r, dt = (lat - eyeLat) * r, dist = Math.hypot(dl, dt);
        if (Math.cos(lon) > 0.15) {
          if (dist < 2.8) { if (o.blink || o.mood === 'sleep') return dt > 0 ? 'x' : 'k'; return dl < -0.7 && dt > 0.7 ? 'W' : ramp(1 - dist / 3, x, y, lens); }
          if (dist < 3.8) return 'k';
          if (dist < 4.4 && dt > 0) return 'm';
        }
        const hl = wrapA(lon - 0.62) * cosLat * r, ht = (lat - Math.asin(7.4 / r)) * r;
        if (Math.cos(lon - 0.62) > 0 && Math.abs(hl) < 1.3 && Math.abs(ht) < 1) return Math.abs(hl) < 0.5 ? (o.holo ? 'c' : 'r') : 'd';
        if (lon > -1.05 && lon < -0.55 && lat > 0.48 && lat < 0.78) return ramp(I, x, y, ['O', 'o', 'p']);
        if (lon > 0.35 && lon < 0.8 && lat > 0.2 && lat < 0.4) return ramp(I, x, y, ['B', 'b', 'c']);
        if (Math.abs(wrapA(lon - Math.PI)) < 0.55 && lat > 0.2 && lat < 0.62) return (Math.round(lat * r) & 1) ? 'd' : ramp(I, x, y, ['m', 'l']);
        if (lat > 1.12 && Math.abs(wrapA(lon)) < 1.3) return ramp(I, x, y, ['O', 'o', 'p']);
        const seg = ((lon + Math.PI * 8) % (Math.PI / 4)); if ((seg < 0.07 || seg > Math.PI / 4 - 0.07) && lat < 1.0) return 'm';
        return null;
      },
    });
    p.outline('k');
    if (o.hurt) p.a = p.a.map((c) => (c && c !== 'k' ? 'W' : c));
    return p;
  }

  // ======================================================================
  // The rover (66 x 56), facing right, in three-quarter view: a Perseverance-style body with WALL-E eyes
  // ======================================================================
  const ROVER_LENS = { ok: ['B', 'b', 'c'], happy: ['b', 'c', 'W'], scan: ['b', 'c', 'W'], sulky: ['R', 'r', 'o'], scared: ['B', 'c', 'W'] };
  // a box seen from the front and a little from above-right: front face, top face, right side face
  function box3(p, x, y, w, h, d, front, top, side) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) p.set(x + i, y + j, ramp(0.75 - j / h * 0.45 + (i === 0 ? 0.15 : 0), x + i, y + j, front));
    for (let k = 1; k <= d; k++) for (let i = 0; i < w; i++) p.set(x + i + k, y - k, ramp(0.85 - k / d * 0.2, x + i + k, y - k, top));
    for (let k = 1; k <= d; k++) for (let j = 0; j < h; j++) p.set(x + w - 1 + k, y + j - k, ramp(0.55 - j / h * 0.3, x + w - 1 + k, y + j - k, side));
  }
  function wheel34(p, cx, cy, rx, ry, ang, far) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, q = nx * nx + ny * ny; if (q > 1) continue;
      if (q > 0.62) { p.set(x, y, (Math.round((Math.asin(clamp(ny, -1, 1)) + ang) * 4) & 1) ? 'x' : 'k'); continue; }
      const a = Math.atan2(ny, nx) - ang, spoke = Math.abs(Math.sin(a * 3)) < 0.28;
      p.set(x, y, far ? (spoke ? 'd' : 'x') : spoke ? 'l' : ramp(lambert(nx * 0.6, ny * 0.6, 0.7), x, y, ['d', 'm', 'l']));
    }
    if (!far) { p.set(cx, cy, 'o'); p.set(cx - 1, cy, 'O'); }
  }
  function roverPx(o = {}) {
    const p = new Px(68, 56), lens = ROVER_LENS[o.mood] || ROVER_LENS.ok, wa = o.wheel || 0;
    // far wheels and far suspension, in shadow
    for (const wx of [15, 31, 47]) wheel34(p, wx + 6, 41, 4, 5.5, wa, true);
    line(p, 34, 32, 53, 40, 'x', 2); line(p, 34, 32, 26, 36, 'x', 2); line(p, 26, 36, 21, 40, 'x', 2); line(p, 26, 36, 37, 40, 'x', 2);
    // the nuclear generator at the back, finned
    for (let i = 0; i < 8; i++) { const x = 2 + i; for (let y = 17 + (i >> 2); y < 29 - (i >> 2); y++) p.set(x, y, (i & 1) ? 'd' : ramp(0.6 - (y - 17) / 14, x, y, ['x', 'd', 'm'])); }
    p.set(1, 22, o.glow ? 'y' : 'o'); p.set(1, 23, 'O');
    // chassis
    box3(p, 9, 27, 40, 10, 7, ['m', 'l', 'w'], ['l', 'w', 'W'], ['d', 'm', 'l']);
    for (let i = 10; i < 48; i++) { p.set(i, 31, ramp(0.6, i, 31, ['O', 'o', 'p'])); p.set(i, 32, 'O'); }
    for (let i = 13; i < 22; i += 2) p.set(i, 34, 'm');
    for (let j = 33; j < 36; j++) for (let i = 36; i < 42; i++) p.set(i, j, j === 33 ? 'c' : 'b');
    // deck: gold foil, sample tubes, a turning high-gain antenna, the UHF mast
    for (let k = 2; k < 6; k++) for (let i = 14; i < 26; i++) p.set(i + k, 27 - k, dither(i, k, 0.5) ? 'y' : 'p');
    for (let i = 0; i < 4; i++) { p.set(29 + i * 2 + 3, 23, 'l'); p.set(29 + i * 2 + 3, 22, 'w'); p.set(29 + i * 2 + 3, 24, 'm'); }
    const dw = Math.abs(Math.cos(o.dish || 0)) * 3 + 1;
    for (let y = -2; y <= 2; y++) for (let x = -4; x <= 4; x++) if ((x * x) / (dw * dw) + (y * y) / 4 <= 1) p.set(18 + x, 16 + y, y < 0 ? 'W' : y < 1 ? 'w' : 'l');
    line(p, 18, 18, 18, 22, 'm'); line(p, 12, 13, 12, 22, 'm'); p.set(12, 12, o.blink ? 'r' : 'R');
    // mast and the head: WALL-E binocular eyes, the SuperCam lens on top
    line(p, 44, 9, 44, 22, 'm', 2); sphere(p, 45, 21, 1.8, ['d', 'm', 'l']);
    const hy = 4 + (o.tilt || 0);
    box3(p, 36, hy, 17, 7, 3, ['m', 'l', 'w'], ['l', 'w', 'W'], ['d', 'm', 'l']);
    sphere(p, 46, hy - 2, 2, ['B', 'b', 'c', 'W']);
    const lx = clamp(o.lookX || 0, -1, 1) * 1.1, ly = clamp(o.lookY || 0, -1, 1) * 0.9;
    for (const ex of [40, 49]) {
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
        const d = Math.hypot(x, y); if (d > 4.2) continue;
        const X = ex + x, Y = hy + 4 + y;
        if (d > 3.3) { p.set(X, Y, ramp(lambert(x / 4, y / 4, 0.4), X, Y, ['x', 'd', 'm', 'l'])); continue; }
        const lid = o.lid || 0, brow = (o.mood === 'sulky' ? (ex === 40 ? 1 : -1) : o.mood === 'happy' ? (ex === 40 ? -1 : 1) * 0.6 : 0) * (x / 4);
        if (lid && y < -3 + lid * 2.2 + brow * 2) { p.set(X, Y, 'm'); continue; }
        const pd = Math.hypot(x - lx, y - ly);
        p.set(X, Y, o.blink2 ? (y > 0 ? 'k' : 'm') : pd < 1.2 ? lens[pd < 0.6 ? 2 : 1] : (x < -1.2 && y < -1.2) ? 'W' : 'K');
      }
    }
    // the arm: stowed at the front, or raised (waving, or for a selfie)
    const a = o.arm || 0, sx = 53, sy = 33, ex2 = sx + 6 - a * 3, ey2 = sy - a * 11, tx = ex2 + 5 - a, ty = ey2 + 2 - a * 9 + Math.sin(o.t || 0) * a * 2 * (o.selfie ? 0 : 1);
    line(p, sx, sy, ex2, ey2, 'm', 2); sphere(p, ex2 + 0.5, ey2 + 0.5, 1.4, ['d', 'm', 'l']); line(p, ex2, ey2, tx, ty, 'm', 2);
    box3(p, tx - 1, ty, 4, 3, 2, ['d', 'm', 'l'], ['m', 'l', 'w'], ['x', 'd', 'm']); p.set(tx + 3, ty + 1, o.flash ? 'W' : 'B');
    // near suspension and wheels
    line(p, 30, 37, 47, 43, 'd', 2); line(p, 30, 37, 22, 40, 'd', 2); line(p, 22, 40, 15, 44, 'd', 2); line(p, 22, 40, 31, 44, 'd', 2);
    sphere(p, 31, 38, 1.8, ['d', 'm', 'l']); sphere(p, 23, 41, 1.6, ['d', 'm', 'l']);
    for (const wx of [15, 31, 47]) wheel34(p, wx, 47, 4.6, 6.2, wa, false);
    p.set(49, 30, o.light ? 'y' : 'p'); p.set(49, 29, o.light ? 'y' : 'p');
    p.outline('k');
    if (o.hurt) p.a = p.a.map((c) => (c && c !== 'k' ? 'W' : c));
    return p;
  }

  // ======================================================================
  // The Empire and the locals: homages in pixel art
  // ======================================================================
  function tiePx(o = {}) { // an imperial fighter, front view
    const p = new Px(23, 19);
    for (const x0 of [0, 20]) for (let y = 0; y < 19; y++) for (let x = x0; x < x0 + 3; x++) p.set(x, y, x === x0 + 1 ? 'd' : (y % 6 === 0 ? 'd' : 'x'));
    line(p, 3, 9, 7, 9, 'm', 1); line(p, 15, 9, 19, 9, 'm', 1); line(p, 3, 8, 6, 8, 'd'); line(p, 16, 8, 19, 8, 'd');
    sphere(p, 11, 9, 4.6, ['d', 'm', 'l', 'w'], { detail: (x, y, nx, ny) => { const d = Math.hypot(nx, ny); if (d < 0.5) return Math.abs(nx) < 0.08 || Math.abs(ny) < 0.08 || Math.abs(Math.abs(nx) - Math.abs(ny)) < 0.08 ? 'm' : 'K'; return null; } });
    if (o.fire) { p.set(9, 13, 'g'); p.set(13, 13, 'g'); }
    p.outline('k');
    return p;
  }
  function destroyerPx() { // an imperial wedge, side view, pointing left
    const p = new Px(64, 24);
    for (let x = 0; x < 58; x++) { const top = Math.round(16 - x * 0.2), bot = Math.round(17 + x * 0.06); for (let y = top; y <= bot; y++) p.set(x, y, y === top ? 'W' : y === top + 1 ? 'w' : y > bot - 2 ? 'd' : ((x % 9 === 0) ? 'm' : 'l')); }
    box3(p, 44, 5, 10, 4, 2, ['m', 'l', 'w'], ['l', 'w', 'W'], ['d', 'm', 'l']); box3(p, 47, 2, 4, 3, 1, ['m', 'l', 'w'], ['l', 'w', 'W'], ['d', 'm', 'l']);
    p.set(46, 1, 'l'); p.set(52, 1, 'l');
    for (let y = 17; y < 21; y++) p.set(59, y, 'c'); for (let y = 16; y < 21; y++) p.set(60, y, 'b');
    p.outline('k');
    return p;
  }
  function jawaPx(o = {}) {
    const p = new Px(11, 15), st = o.step ? 1 : 0;
    sphere(p, 5.5, 4.5, 4, ['J', 'j', 'w']);
    for (let y = 3; y < 7; y++) for (let x = 3; x < 8; x++) p.set(x, y, 'K');
    if (!o.blink) { p.set(4, 4, 'y'); p.set(4, 5, 'y'); p.set(6, 4, 'y'); p.set(6, 5, 'y'); }
    for (let y = 7; y < 14; y++) { const hw = 2.4 + (y - 7) * 0.4; for (let x = Math.round(5.5 - hw); x <= Math.round(5.5 + hw); x++) p.set(x, y, ramp(lambert((x - 5.5) / hw, 0, 0.7), x, y, ['J', 'j', 'w'])); }
    line(p, 3, 8, 8, 11, 'J'); p.set(1 + st, 10, 'J'); p.set(9 - st, 10, 'J');
    p.set(3 + st, 14, 'k'); p.set(7 - st, 14, 'k');
    p.outline('v');
    return p;
  }
  function crawlerPx() {
    const p = new Px(60, 44);
    for (let y = 2; y < 32; y++) { const l = Math.round(6 + (32 - y) * 0.12), r = Math.round(40 + (y - 2) * 0.55); for (let x = l; x <= r; x++) p.set(x, y, y < 4 ? 'A' : ramp(0.8 - (y - 2) / 36 + (x === l ? 0.15 : 0) - (x > r - 3 ? 0.25 : 0), x, y, ['Z', 'z', 'A'])); }
    for (let x = 12; x < 34; x += 4) { p.set(x, 9, 'y'); p.set(x + 1, 9, 'y'); }
    for (let x = 10; x < 52; x += 8) line(p, x, 13, x, 31, 'Z');
    box3(p, 14, 2, 14, 3, 2, ['Z', 'z', 'A'], ['z', 'A', 'w'], ['Z', 'Z', 'z']);
    for (let y = 32; y < 43; y++) for (let x = 3; x < 57; x++) p.set(x, y, y === 32 || y === 42 ? 'd' : (x + (y >> 1)) % 5 === 0 ? 'm' : 'x');
    p.outline('k');
    return p;
  }
  const tieC = [tiePx().canvas(), tiePx({ fire: true }).canvas()], destroyerC = (() => { const c = destroyerPx().canvas(), [f, fg] = make(c.width, c.height); fg.translate(c.width, 0); fg.scale(-1, 1); fg.drawImage(c, 0, 0); return f; })();

  // ======================================================================
  // The starfighter (38 x 40), pointing up. X-wing style, with C1-CD's dome behind the canopy.
  // ======================================================================
  function fighterPx(o = {}) {
    const p = new Px(38, 40), cx = 19, sp = o.open ? 1 : 0;
    const wing = (dy, tones, dark) => {
      for (let x = 2; x < 36; x++) {
        if (Math.abs(x + 0.5 - cx) < 3) continue;
        const t = Math.abs(x + 0.5 - cx) / 16.5, lead = Math.round(25 + t * 2) + dy, trail = Math.round(32 - t * 2) + dy;
        for (let y = lead; y <= trail; y++) {
          const tip = Math.abs(x + 0.5 - cx) > 13.5;
          p.set(x, y, dark ? 'd' : y === lead ? 'w' : y === trail ? 'm' : tip && (x === 5 || x === 32 || x === 6 || x === 31) ? 'O' : tones);
        }
      }
    };
    if (o.open) wing(2, 'd', true);
    wing(0, 'l', false);
    // engines, two per side, with the glow at the back
    for (const ex of [cx - 7, cx + 4]) {
      cyl(p, ex - sp, 21, 4, 13, ['d', 'm', 'l', 'w']);
      p.set(ex + 1 - sp, 21, 'k'); p.set(ex + 2 - sp, 21, 'k');
      for (let x = ex - sp; x < ex + 4 - sp; x++) { p.set(x, 34, o.eng ? 'o' : 'y'); p.set(x, 35, (x + (o.eng ? 1 : 0)) & 1 ? 'y' : 'O'); }
      p.set(ex + 1 - sp, 34, 'W'); p.set(ex + 2 - sp, 34, o.boost ? 'W' : 'y');
    }
    // the long fuselage and nose
    for (let y = 1; y < 34; y++) {
      const hw = y < 4 ? 1 : y < 10 ? 1.6 : y < 19 ? 2.3 : 3.2;
      for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
        const nx = (x + 0.5 - cx) / hw;
        p.set(x, y, (y === 8 || y === 10) ? ramp(lambert(nx, 0, 0.8), x, y, ['O', 'o', 'p']) : ramp(lambert(nx, -0.2, Math.sqrt(Math.max(0, 1 - nx * nx))), x, y, ['d', 'm', 'l', 'w']));
      }
    }
    // canopy and the astromech dome behind it
    sphere(p, cx, 17, 1.7, ['B', 'b', 'c', 'W'], { ry: 3 });
    sphere(p, cx, 23.5, 2.1, ['m', 'l', 'w', 'W']); p.set(cx - 1, 22, 'o'); p.set(cx, 23, 'b');
    // wingtip cannons
    for (const gx of [2, 34]) { for (let y = 9; y < 31; y++) { p.set(gx + (gx > cx ? sp : -sp), y, 'm'); p.set(gx + 1 + (gx > cx ? sp : -sp), y, y < 12 ? 'd' : 'l'); } p.set(gx + (gx > cx ? sp : -sp), 8, o.lock ? 'r' : 'd'); p.set(gx + 1 + (gx > cx ? sp : -sp), 8, o.lock ? 'r' : 'd'); }
    p.outline('k');
    return p;
  }
  const shipCache = new Map();
  function shipFrame(eng, open, lock, boost, dir) {
    const key = `${eng}${open}${lock}${boost}:${dir}`;
    if (shipCache.has(key)) return shipCache.get(key);
    const base = fighterPx({ eng, open, lock, boost }).canvas();
    const [c, g] = make(56, 56);
    g.translate(28, 28); g.rotate(dir * Math.PI / 16); g.drawImage(base, -19, -21);
    const im = g.getImageData(0, 0, 56, 56), a = im.data; for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 110 ? 255 : 0;
    g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(im, 0, 0);
    if (shipCache.size > 600) shipCache.clear();
    shipCache.set(key, c); return c;
  }
  const EMOTE = {
    '!': ['..y..', '..y..', '..y..', '.....', '..y..'],
    '?': ['.ccc.', 'c...c', '...c.', '.....', '..c..'],
    '♥': ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'],
    '♪': ['..ww', '..w.', '..w.', 'ww..', 'ww..'],
    '#': ['r.r..', 'rrrr.', '.r.r.', 'rrrr.', '.r.r.'],
    '…': ['.....', '.....', '.....', '.....', 'w.w.w'],
  };
  const emoteCanvas = Object.fromEntries(Object.entries(EMOTE).map(([k, rows]) => { const p = new Px(7, 7); rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && p.set(x + 1, y + 1, ch))); p.outline('k'); return [k, p.canvas()]; }));

  // ======================================================================
  // Pixel planets: the NASA photos, reduced and dithered
  // ======================================================================
  function pixelate(img, w) {
    const go = () => {
      const h = Math.round(w * img.naturalHeight / img.naturalWidth), [c, g] = make(w, h);
      g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, w, h);
      const im = g.getImageData(0, 0, w, h), a = im.data, lv = 14;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, t = (BAYER[y & 3][x & 3] / 16 - 0.5) / lv * 0.7;
        for (let k = 0; k < 3; k++) a[i + k] = clamp(Math.round((a[i + k] / 255 + t) * (lv - 1)) / (lv - 1) * 255, 0, 255);
        a[i + 3] = a[i + 3] > 120 ? 255 : 0;
      }
      g.putImageData(im, 0, 0); img.src = c.toDataURL(); img.classList.add('pixelated');
    };
    const safe = () => { try { go(); } catch { /* a file:// page taints the canvas; keep the photo */ } };
    if (img.complete && img.naturalWidth) safe(); else img.addEventListener('load', safe, { once: true });
  }
  document.querySelectorAll('.planet, .moon, .route img:not([src*="avatar"])').forEach((img) => pixelate(img, img.closest('.route') ? (img.classList.contains('saturn') ? 40 : 24) : img.classList.contains('saturn') ? 130 : 80));

  // ======================================================================
  // The arena: one fixed canvas over the page
  // ======================================================================
  const arena = document.createElement('canvas'); arena.className = 'arena'; arena.setAttribute('aria-hidden', 'true'); document.body.append(arena);
  const ag = arena.getContext('2d');
  let dpr = 1;
  const sizeArena = () => { dpr = Math.min(devicePixelRatio || 1, 2); arena.width = innerWidth * dpr; arena.height = innerHeight * dpr; ag.imageSmoothingEnabled = false; };
  sizeArena(); addEventListener('resize', sizeArena);
  function blit(img, x, y, s, alpha = 1) {
    ag.save(); ag.imageSmoothingEnabled = false; ag.globalAlpha = alpha;
    ag.drawImage(img, Math.round(x) * dpr, Math.round(y) * dpr, img.width * s * dpr, img.height * s * dpr);
    ag.restore();
  }
  const sq = (x, y, s, col, a = 1) => { ag.globalAlpha = a; ag.fillStyle = P[col] || col; ag.fillRect(Math.round(x) * dpr, Math.round(y) * dpr, s * dpr, s * dpr); ag.globalAlpha = 1; };
  const pointer = { x: -200, y: -200, at: 0, inside: false };
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now(); pointer.inside = true; }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.inside = false; });
  const hits = [];
  const fx = [];
  const burst = (x, y, n, col, sp = 260, life = 0.5) => { for (let i = 0; i < n; i++) fx.push({ x, y, vx: (Math.random() - 0.5) * sp, vy: (Math.random() - 0.8) * sp, g: 900, life: life * (0.6 + Math.random() * 0.6), col, s: 2 }); };
  // speech: a hologram projected toward its speaker; the cone points at `toX`
  function holo(el, text, ms, toX) {
    clearTimeout(el._t); el.textContent = text;
    if (toX != null) el.style.setProperty('--cone-x', `${toX}px`);
    if (ms) el._t = setTimeout(() => { el.textContent = ''; }, ms);
  }

  // ======================================================================
  // C1-CD: walks and lands on the page's own elements
  // ======================================================================
  const droid = (() => {
    const hit = document.getElementById('droid-hit'), bubble = document.getElementById('droid-say');
    if (!hit) return null;
    const S = 2, W = 30 * S, H = 38 * S;
    hit.style.width = `${W}px`; hit.style.height = `${H}px`;
    const KEY = 'c1cd-v1', now0 = Date.now();
    let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch {}
    const first = !s;
    s ||= { energy: 85, joy: 70, born: now0, last: now0, visits: 0 };
    const away = (now0 - s.last) / 3.6e6;
    s.energy = clamp(s.energy - away * 3, 5, 100); s.joy = clamp(s.joy - away * 2, 5, 100); s.visits += 1;
    const save = () => { s.last = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
    const night = () => +new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()) < 6;
    const st = {
      x: innerWidth - W - (innerWidth >= 1200 ? 80 : 8), y: innerHeight, vx: 0, vy: 0, face: -1, on: 'floor', onEl: null,
      mode: 'idle', goal: null, look: 0, lookT: 0, blinkUntil: 0, blinkAt: 0, stepT: 0, hurtT: 0, sleep: night(), nextThink: performance.now() + 4000,
      deployT: 0, holoT: 0, lastTalk: 0, dragging: false, cool: {}, emote: null, emoteT: 0, mood: 'ok', moodT: 0, spinT: 0, shake: 0, hop: 0,
    };
    const spr = document.createElement('canvas');
    const say = (text, ms = 4200) => { holo(bubble, text, ms); st.lastTalk = performance.now(); };
    // on the floor of the hero, stay to the right of its copy and actions
    const heroCopy = [...document.querySelectorAll('.hero-foot .lead, .hero-foot .actions, .hero-foot .pulse')];
    const floorMinX = () => { const hr = document.querySelector('.hero')?.getBoundingClientRect(); if (!hr || hr.bottom < innerHeight - 10) return 0; return Math.max(0, ...heroCopy.map((e) => e.getBoundingClientRect().right)) + 150; };
    const emote = (e, t = 1.6) => { st.emote = e; st.emoteT = t; };
    const feel = (m, t = 2.5) => { st.mood = m; st.moodT = t; };
    const once = (k, ms) => { const n = performance.now(); if ((st.cool[k] || 0) > n) return false; st.cool[k] = n + ms; return true; };

    const PLAT = '.sec-head h2, .feature-media, .feature-type, .feature-text h3, .feature-links .button, .repo, .more-h, .work h2, .work-list li, .license, .about-text h2, .statement, .tools-text h2, .const-btn, .contact h2, .mail, .contact-foot, .wordmark';
    let platEls = [];
    const refreshPlats = () => { platEls = [...document.querySelectorAll(PLAT)]; };
    refreshPlats(); document.addEventListener('projects', () => setTimeout(refreshPlats, 50));
    const obs = document.getElementById('observatorio');
    const platOf = (el) => { const r = el.getBoundingClientRect(); return { el, top: el === obs ? r.top + rover.groundY() : r.top, left: r.left, right: r.right }; };
    function platforms() {
      const out = [];
      for (const el of platEls) { const r = el.getBoundingClientRect(); if (r.width < 50 || r.top < 80 || r.top > innerHeight - 20 || r.right < 0 || r.left > innerWidth) continue; out.push({ el, top: r.top, left: r.left, right: r.right }); }
      if (obs && rover.groundY) { const p = platOf(obs); if (p.top > 80 && p.top < innerHeight - 20) out.push(p); }
      return out;
    }

    function landedOn(el) {
      if (el !== obs) { el.classList.remove('bonk'); void el.offsetWidth; el.classList.add('bonk'); setTimeout(() => el.classList.remove('bonk'), 400); }
      sfx().tone(170, 0.08, 'square', 0.03); burst(st.x + W / 2, st.y, 6, el === obs ? 'v' : 'l', 140, 0.3);
      if (el.matches?.('.const-btn')) { el.click(); emote('!'); say(`${el.textContent}! Acendi a constelação.`); }
      else if (el.matches?.('.license')) { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); emote('…'); if (once('lic', 15000)) say('Virei a licença do Luan. Ops.'); }
      else if (el.closest?.('[data-scan]')) deploy(el.closest('[data-scan]'));
      else if (el.matches?.('.work-list li')) { emote('♪'); if (once('w' + el.textContent.length, 20000)) say(`Registro de missão: ${el.querySelector('h3').textContent}, ${el.querySelector('.when')?.textContent || ''}.`); }
      else if (el === obs) { emote('!'); if (once('obs', 30000)) say('O observatório! O telescópio tá seguindo a sua nave.'); }
      else if (el.matches?.('.mail')) { if (once('mail', 30000)) say('Daqui sai transmissão direto pro Luan.'); }
    }
    function deploy(el) {
      const name = el.querySelector?.('.repo-id, h3 a, h3')?.textContent?.trim();
      const r = (window.ghData?.shown || []).find((p) => name && (p.name === name || el.textContent.includes(p.name)));
      st.deployT = 1.3; sfx().chirp(3); emote('…', 1.2); st.holoEl = el;
      setTimeout(() => {
        st.holoT = 4.5; feel('happy', 3); emote('♥'); st.spinT = 1; sfx().tone(880, 0.3, 'sine', 0.03, 1320);
        say(r ? `${r.name}: ${r.language || 'código'}, último push há ${dias(daysSince(r.pushed_at))}. Pipeline verde.` : 'Pipeline verde. Deploy feito!', 4500);
        s.joy = clamp(s.joy + 8, 0, 100); save();
      }, 1300);
    }

    const G = 2200;
    function jumpTo(p, tx) {
      const dy = st.y - p.top;
      if (dy > 380) { if (once('high', 8000)) { emote('?'); say('Alto demais pra mim...'); } return false; }
      const h = Math.max(40, dy + 44), vy = -Math.sqrt(2 * G * h), T = -vy / G + Math.sqrt(2 * (h - dy) / G);
      st.vy = vy; st.vx = (tx - st.x) / T; st.on = null; st.onEl = null; st.mode = 'air'; st.face = Math.sign(st.vx) || st.face;
      sfx().tone(300, 0.12, 'square', 0.025, 620);
      return true;
    }
    function goTo(el) {
      if (st.sleep || st.dragging) return;
      const p = platOf(el), tx = clamp(p.left + (p.right - p.left) / 2 - W / 2 + (Math.random() - 0.5) * 40, p.left - W / 3, p.right - W * 0.66);
      st.goal = { el, tx };
    }
    function play() {
      if (st.sleep) { st.sleep = false; feel('sulky', 2); emote('#'); say('Hã? Bip... tô acordado, tô acordado!'); sfx().chirp(2); return; }
      if (st.mood === 'sulky') { emote('#'); say(pick(['Hmpf.', 'Ainda tô bravo com aquele tiro.', 'Me deixa, bip.']), 2000); return; }
      if (s.energy < 8) { emote('…'); say('Bateria no fim. Passa a nave em cima de mim pra recarregar.'); return; }
      s.energy -= 4; s.joy = clamp(s.joy + 14, 0, 100); feel('happy', 2.5); emote(pick(['♥', '♪', '!']));
      if (st.on) { st.vy = -640; st.on = null; st.onEl = null; st.mode = 'air'; st.vx = 0; st.spinT = 1; }
      sfx().chirp(5); say(pick(['Bip-bup!', 'Integrado e entregue!', 'Pula pipeline, pula!', 'Mais uma vez!', 'Zero downtime nesse pulo.']), 2600);
      save();
    }
    function hurt(fromX) {
      st.hurtT = 0.3; st.vx = Math.sign(st.x + W / 2 - fromX || 1) * 220; st.vy = -340; st.on = null; st.onEl = null; st.mode = 'air';
      s.joy = clamp(s.joy - 5, 0, 100); feel('sulky', 4); emote('#', 2.4);
    }

    let drag = null;
    hit.addEventListener('pointerdown', (e) => { drag = { sx: e.clientX, sy: e.clientY, ox: e.clientX - st.x, oy: e.clientY - st.y, moved: false, hist: [] }; hit.setPointerCapture(e.pointerId); });
    hit.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; st.dragging = true; st.on = null; st.onEl = null; st.goal = null; st.mode = 'drag'; feel('scared', 1.5); emote('!'); say(pick(['Weee!', 'Pra onde a gente vai?', 'Me larga em cima de um projeto!']), 2200); sfx().chirp(2); }
      if (drag.moved) { st.x = e.clientX - drag.ox; st.y = e.clientY - drag.oy; drag.hist.push([performance.now(), e.clientX, e.clientY]); if (drag.hist.length > 6) drag.hist.shift(); }
    });
    const release = () => {
      if (!drag) return;
      if (!drag.moved) play();
      else { const h = drag.hist, a = h[0], b = h[h.length - 1], dt = a && b ? Math.max(0.016, (b[0] - a[0]) / 1000) : 1; st.vx = a ? clamp((b[1] - a[1]) / dt, -1400, 1400) : 0; st.vy = a ? clamp((b[2] - a[2]) / dt, -1400, 1400) : 0; st.dragging = false; st.mode = 'air'; if (Math.hypot(st.vx, st.vy) > 600) { emote('!'); say('Aaaaah!', 1200); } }
      drag = null;
    };
    hit.addEventListener('pointerup', release); hit.addEventListener('pointercancel', release);
    hit.addEventListener('click', (e) => { if (e.detail === 0) play(); });
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); st.goal = { el: st.onEl, tx: st.x + (e.key === 'ArrowLeft' ? -120 : 120) }; }
      if (e.key === 'ArrowUp') { e.preventDefault(); play(); }
    });
    let dwell = null;
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest?.('[data-scan], .work-list li, .license, .const-btn, .mail');
      clearTimeout(dwell);
      if (!el || st.sleep || reduce || st.mood === 'sulky') return;
      dwell = setTimeout(() => {
        const target = el.matches('[data-scan]') ? (el.querySelector('.feature-text h3, .feature-media, .feature-type') || el) : el;
        if (st.onEl === target) return;
        emote('?', 1); if (!bubble.textContent && once('notice', 3000)) say(pick(['Opa, deixa eu ver!', 'Já vou!', 'Bip! Esse aí?']), 1500);
        goTo(target);
      }, 650);
    });
    hits.push({ rect: () => ({ left: st.x + 4, top: st.y - H + 4, right: st.x + W - 4, bottom: st.y }), onHit: (b) => { hurt(b.x); sfx().tone(90, 0.2, 'sawtooth', 0.04); say(pick(['Ai! Eu sou do seu time!', 'Fogo amigo!', 'Isso é um ataque de negação de serviço?', 'Meu escudo é só o WAF, pega leve!']), 2600); } });

    function think(now) {
      if (now < st.nextThink || st.dragging || st.goal || !st.on) return;
      st.nextThink = now + 5000 + Math.random() * 8000;
      if (st.sleep || reduce) return;
      if (s.energy < 20) { feel('tired', 4); if (once('tired', 30000)) say('Bateria fraca... passa a nave em cima de mim.'); return; }
      const r = Math.random();
      if (r < 0.2) { emote('♪', 2); sfx().chirp(4); st.lookT = 1.8; return; }
      if (r < 0.32) { st.spinT = 1; emote('…', 1); return; }
      const ps = platforms().filter((p) => p.el !== st.onEl && Math.abs(p.top - st.y) < 360);
      if (ps.length && r < 0.85) goTo(pick(ps).el); else st.goal = { el: st.onEl, tx: clamp(st.x + (Math.random() - 0.5) * 300, st.onEl ? 0 : floorMinX(), innerWidth - W) };
    }
    function chatter(now) {
      if (now - st.lastTalk < 45000 || bubble.textContent || st.dragging) return;
      if (st.sleep) { say('Zzz...', 2500); return; }
      const last = window.ghData?.last, d = last ? daysSince(last.pushed_at) : null;
      say(pick(['Passa o mouse num projeto que eu vou lá rodar o pipeline.', 'Clica no vazio com a nave pra atirar. Mas não em mim!', d != null ? (d > 14 ? `O Luan não dá push há ${dias(d)}. Cobra ele.` : `Último push do Luan: ${last.name}, há ${dias(d)}.`) : 'Tudo no ar por aqui.', 'Me arremessa! Eu aguento.', 'Aperta a barra no teclado e a gente salta pra qualquer seção.', 'Já olhou pelo telescópio do observatório?']));
    }
    const greet = () => {
      try { if (sessionStorage.getItem('c1cd-hi')) return; sessionStorage.setItem('c1cd-hi', '1'); } catch {}
      if (st.sleep) say('Zzz... (aqui em Serra é madrugada)', 3500);
      else if (first) { emote('!'); say('Bip-bup! Eu sou o C1-CD: integro e entrego. Me arrasta, me joga, ou passa o mouse num projeto.', 5500); }
      else { emote('♥'); say(`Você voltou! Visita número ${s.visits}. Bip!`, 3500); }
    };
    innerWidth < 640 ? addEventListener('scroll', () => setTimeout(greet, 500), { once: true }) : setTimeout(greet, 2200);

    function step(dt, now) {
      s.energy = clamp(s.energy - dt * (st.mode === 'walk' ? 0.12 : 0.02), 0, 100); s.joy = clamp(s.joy - dt * 0.015, 0, 100);
      if (ship.over(st.x, st.y - H, W, H) && !st.sleep) { const b = s.energy; s.energy = clamp(s.energy + dt * 12, 0, 100); if (st.mood !== 'sulky') feel('happy', 0.5); if (b < 99.5 && s.energy >= 99.5) { emote('♥'); say('Bateria cheia! Essa nave é um ótimo carregador.', 3000); } }
      const sp = ship.speed(), sd = Math.hypot(ship.pos.x - (st.x + W / 2), ship.pos.y - (st.y - H / 2));
      if (sp > 1600 && sd < 120 && !st.sleep && once('scare', 3000)) { feel('scared', 1.2); emote('!', 1); st.shake = 0.5; sfx().tone(1200, 0.08, 'square', 0.02, 1800); }
      else if (sd < 150 && sp < 400 && now - pointer.at < 600 && st.mood === 'ok' && once('cur', 6000)) { feel('curious', 2); emote('?', 1.2); }
      think(now); chatter(now);
      st.hurtT = Math.max(0, st.hurtT - dt); st.deployT = Math.max(0, st.deployT - dt); st.holoT = Math.max(0, st.holoT - dt); st.emoteT = Math.max(0, st.emoteT - dt); st.shake = Math.max(0, st.shake - dt); st.spinT = Math.max(0, st.spinT - dt); st.lookT = Math.max(0, st.lookT - dt);
      if (st.holoT > 0 && st.holoEl) { const hr = st.holoEl.getBoundingClientRect(); if (!st.onEl || !st.holoEl.contains(st.onEl) || hr.bottom < 0 || hr.top > innerHeight) { st.holoT = 0; holo(bubble, '', 0); } }
      if ((st.moodT -= dt) <= 0) st.mood = st.sleep ? 'sleep' : s.energy < 20 ? 'tired' : 'ok';
      if (st.dragging) { st.vx = 0; st.vy = 0; return; }
      const prevY = st.y;
      if (st.on) {
        if (st.onEl) { const p = platOf(st.onEl); if (p.top < 80 || p.top > innerHeight + 10 || st.x + W * 0.5 < p.left || st.x + W * 0.5 > p.right) { st.on = null; st.onEl = null; st.mode = 'air'; st.vy = 0; } else st.y = p.top; }
        else st.y = innerHeight;
        if (st.on && st.goal) {
          const g = st.goal, p = g.el && g.el !== st.onEl ? platOf(g.el) : null, speed = 50 + s.energy * 0.5;
          if (p && (p.top < 80 || p.top > innerHeight)) st.goal = null;
          else if (p) { const tx = clamp(g.tx, 0, innerWidth - W), dx = tx - st.x; if (Math.abs(dx) < 130 || p.top > st.y - 10) { if (!jumpTo(p, tx)) st.goal = null; } else { st.face = Math.sign(dx); st.x += st.face * speed * dt; st.mode = 'walk'; } }
          else { const dx = g.tx - st.x; if (Math.abs(dx) < 3) { st.goal = null; st.mode = 'idle'; } else { st.face = Math.sign(dx); st.x += st.face * Math.min(Math.abs(dx) / dt, speed) * dt; st.mode = 'walk'; } }
        } else if (st.on) st.mode = 'idle';
      }
      if (!st.on) {
        st.vy += G * dt; st.x += st.vx * dt; st.y += st.vy * dt;
        if (st.x < 0) { st.x = 0; st.vx = Math.abs(st.vx) * 0.5; } if (st.x > innerWidth - W) { st.x = innerWidth - W; st.vx = -Math.abs(st.vx) * 0.5; }
        if (st.y - H < 0 && st.vy < 0) st.vy *= -0.3;
        if (st.vy > 0) {
          const cx = st.x + W / 2, land = platforms().filter((p) => cx > p.left && cx < p.right && prevY <= p.top + 2 && st.y >= p.top).sort((a, b) => a.top - b.top)[0];
          if (land) { st.y = land.top; st.on = 'el'; st.onEl = land.el; st.vx = 0; st.vy = 0; st.mode = 'idle'; st.hop = 0.2; landedOn(land.el); if (st.goal?.el === land.el) st.goal = null; }
          else if (st.y >= innerHeight) { st.y = innerHeight; st.on = 'floor'; st.onEl = null; st.vx = 0; st.vy = 0; st.mode = 'idle'; st.hop = 0.2; sfx().tone(140, 0.08, 'square', 0.03); }
        }
      }
      st.hop = Math.max(0, st.hop - dt);
      if (st.on === 'floor' && !st.dragging && innerWidth >= 640) { const m = Math.min(floorMinX(), innerWidth - W - 8); if (st.x < m) { st.goal = { el: null, tx: m + 10 }; } }
      st.x = clamp(st.x, -10, innerWidth - W + 10);
    }
    function draw(now) {
      if (now > st.blinkAt) { st.blinkUntil = now + 130; st.blinkAt = now + 2000 + Math.random() * 3500; }
      let tl;
      if (st.mood === 'sulky') tl = Math.PI * 0.95;
      else if (st.spinT > 0) tl = (1 - st.spinT) * Math.PI * 2;
      else if (st.lookT > 0) tl = Math.sin(now / 160) * 0.9;
      else if (st.mode === 'walk') tl = st.face * 0.9;
      else if (now - pointer.at < 3000) tl = clamp((pointer.x - (st.x + W / 2)) / 220, -1.3, 1.3);
      else tl = Math.sin(now / 1300) * 0.7;
      if (st.spinT > 0) st.look = tl; else st.look += wrapA(tl - st.look) * 0.12;
      st.stepT += st.mode === 'walk' ? 0.22 : 0;
      const step = st.mode === 'walk' ? 1 + ((st.stepT | 0) & 1) : 0;
      droidPx({ look: st.look, blink: now < st.blinkUntil, step, lit: Math.ceil(s.energy / 34), hurt: st.hurtT > 0, mood: st.sleep ? 'sleep' : st.mood, sit: s.energy < 15 || st.sleep, holo: st.holoT > 0 || !!bubble.textContent }).canvas(spr);
      const x = st.x + (st.shake > 0 ? (Math.random() - 0.5) * 5 : 0), y = st.y - H + (st.hop > 0 ? 2 : 0) + (st.mode === 'walk' ? ((st.stepT | 0) & 1) * S : 0);
      if (st.on) { ag.fillStyle = 'rgba(0,0,0,0.35)'; ag.fillRect((x + 6) * dpr, (st.y - 2) * dpr, (W - 12) * dpr, 2 * dpr); }
      blit(spr, x, y, S);
      if (ship.over(st.x, st.y - H, W, H) && !st.sleep) for (let i = 0; i < 3; i++) if (Math.random() < 0.5) sq(x + Math.random() * W, y + Math.random() * 24, S, 'y');
      if (st.deployT > 0) { const k = 1 - st.deployT / 1.3; ag.fillStyle = P.k; ag.fillRect((x - 2) * dpr, (y - 12) * dpr, (W + 4) * dpr, 7 * dpr); ag.fillStyle = P.o; ag.fillRect(x * dpr, (y - 10) * dpr, Math.round(W * k / S) * S * dpr, 3 * dpr); }
      if (st.emoteT > 0 && st.emote) blit(emoteCanvas[st.emote], x + W - 6, y - 18 + Math.sin(now / 120) * 2, S, Math.min(1, st.emoteT * 3));
      if (st.sleep) { const t = (now / 900) % 1; ag.fillStyle = P.W; ag.globalAlpha = 1 - t; ag.font = `${13 * dpr}px Tektur`; ag.fillText('z', (x + W - 6 + t * 10) * dpr, (y - 2 - t * 18) * dpr); ag.globalAlpha = 1; }
      hit.style.transform = `translate(${Math.round(st.x)}px, ${Math.round(st.y - H)}px)`;
      // the hologram floats above the dome, its cone aimed at the holoprojector
      const bw = bubble.offsetWidth || 200, bx = clamp(st.x + W / 2 - bw / 2, 8, innerWidth - bw - 8), by = Math.max(8, y - 34 - bubble.offsetHeight - (st.emoteT > 0 ? 14 : 0));
      bubble.style.transform = `translate(${bx}px, ${by}px)`;
      bubble.style.setProperty('--cone-x', `${clamp(st.x + W * (0.5 + Math.sin(st.look) * 0.3) - bx, 12, bw - 12)}px`);
    }
    const placeClear = () => { if (st.on === 'floor' && !st.dragging && innerWidth >= 640) st.x = Math.max(st.x, Math.min(floorMinX(), innerWidth - W - 8)); };
    addEventListener('resize', () => { if (st.on === 'floor') st.y = innerHeight; st.x = clamp(st.x, 0, innerWidth - W); placeClear(); });
    requestAnimationFrame(placeClear);
    document.addEventListener('constellation', (e) => { const g = e.detail; if (!g?.picked) return; st.cool.notice = performance.now() + 7000; emote('!'); say(`${g.name}: ${g.items.slice(0, 3).map(([a, b]) => `${a} (${b})`).join(', ')}.`, 6000); });
    document.addEventListener('copied', (e) => { emote('♥'); st.spinT = 1; say(`Transmissão pronta: ${e.detail} copiado. Cola no seu e-mail e manda pro Luan.`, 5000); sfx().tone(660, 0.2, 'sine', 0.03, 990); });
    setInterval(save, 6000);
    return { step, draw, st, W, H, say, emote, feel };
  })();

  // ======================================================================
  // The starfighter cursor
  // ======================================================================
  const ship = (() => {
    const on = fine && !reduce;
    if (on) document.documentElement.classList.add('ship-cursor');
    const S = 2;
    let x = innerWidth / 2, y = innerHeight / 2, vx = 0, vy = 0, ang = 0, angV = 0, lock = false, lastFire = 0, recoil = 0, warp = 0, spd = 0, boost = 0, open = 0, side = 1;
    const bolts = [], trail = [];
    document.addEventListener('pointerover', (e) => { lock = !!e.target.closest?.('a, button, [role="button"], input, label, summary'); });
    const isUI = (el) => el.closest?.('a, button, [role="button"], input, textarea, select, label, summary, .license, video, .obs, dialog, [contenteditable]');
    if (on) addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || isUI(e.target)) return;
      const now = performance.now(); if (now - lastFire < 140) return; lastFire = now; recoil = 1; open = 1;
      const dx = Math.sin(ang), dy = -Math.cos(ang), px = Math.cos(ang), py = Math.sin(ang);
      side = -side;
      for (const s2 of [side, side * 0.6]) bolts.push({ x: x + px * s2 * 30 + dx * 16, y: y + py * s2 * 30 + dy * 16, vx: dx * 1300 + vx * 0.3, vy: dy * 1300 + vy * 0.3, life: 0.9 });
      burst(x + px * side * 30 + dx * 18, y + py * side * 30 + dy * 18, 4, 'y', 120, 0.12);
      sfx().tone(1500, 0.12, 'square', 0.02, 280);
    });
    document.addEventListener('click', (e) => { if (e.target.closest?.('a[data-warp]')) { warp = 1; sfx().tone(200, 0.6, 'sawtooth', 0.02, 1600); } }, true);
    window.addEventListener('hyperspace', () => { warp = 1; });
    function step(dt) {
      if (!on) return;
      const back = 26, gx = pointer.x - Math.sin(ang) * back, gy = pointer.y + Math.cos(ang) * back;
      const k = 200, c = 23;
      vx += ((gx - x) * k - vx * c) * dt; vy += ((gy - y) * k - vy * c) * dt;
      x += vx * dt; y += vy * dt;
      spd = Math.hypot(vx, vy); boost = Math.max(0, Math.min(1, (spd - 700) / 900));
      if (Math.hypot(pointer.x - x, pointer.y - y) > 2 || spd > 40) { const ta = spd > 60 ? Math.atan2(vx, -vy) : Math.atan2(pointer.x - x, -(pointer.y - y)); angV += (wrapA(ta - ang) * 60 - angV * 12) * dt; }
      angV *= 0.9; ang += angV * dt;
      recoil = Math.max(0, recoil - dt * 6); warp = Math.max(0, warp - dt * 1.6);
      open += ((lock || recoil > 0 ? 1 : 0) - open) * Math.min(1, dt * 8);
      for (const sideX of [-1, 1]) {
        const ex = x - Math.sin(ang) * 26 + Math.cos(ang) * sideX * 8, ey = y + Math.cos(ang) * 26 + Math.sin(ang) * sideX * 8, n = spd > 80 ? 1 + ((boost * 2) | 0) : (Math.random() < 0.18 ? 1 : 0);
        for (let i = 0; i < n; i++) trail.push({ x: ex + (Math.random() - 0.5) * 3, y: ey + (Math.random() - 0.5) * 3, life: 0.3 + boost * 0.3, max: 0.3 + boost * 0.3 });
      }
      for (const t of trail) t.life -= dt; while (trail.length && trail[0].life <= 0) trail.shift();
      for (const b of bolts) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        for (const h of hits) { const r = h.rect(); if (r && b.life > 0 && b.x > r.left && b.x < r.right && b.y > r.top && b.y < r.bottom) { b.life = 0; burst(b.x, b.y, 10, 'y'); h.onHit(b); } }
        if (b.life > 0 && (b.x < 0 || b.y < 0 || b.x > innerWidth || b.y > innerHeight)) { burst(clamp(b.x, 2, innerWidth - 2), clamp(b.y, 2, innerHeight - 2), 4, 'o'); b.life = 0; }
      }
      for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].life <= 0) bolts.splice(i, 1);
    }
    function draw(now) {
      for (const b of bolts) { const ux = b.vx / 1300, uy = b.vy / 1300; for (let k = 0; k < 8; k++) sq(b.x - ux * k * 3, b.y - uy * k * 3, 3, k < 2 ? 'W' : k < 6 ? 'r' : 'R'); }
      if (!on || !pointer.inside) return;
      for (const t of trail) { const k = t.life / t.max; sq(t.x, t.y, 2, k > 0.7 ? 'W' : k > 0.45 ? 'y' : 'o', Math.min(1, k * 1.5)); }
      if (warp > 0) { ag.strokeStyle = P.h; ag.lineWidth = 2 * dpr; for (let i = 0; i < 7; i++) { const o = (i - 3) * 7, L = 40 + warp * 180; ag.globalAlpha = warp; ag.beginPath(); ag.moveTo((x + Math.cos(ang) * o) * dpr, (y + Math.sin(ang) * o) * dpr); ag.lineTo((x + Math.cos(ang) * o - Math.sin(ang) * L) * dpr, (y + Math.sin(ang) * o + Math.cos(ang) * L) * dpr); ag.stroke(); } ag.globalAlpha = 1; }
      const dir = Math.round(ang / (Math.PI / 16)) & 31, eng = ((now / 70) | 0) & 1;
      const img = shipFrame(eng, open > 0.5 ? 1 : 0, lock ? 1 : 0, boost > 0.4 ? 1 : 0, dir), kick = recoil * 3, bob = Math.sin(now / 500) * (spd < 30 ? 1 : 0);
      blit(img, x - img.width * S / 2 + Math.sin(ang) * kick, y - img.height * S / 2 - Math.cos(ang) * kick + bob, S, warp > 0.5 ? 0.6 : 1);
      const r = lock ? 7 : 4, t = (now / 300) % 1;
      ag.fillStyle = P.o;
      if (lock) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const cx = pointer.x + sx * (r + 2 - t * 2), cy = pointer.y + sy * (r + 2 - t * 2); ag.fillRect((cx - (sx < 0 ? 0 : 4)) * dpr, cy * dpr, 5 * dpr, 2 * dpr); ag.fillRect(cx * dpr, (cy - (sy < 0 ? 0 : 4)) * dpr, 2 * dpr, 5 * dpr); }
      else { ag.fillRect((pointer.x - 1) * dpr, (pointer.y - r - 3) * dpr, 2 * dpr, 4 * dpr); ag.fillRect((pointer.x - 1) * dpr, (pointer.y + r) * dpr, 2 * dpr, 4 * dpr); ag.fillRect((pointer.x - r - 3) * dpr, (pointer.y - 1) * dpr, 4 * dpr, 2 * dpr); ag.fillRect((pointer.x + r) * dpr, (pointer.y - 1) * dpr, 4 * dpr, 2 * dpr); }
    }
    const over = (bx, by, bw, bh) => on && pointer.inside && x > bx && x < bx + bw && y > by && y < by + bh;
    return { step, draw, over, speed: () => (on ? spd : 0), get pos() { return on ? { x, y } : { x: pointer.x, y: pointer.y }; } };
  })();

  for (const sel of ['.map-egg', '#egg']) hits.push({ rect: () => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left - 6, top: r.top - 6, right: r.right + 6, bottom: r.bottom + 6 }; }, onHit: () => { droid?.say('Acertou o invasor! Prepara a defesa...', 2000); setTimeout(() => { location.href = 'jogo.html'; }, 900); } });

  // ======================================================================
  // The Empire: fighter squadrons cross the page and shoot at it; a wedge attacks Saturn by the contact
  // ======================================================================
  const empire = (() => {
    if (reduce) return {};
    const S = 2, ties = [], green = [], KEY = 'c1cd-ties';
    let next = performance.now() + 18000, kills = 0;
    try { kills = +localStorage.getItem(KEY) || 0; } catch {}
    const targets = () => [...document.querySelectorAll('h2, .feature-media, .license, .const-btn')].map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.bottom > 60 && r.top < innerHeight - 40 && r.width > 30);
    function spawn() {
      const TEXT = 'p, h1, h2, h3, li, a, dl, button, .feature-media, .bot-say, canvas#obs-canvas';
      let best = innerHeight * 0.2, score = 1e9;
      for (let yy = 80; yy < innerHeight * 0.62; yy += 16) { let n = 0; for (let k = 0; k < 14; k++) { const el = document.elementFromPoint((k + 0.5) / 14 * innerWidth, yy + 18); if (el?.closest?.(TEXT)) n++; } if (n < score) { score = n; best = yy; } }
      const fromLeft = Math.random() < 0.5, y0 = best, n = 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const t = { x: fromLeft ? -60 - i * 70 : innerWidth + 60 + i * 70, y: y0 + (i % 2) * 10, vx: (fromLeft ? 1 : -1) * (300 + Math.random() * 60), ph: Math.random() * 6, fired: false, fireAt: 0.25 + Math.random() * 0.5, dead: false };
        t.hit = { rect: () => (t.dead ? null : { left: t.x - 6, top: t.y - 4, right: t.x + 23 * S + 6, bottom: t.y + 19 * S + 4 }), onHit: () => { t.dead = true; burst(t.x + 22, t.y + 18, 26, 'o', 420, 0.7); burst(t.x + 22, t.y + 18, 14, 'y', 260, 0.5); burst(t.x + 22, t.y + 18, 8, 'd', 200, 0.9); sfx().tone(90, 0.4, 'sawtooth', 0.05, 40); kills++; try { localStorage.setItem(KEY, kills); } catch {} droid?.emote('♥'); droid?.say(kills === 1 ? 'Boa! Primeiro caça imperial derrubado!' : `Boa! ${kills} caças imperiais derrubados.`, 2600); } };
        hits.push(t.hit); ties.push(t);
      }
      sfx().tone(700, 0.6, 'sawtooth', 0.015, 300);
      if (droid && Math.random() < 0.7) { droid.emote('!'); droid.say(pick(['O Império! Atira neles com a nave!', 'Caças imperiais! Clica no vazio pra atirar!', 'Ataque imperial! Protege o site!']), 3000); droid.feel('scared', 1.5); }
    }
    // the wedge by Saturn
    const sat = document.querySelector('.p-contact'), WS = 3;
    const wedge = { hp: 6, away: 0, x: 0, y: 0, shield: 0, fireT: 2, seen: false };
    hits.push({ rect: () => (wedge.away > 0 || !wedge.on ? null : { left: wedge.x, top: wedge.y, right: wedge.x + 64 * WS, bottom: wedge.y + 24 * WS }), onHit: () => {
      wedge.shield = 0.3; wedge.hp -= 1; sfx().tone(300, 0.15, 'sine', 0.03, 200);
      if (wedge.hp === 5) droid?.say('Escudos defletores! Continua atirando!', 2400);
      if (wedge.hp <= 0) { wedge.away = 60; wedge.hp = 6; burst(wedge.x + 32 * WS, wedge.y + 12 * WS, 20, 'c', 300, 0.6); sfx().tone(200, 0.8, 'sawtooth', 0.03, 1800); droid?.emote('♥'); droid?.say('Ele fugiu pro hiperespaço! Saturno tá salvo.', 3000); }
    } });
    function step(dt, now) {
      if (now > next && !document.querySelector('dialog[open]')) { spawn(); next = now + 50000 + Math.random() * 40000; }
      for (const t of ties) {
        t.x += t.vx * dt; t.ph += dt * 3; t.y += Math.sin(t.ph) * 8 * dt;
        const prog = t.vx > 0 ? t.x / innerWidth : 1 - t.x / innerWidth;
        if (!t.fired && !t.dead && prog > t.fireAt) {
          t.fired = true; const tg = targets(); if (tg.length) { const [el, r] = pick(tg), tx = r.left + r.width * (0.2 + Math.random() * 0.6), ty = r.top + 2, sx = t.x + 22, sy = t.y + 30, d = Math.hypot(tx - sx, ty - sy); green.push({ x: sx, y: sy, vx: (tx - sx) / d * 800, vy: (ty - sy) / d * 800, life: d / 800, el }); sfx().tone(500, 0.1, 'square', 0.015, 250); }
        }
      }
      for (let i = ties.length - 1; i >= 0; i--) { const t = ties[i]; if (t.dead || t.x < -200 || t.x > innerWidth + 200) { ties.splice(i, 1); const k = hits.indexOf(t.hit); if (k >= 0) hits.splice(k, 1); } }
      for (const b of green) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.life <= 0) { burst(b.x, b.y, 10, 'g', 240, 0.4); burst(b.x, b.y, 6, 'y', 160, 0.3); b.el.classList.remove('bonk'); void b.el.offsetWidth; b.el.classList.add('bonk'); setTimeout(() => b.el.classList.remove('bonk'), 400); } }
      for (let i = green.length - 1; i >= 0; i--) if (green[i].life <= 0) green.splice(i, 1);
      // the wedge appears when Saturn is on screen
      wedge.away = Math.max(0, wedge.away - dt); wedge.shield = Math.max(0, wedge.shield - dt);
      const r = sat?.getBoundingClientRect();
      wedge.on = r && r.bottom > 0 && r.top < innerHeight && wedge.away === 0;
      if (wedge.on) {
        wedge.x = r.left + r.width * 0.12 - 64 * WS + Math.sin(now / 2200) * 14; wedge.y = r.top + r.height * 0.3 + Math.sin(now / 1700) * 6;
        if (!wedge.seen) { wedge.seen = true; droid?.emote('!'); droid?.say('Um destróier imperial atacando Saturno! Atira nele!', 3200); }
        if ((wedge.fireT -= dt) <= 0) { wedge.fireT = 0.9 + Math.random() * 1.6; const sx = wedge.x + 62 * WS, sy = wedge.y + 17 * WS, tx = r.left + r.width * (0.4 + Math.random() * 0.25), ty = r.top + r.height * (0.4 + Math.random() * 0.25), d = Math.hypot(tx - sx, ty - sy); green.push({ x: sx, y: sy, vx: (tx - sx) / d * 700, vy: (ty - sy) / d * 700, life: d / 700, el: sat }); }
      }
    }
    function draw(now) {
      for (const b of green) { const ux = b.vx / Math.hypot(b.vx, b.vy), uy = b.vy / Math.hypot(b.vx, b.vy); for (let k = 0; k < 7; k++) sq(b.x - ux * k * 3, b.y - uy * k * 3, 3, k < 2 ? 'W' : 'g'); }
      for (const t of ties) if (!t.dead) blit(tieC[t.fired && t.fired !== 'done' && ((now / 80) | 0) % 2 ? 1 : 0], t.x, t.y, S);
      if (wedge.on) { blit(destroyerC, wedge.x, wedge.y, WS); if (wedge.shield > 0) { ag.globalAlpha = wedge.shield * 2; ag.strokeStyle = P.c; ag.lineWidth = 2 * dpr; ag.beginPath(); ag.ellipse((wedge.x + 32 * WS) * dpr, (wedge.y + 12 * WS) * dpr, 36 * WS * dpr, 15 * WS * dpr, 0, 0, 7); ag.stroke(); ag.globalAlpha = 1; } }
    }
    return { step, draw };
  })();

  // ======================================================================
  // The observatory: a desert at night with twin moons, moisture vaporators, a hut, radio dishes,
  // an observatory whose telescope tracks the ship, and the rover
  // ======================================================================
  const rover = (() => {
    const host = document.getElementById('observatorio'), cv = document.getElementById('obs-canvas'), btn = document.getElementById('rover-hit'), scopeBtn = document.getElementById('scope-hit');
    const bubble = document.getElementById('rover-say'), obsSay = document.getElementById('obs-say'), section = document.getElementById('projetos');
    if (!host || !cv) return {};
    const SC = 2, g = cv.getContext('2d');
    let w = 0, h = 0, bg = null, places = {};
    const horizon = (x) => Math.round(h * 0.6 + Math.sin(x / 23) * 1.5);
    const roadY = (x) => Math.round(h * 0.88 + Math.sin(x / 40) * 0.8);
    const setc = (b, x, y, c) => { b.fillStyle = P[c]; b.fillRect(x | 0, y | 0, 1, 1); };
    const TARGETS = [
      { src: 'assets/web/moon-disc.webp', label: 'Telescópio: a Lua, a 384 mil km da Terra.' },
      { src: 'assets/web/jupiter.webp', label: 'Telescópio: Júpiter, a 778 milhões de km do Sol.' },
      { src: 'assets/web/saturn.webp', label: 'Telescópio: Saturno, a 1,4 bilhão de km do Sol.' },
    ].map((t) => { const img = new Image(); img.src = t.src; return { ...t, img }; });
    let targetI = 0, chart = null;
    document.addEventListener('constellation', (e) => { if (e.detail?.picked) { chart = e.detail; targetI = -1; } });
    function paint() {
      w = Math.max(100, Math.round(host.clientWidth / SC)); h = Math.max(60, Math.round(host.clientHeight / SC));
      cv.width = w; cv.height = h;
      const [c, b] = make(w, h); bg = c;
      // night glow above the horizon
      for (let y = Math.round(h * 0.3); y < h * 0.62; y++) for (let x = 0; x < w; x++) if (dither(x, y, ((y - h * 0.3) / (h * 0.32)) ** 2 * 0.5)) setc(b, x, y, 'N');
      // twin moons
      const m1 = new Px(18, 18); sphere(m1, 9, 9, 7.5, ['O', 'o', 'p', 'y']); m1.paint(b, Math.round(w * 0.07), Math.round(h * 0.08));
      const m2 = new Px(10, 10); sphere(m2, 5, 5, 3.6, ['d', 'm', 'l', 'w']); m2.paint(b, Math.round(w * 0.07) + 20, Math.round(h * 0.08) + 14);
      // far range
      let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      const far = []; let fy = h * 0.5; for (let x = 0; x < w; x++) { if (x % 6 === 0) fy = clamp(fy + (rnd() - 0.5) * 6, h * 0.42, h * 0.56); far.push(fy); }
      for (let x = 0; x < w; x++) for (let y = Math.round(far[x]); y < horizon(x); y++) setc(b, x, y, y === Math.round(far[x]) ? 'n' : 'N');
      // dunes
      for (let x = 0; x < w; x++) { const hz = horizon(x); for (let y = hz; y < h; y++) { const t = (y - hz) / (h - hz); let col = t < 0.06 ? 'v' : 's'; if (t > 0.06 && t < 0.2 && dither(x, y, 1 - (t - 0.06) / 0.14)) col = 'v'; if (t > 0.55 && dither(x, y, (t - 0.55) / 0.45)) col = 'S'; setc(b, x, y, col); } }
      // moisture vaporators
      places.vapors = [];
      for (const fxp of [0.16, 0.2, 0.25]) {
        const x0 = Math.round(w * fxp), base = horizon(x0) + 3, vp = new Px(9, 30);
        cyl(vp, 3, 6, 3, 22, ['d', 'm', 'l', 'w']); for (let y = 8; y < 28; y += 5) for (let x = 2; x < 7; x++) vp.set(x, y, x === 2 ? 'l' : 'm');
        box(vp, 1, 3, 7, 3, ['d', 'm', 'l', 'w']); line(vp, 4, 0, 4, 3, 'm'); box(vp, 2, 26, 5, 3, ['k', 'd', 'm', 'l']);
        vp.outline('k'); vp.paint(b, x0 - 4, base - 29); places.vapors.push({ x: x0 - 4, y: base - 29, w: 9, h: 30, lx: x0, ly: base - 29 });
      }
      // adobe hut with a lit door
      { const x0 = Math.round(w * 0.33), base = horizon(x0) + 4, hp = new Px(28, 14); sphere(hp, 14, 13, 12, ['S', 's', 'v', 'w'], { ry: 10, maxY: 13 }); for (let y = 6; y < 14; y++) for (let x = 11; x < 17; x++) if ((x - 14) ** 2 / 9 + ((y - 13) ** 2) / 49 <= 1) hp.set(x, y, 'K'); hp.outline('V'); hp.paint(b, x0 - 14, base - 14); places.hut = { x: x0 - 14, y: base - 14, w: 28, h: 14, door: [x0 - 1, base - 4] }; }
      // observatory building (dome and telescope are drawn live)
      { const x0 = Math.round(w * 0.72), base = horizon(x0) + 8, op = new Px(46, 16); box(op, 1, 0, 44, 16, ['m', 'l', 'w', 'W']); box(op, 19, 5, 8, 11, ['k', 'x', 'x', 'd']); for (let x = 5; x < 42; x += 6) { op.set(x, 4, 'b'); op.set(x + 1, 4, 'b'); } op.outline('k'); op.paint(b, x0 - 23, base - 16); places.obs = { x: x0 - 23, y: base - 44, w: 46, h: 44, cx: x0, cy: base - 16 }; }
      // radio dishes on lattice towers
      places.dishes = [0.84, 0.92].map((fxp) => { const x0 = Math.round(w * fxp), base = horizon(x0) + 5, tp = new Px(14, 16); for (let i = 0; i < 4; i++) { line(tp, 2 + i, 15, 6, 2, 'd'); line(tp, 11 - i, 15, 7, 2, 'd'); } for (let y = 4; y < 15; y += 4) line(tp, 4, y, 9, y, 'm'); tp.outline('k'); tp.paint(b, x0 - 7, base - 16); return { x: x0 - 9, y: base - 30, w: 18, h: 30, cx: x0, cy: base - 18, ang: Math.random() * 6, spin: 0 }; });
      { const cx0 = Math.round(w * 0.02), cb = horizon(cx0 + 30) + 9, cp = crawlerPx(); cp.paint(b, cx0, cb - 44); places.crawler = { x: cx0, y: cb - 44, w: 60, h: 44 }; }
      // a few rocks
      for (let i = 0; i < Math.round(w / 18); i++) { const rx = (rnd() * w) | 0, ry = (horizon(rx) + 8 + rnd() * (h - horizon(rx) - 10)) | 0, rs = 1 + ((rnd() * 2.5) | 0); const rp = new Px(rs * 2 + 3, rs + 3); sphere(rp, rs + 1.5, rs + 1, rs, ['V', 'S', 's', 'v'], { maxY: rs + 1 }); rp.paint(b, rx - rs, ry - rs); }
    }
    const st = { x: 40, target: 40, vx: 0, face: 1, wheel: 0, scan: null, next: 0, arm: 0, armT: 0, hurtT: 0, emote: null, emoteT: 0, panel: 0, panelT: 0, hud: null, hudFrom: [0, 0], blinkAt: 0, scope: -2.2, eye: 0 };
    const dust = [];
    const toScene = (cx, cy) => { const r = host.getBoundingClientRect(); return [(cx - r.left) / SC, (cy - r.top) / SC]; };
    const say = (t, ms = 3600) => { holo(obsSay, '', 0); holo(bubble, t, ms); };
    let anchor = null, anchorT = 0;
    const obsSpeak = (t, ms = 4200, ax = null, ay = null) => { holo(bubble, '', 0); holo(obsSay, t, ms); anchor = ax == null ? null : [ax, ay]; clearTimeout(anchorT); if (anchor) anchorT = setTimeout(() => { anchor = null; }, ms); };
    const emo = (e, t = 1.4) => { st.emote = e; st.emoteT = t; };
    const scanTarget = (el) => { st.scan = el; if (el) { const r = el.getBoundingClientRect(); st.target = clamp(toScene(r.left + r.width / 2, 0)[0] - 28, 4, places.obs ? places.obs.x - 58 : w - 60); emo('!', 0.8); } };
    section.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-scan]'); if (el !== st.scan) scanTarget(el); });
    section.addEventListener('pointerleave', () => { st.scan = null; });
    section.addEventListener('focusin', (e) => scanTarget(e.target.closest('[data-scan]')));
    function look() {
      st.eye = 5.5; sfx().tone(500, 0.25, 'sine', 0.03, 900);
      if (targetI === -1 && chart) { st.eyeChart = chart; targetI = 0; obsSpeak(`Telescópio: a constelação ${chart.name}. ${chart.items.length} estrelas, uma por ferramenta.`, 5200); return; }
      st.eyeChart = null; const t = TARGETS[targetI = (targetI + 1) % TARGETS.length]; obsSpeak(t.label, 5200);
    }
    const inBox = (b, x, y) => b && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
    host.addEventListener('click', (e) => {
      if (e.target === btn || e.target === scopeBtn) return;
      const [sx, sy] = toScene(e.clientX, e.clientY);
      if (st.eye > 0) { st.eye = 0; return; }
      const jw = locals.jawas.find((j) => sx > j.x - 2 && sx < j.x + 12 && sy > roadY(j.x | 0) - 16 && sy < roadY(j.x | 0) + 2);
      if (jw) { locals.scare(); return; }
      if (inBox(places.obs, sx, sy)) { look(); return; }
      const dish = places.dishes?.find((d) => inBox(d, sx, sy));
      if (dish) { places.dishes.forEach((d) => { d.spin = 2; }); const last = window.ghData?.last; sfx().chirp(4); obsSpeak(last ? `Sinal recebido do GitHub: último push em ${last.name}, há ${dias(daysSince(last.pushed_at))}.` : 'Sinal recebido. Ruído cósmico, só isso.', 4600); return; }
      if (places.vapors?.some((v) => inBox(v, sx, sy))) { obsSpeak(pick(['Vaporizador de umidade. Tira água do ar do deserto.', 'Esse aqui fala bocce? Eu não falo.']), 3200); return; }
      if (inBox(places.hut, sx, sy)) { obsSpeak('A cantina tá fechada. Volta amanhã.', 3000); return; }
      st.target = clamp(sx - 28, 4, places.obs ? places.obs.x - 58 : w - 60); st.next = performance.now() + 9000; emo('!', 0.7); sfx().tone(600, 0.06, 'square', 0.02);
    });
    scopeBtn.addEventListener('click', look);
    btn.addEventListener('pointerenter', () => { st.armT = 1.6; st.panelT = 2; emo('♥', 1.2); if (!bubble.textContent) say(pick(['Oi! Eu sou o rover do observatório.', 'Bip? Ah, oi!', 'Clica em mim que eu faço uma varredura.']), 2400); sfx().chirp(2); });
    btn.addEventListener('click', () => { st.panelT = 3; emo('!', 1); const last = window.ghData?.shown?.length; say(last ? `Varredura feita: ${last} ${last === 1 ? 'projeto' : 'projetos'} públicos no GitHub do Luan.` : 'Varredura feita. Céu limpo.', 3600); sfx().tone(900, 0.3, 'sine', 0.03, 400); });
    btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); st.target = clamp(st.x + (e.key === 'ArrowLeft' ? -40 : 40), 4, w - 60); } });
    hits.push({ rect: () => { const r = btn.getBoundingClientRect(); return r.width ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null; }, onHit: () => { st.hurtT = 0.3; st.vx = -st.face * 40; emo('#', 2); say(pick(['Ei! Eu só tava observando!', 'Ai! Minhas rodas!', 'Fogo amigo detectado.']), 2400); sfx().tone(110, 0.2, 'sawtooth', 0.04); } });
    let visible = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
    new ResizeObserver(() => paint()).observe(host);
    paint();
    const locals = { jawas: [], nextRaid: performance.now() + 22000,
      scare() { if (!this.jawas.length) return; this.jawas.forEach((j) => { j.mode = 'flee'; }); const j = this.jawas[0]; obsSpeak(pick(['Utini!', 'Utini! Utini!']), 2200, j.x + 5, roadY(j.x | 0) - 18); sfx().chirp(3); if (st.dragged) { st.dragged = false; st.next = performance.now() + 4000; emo('♥'); setTimeout(() => say('Valeu! Esses jawas não desistem.', 3000), 900); } this.nextRaid = performance.now() + 40000 + Math.random() * 30000; } };
    const jawaC = [jawaPx().canvas(), jawaPx({ step: 1 }).canvas(), jawaPx({ blink: 1 }).canvas()];
    function localsStep(dt, now) {
      const L = locals, home = places.crawler ? places.crawler.x + 46 : 20;
      if (!L.jawas.length) { L.jawas = [0, 1].map((i) => ({ x: home + i * 12, mode: 'idle', target: home + i * 12, face: 1, step: 0 })); }
      // jawas
      if (now > L.nextRaid && L.jawas.every((j) => j.mode === 'idle') && !st.scan) { L.jawas.forEach((j) => { j.mode = 'raid'; }); L.raidUntil = now + 22000; }
      for (const [i, j] of L.jawas.entries()) {
        const rxs = st.x + (st.face > 0 ? 6 : 50) + i * 6;
        if (j.mode === 'idle') { if (Math.abs(j.target - j.x) < 1 && Math.random() < 0.01) j.target = home + Math.random() * 40; }
        else if (j.mode === 'raid') { j.target = rxs; if (Math.abs(j.x - rxs) < 3) j.mode = 'drag'; if (now > L.raidUntil) j.mode = 'flee'; }
        else if (j.mode === 'drag') { j.x = rxs; j.target = rxs; }
        else if (j.mode === 'flee') { j.target = home + i * 12; if (Math.abs(j.x - j.target) < 2) j.mode = 'idle'; }
        const sp = j.mode === 'flee' ? 40 : j.mode === 'raid' ? 22 : 8, dx = j.target - j.x;
        if (j.mode !== 'drag' && Math.abs(dx) > 0.5) { j.face = Math.sign(dx); j.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt); j.step += dt * 8; }
        else if (j.mode === 'drag') { j.face = -Math.sign(st.x - home) || -1; j.step += dt * 6; }
      }
      const dragging = L.jawas.length && L.jawas.every((j) => j.mode === 'drag');
      if (dragging && !st.dragged) { st.dragged = true; emo('#', 3); say(pick(['Ei! Me solta! Eu não tô à venda!', 'Socorro! Jawas! Clica neles!']), 3800); sfx().tone(300, 0.3, 'square', 0.03, 600); }
      if (st.dragged && (!dragging || now > L.raidUntil)) { if (now > L.raidUntil) L.scare(); st.dragged = dragging && now <= L.raidUntil; }
      const d = droid?.st;
      if (d && d.onEl === host && L.jawas.some((j) => j.mode !== 'idle' && j.mode !== 'flee')) { const r = host.getBoundingClientRect(); if (L.jawas.some((j) => Math.abs(r.left + j.x * SC - (d.x + droid.W / 2)) < 120)) { L.scare(); droid.emote('#'); droid.say('Xô, jawas! Larguem meu primo!', 2600); } }
    }
    function localsDraw(t) {
      const L = locals, blink = ((t * 1.3) | 0) % 5 === 0;
      for (const j of L.jawas) { const c = jawaC[blink ? 2 : ((j.step | 0) & 1)], y = roadY(j.x | 0) - 15; if (j.face < 0) { g.save(); g.translate((j.x | 0) + 11, y); g.scale(-1, 1); g.drawImage(c, 0, 0); g.restore(); } else g.drawImage(c, j.x | 0, y); }
    }
    let lastMeet = 0;
    const roverSpr = document.createElement('canvas');
    function frame(dt, now) {
      if (!visible || !bg) { st.hud = null; return; }
      const t = now / 1000;
      const lo = places.hut ? places.hut.x + 30 : 4, hi = places.obs ? places.obs.x - 60 : w - 64;
      if (!st.scan && !st.dragged && now > st.next) { st.target = lo + Math.random() * Math.max(10, hi - lo); st.next = now + 6000 + Math.random() * 8000; }
      if (st.dragged) st.target = places.crawler ? places.crawler.x + 52 : 10;
      const max = reduce ? 1e4 : st.dragged ? 7 : st.scan ? 70 : 16;
      st.vx += (clamp((st.target - st.x) * 3, -max, max) - st.vx) * Math.min(1, dt * 4);
      if (reduce) { st.x = st.target; st.vx = 0; } else st.x += st.vx * dt;
      if (Math.abs(st.vx) > 1.5) st.face = Math.sign(st.vx);
      st.wheel += st.vx * dt / 6; st.armT = Math.max(0, st.armT - dt); st.panelT = Math.max(0, st.panelT - dt); st.hurtT = Math.max(0, st.hurtT - dt); st.emoteT = Math.max(0, st.emoteT - dt); st.eye = Math.max(0, st.eye - dt);
      st.arm += ((st.armT > 0 ? 1 : 0) - st.arm) * Math.min(1, dt * 6); st.panel += ((st.panelT > 0 ? 1 : 0) - st.panel) * Math.min(1, dt * 3);
      const parked = st.scan && Math.abs(st.target - st.x) < 2;
      if (!reduce) localsStep(dt, now);
      const d = droid?.st;
      if (d && d.onEl === host && now - lastMeet > 25000) { const r = host.getBoundingClientRect(), rx = r.left + (st.x + 28) * SC; if (Math.abs(d.x + droid.W / 2 - rx) < 100) { lastMeet = now; droid.emote('♥'); droid.say('Primo rover! Viu alguma coisa no céu?', 2600); setTimeout(() => { emo('!'); say('Só a nave do visitante. O telescópio não larga dela.', 3200); }, 1300); } }
      g.clearRect(0, 0, w, h); g.drawImage(bg, 0, 0);
      // vaporator lights, the hut's door, dishes
      places.vapors.forEach((v, i) => { if (((t * 1.2 + i * 0.7) | 0) % 3 === 0) setc(g, v.lx, v.ly, 'r'); });
      if (places.hut) { const [dx, dy] = places.hut.door; for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) setc(g, dx + x, dy + y, dither(dx + x, dy + y + ((t * 4) | 0), 0.6) ? 'y' : 'o'); }
      for (const ds of places.dishes) {
        ds.spin = Math.max(0, ds.spin - dt); ds.ang += dt * (0.3 + ds.spin * 4);
        const dw = Math.abs(Math.cos(ds.ang)) * 7 + 1.5, dp = new Px(20, 12);
        for (let y = -4; y <= 4; y++) for (let x = -9; x <= 9; x++) if ((x * x) / (dw * dw) + (y * y) / 16 <= 1) dp.set(10 + x, 6 + y, y < -1 ? 'w' : y < 2 ? 'l' : 'm');
        dp.set(10, 6, 'd'); dp.set(10, 1, 'r'); dp.outline('k'); dp.paint(g, ds.cx - 10, ds.cy - 6);
      }
      // the observatory dome, its slit following the telescope, which follows the ship
      { const o = places.obs, r = host.getBoundingClientRect(), sp = ship.pos, dx = sp.x - (r.left + o.cx * SC), dy = sp.y - (r.top + o.cy * SC);
        let goal = Math.atan2(dy, dx); if (goal > -0.15 || goal < -Math.PI + 0.15) goal = -Math.PI / 2 + Math.sin(t * 0.3) * 0.8;
        st.scope += wrapA(goal - st.scope) * Math.min(1, dt * 3);
        const dp = new Px(46, 42), ccx = 23, ccy = 25, a = st.scope;
        sphere(dp, ccx, ccy, 18, ['m', 'l', 'w', 'W'], { maxY: ccy, detail: (x, y) => { const px = x + 0.5 - ccx, py = y + 0.5 - ccy, along = px * Math.cos(a) + py * Math.sin(a), across = -px * Math.sin(a) + py * Math.cos(a); return along > 0 && Math.abs(across) < 2 ? 'K' : null; } });
        for (let i = 3; i < 24; i++) for (let k = -2; k <= 2; k++) { const xx = ccx + Math.cos(a) * i - Math.sin(a) * k, yy = ccy + Math.sin(a) * i + Math.cos(a) * k; dp.set(xx, yy, i > 21 ? 'o' : k < -1 ? 'w' : k > 1 ? 'd' : k > 0 ? 'm' : 'l'); }
        dp.set(ccx, ccy - 18, ((t * 2) | 0) & 1 ? 'r' : 'R'); dp.outline('k'); dp.paint(g, o.cx - 23, o.cy - 25);
        scopeBtn.style.transform = `translate(${Math.round((o.cx - 23) * SC)}px, ${Math.round((o.cy - 26) * SC)}px)`; scopeBtn.style.width = `${46 * SC}px`; scopeBtn.style.height = `${44 * SC}px`;
        const [ax, ay] = anchor || [o.cx, o.cy - 46], ow = obsSay.offsetWidth || 240, ox2 = clamp(ax * SC - ow / 2, 0, Math.max(0, host.clientWidth - ow)); obsSay.style.transform = `translate(${ox2}px, ${Math.max(4, ay * SC - obsSay.offsetHeight - 10)}px)`;
        obsSay.style.setProperty('--cone-x', `${clamp(ax * SC - ox2, 12, ow - 12)}px`);
      }
      // the rover
      const base = roadY((st.x + 28) | 0);
      const lookX = parked ? 0 : now - pointer.at < 2500 && section.matches(':hover') ? clamp((toScene(pointer.x, 0)[0] - (st.x + 36)) / 40, -1, 1) * st.face : 0.6;
      if (now > st.blinkAt) st.blinkAt = now + 2500 + Math.random() * 3000;
      roverPx({ dish: t * 0.8, glow: ((now / 700) | 0) & 1, wheel: st.wheel * st.face, blink: ((now / 600) | 0) & 1, blink2: now > st.blinkAt - 120, mood: st.hurtT > 0 || st.emote === '#' && st.emoteT > 0 ? 'sulky' : parked ? 'scan' : st.arm > 0.5 ? 'happy' : 'ok', lookX, lookY: parked ? -1 : 0, tilt: parked ? -1 : 0, lid: parked ? 1 : 0, arm: st.arm, panel: st.panel, t: t * 8, light: parked, hurt: st.hurtT > 0 }).canvas(roverSpr);
      const rx = Math.round(st.x), ry = base - 55 + (Math.abs(st.vx) > 4 && ((now / 110) | 0) % 2 ? -1 : 0);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(rx + 8, base + 1, 48, 1);
      if (st.face < 0) { g.save(); g.translate(rx + 68, ry); g.scale(-1, 1); g.drawImage(roverSpr, 0, 0); g.restore(); } else g.drawImage(roverSpr, rx, ry);
      localsDraw(t);
      if (!reduce && Math.abs(st.vx) > 6 && Math.random() < 0.6) dust.push({ x: st.face > 0 ? rx + 8 : rx + 48, y: base - 1, vx: -st.face * (4 + Math.random() * 8), vy: -(2 + Math.random() * 4), life: 0.8 });
      for (const q of dust) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 5 * dt; q.life -= dt; if (q.life > 0 && dither(q.x | 0, q.y | 0, q.life)) setc(g, q.x, q.y, 'v'); }
      for (let i = dust.length - 1; i >= 0; i--) if (dust[i].life <= 0) dust.splice(i, 1);
      if (st.emoteT > 0 && st.emote) g.drawImage(emoteCanvas[st.emote], st.face > 0 ? rx + 40 : rx + 10, ry - 9 + Math.sin(t * 8));
      // the eyepiece view
      if (st.eye > 0) {
        const T = TARGETS[Math.max(0, targetI)], R = Math.round(h * 0.4), ex = Math.round(w * 0.47), ey = Math.round(h * 0.42), k = Math.min(1, (5.5 - st.eye) * 4, st.eye * 3);
        g.save(); g.globalAlpha = k; g.beginPath(); g.arc(ex, ey, R, 0, 7); g.fillStyle = P.K; g.fill(); g.clip();
        if (st.eyeChart) { let sd = st.eyeChart.name.length * 97; const rn = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; }; const pts = st.eyeChart.items.map(() => [ex + (rn() - 0.5) * R * 1.3, ey + (rn() - 0.5) * R * 1.1]).sort((a, b) => a[0] - b[0]); g.fillStyle = P.o; for (let i = 1; i < pts.length; i++) { const n = 24; for (let k = 0; k <= n; k += 2) g.fillRect(Math.round(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / n), Math.round(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / n), 1, 1); } for (const [qx, qy] of pts) { g.fillStyle = P.W; g.fillRect(Math.round(qx) - 1, Math.round(qy), 3, 1); g.fillRect(Math.round(qx), Math.round(qy) - 1, 1, 3); } }
        else if (T.img.complete && T.img.naturalWidth) { const s2 = (R * 1.5) / Math.max(T.img.naturalWidth, T.img.naturalHeight), iw = T.img.naturalWidth * s2, ih = T.img.naturalHeight * s2; const [pc, pg] = make(Math.max(8, Math.round(iw / 2)), Math.max(8, Math.round(ih / 2))); pg.imageSmoothingEnabled = true; pg.drawImage(T.img, 0, 0, pc.width, pc.height); g.imageSmoothingEnabled = false; g.drawImage(pc, ex - iw / 2, ey - ih / 2, iw, ih); }
        g.fillStyle = P.h; for (let i = -R; i < R; i += 2) { g.fillRect(ex + i, ey, 1, 1); g.fillRect(ex, ey + i, 1, 1); }
        g.restore(); g.save(); g.globalAlpha = k; g.strokeStyle = P.d; g.lineWidth = 2; g.beginPath(); g.arc(ex, ey, R, 0, 7); g.stroke(); g.restore();
      }
      const hr = host.getBoundingClientRect();
      st.hud = parked ? st.scan : null; st.hudFrom = [hr.left + (st.face > 0 ? rx + 45 : rx + 23) * SC, hr.top + (ry + 8) * SC];
      btn.style.transform = `translate(${Math.round(rx * SC)}px, ${Math.round(ry * SC)}px)`; btn.style.width = `${68 * SC}px`; btn.style.height = `${56 * SC}px`;
      const bw = bubble.offsetWidth || 200, bx = clamp((rx + 28) * SC - bw / 2, 0, Math.max(0, host.clientWidth - bw));
      bubble.style.transform = `translate(${bx}px, ${Math.max(4, ry * SC - bubble.offsetHeight - 34)}px)`; bubble.style.setProperty('--cone-x', `${clamp((rx + 36) * SC - bx, 12, bw - 12)}px`);
    }
    function hud(now) {
      const el = st.hud; if (!el) return;
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      const pad = 8, L = 18;
      ag.fillStyle = P.h; ag.globalAlpha = 0.9;
      for (const [x, y, sx, sy] of [[r.left - pad, r.top - pad, 1, 1], [r.right + pad, r.top - pad, -1, 1], [r.left - pad, r.bottom + pad, 1, -1], [r.right + pad, r.bottom + pad, -1, -1]]) { ag.fillRect(x * dpr, y * dpr, sx * L * dpr, 3 * sy * dpr); ag.fillRect(x * dpr, y * dpr, 3 * sx * dpr, sy * L * dpr); }
      const [fx0, fy0] = st.hudFrom, top = host.getBoundingClientRect().top; ag.globalAlpha = 0.16 + Math.sin(now / 90) * 0.05; ag.beginPath(); ag.moveTo(fx0 * dpr, fy0 * dpr); ag.lineTo((fx0 - 26) * dpr, top * dpr); ag.lineTo((fx0 + 26) * dpr, top * dpr); ag.closePath(); ag.fill();
      ag.globalAlpha = 0.35; const sy = r.top + ((now / 900) % 1) * r.height; ag.fillRect(r.left * dpr, sy * dpr, r.width * dpr, 2 * dpr);
      const repo = (window.ghData?.shown || []).find((p) => el.textContent.includes(p.name));
      if (repo) { const label = `varredura: ${repo.language || 'código'}, push há ${dias(daysSince(repo.pushed_at))}`; ag.globalAlpha = 1; ag.font = `600 ${13 * dpr}px Tektur`; const tw = ag.measureText(label).width / dpr; ag.fillStyle = P.K; ag.fillRect((r.right + pad - tw - 14) * dpr, (r.top - pad - 24) * dpr, (tw + 14) * dpr, 20 * dpr); ag.fillStyle = P.h; ag.fillText(label, (r.right + pad - tw - 7) * dpr, (r.top - pad - 9) * dpr); }
      ag.globalAlpha = 1;
    }
    return { frame, hud, groundY: () => roadY((st.x + 28) | 0) * SC };
  })();

  // ======================================================================
  // One loop for everything
  // ======================================================================
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    requestAnimationFrame(loop);
    if (document.hidden) return;
    ship.step(dt);
    if (droid && !reduce) droid.step(dt, now);
    rover.frame?.(dt, now);
    empire.step?.(dt, now);
    ag.clearRect(0, 0, arena.width, arena.height);
    rover.hud?.(now);
    empire.draw?.(now);
    droid?.draw(now);
    for (const p of fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; if (p.life > 0) sq(p.x, p.y, p.s, p.col); }
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
    ship.draw(now);
  }
  requestAnimationFrame(loop);

  // route icons and the little ship on the rail
  document.querySelectorAll('.route-ic').forEach((cv) => {
    const kind = cv.dataset.ic; cv.width = 24; cv.height = 24; const g = cv.getContext('2d');
    if (kind === 'droid') g.drawImage(droidPx({}).canvas(), 0, 0, 30, 20, -3, 3, 30, 20);
    else if (kind === 'scope') { const p = new Px(24, 24); sphere(p, 12, 16, 9, ['m', 'l', 'w', 'W'], { maxY: 16 }); for (let i = 2; i < 13; i++) { p.set(12 + i * 0.7, 16 - i * 0.7, 'l'); p.set(13 + i * 0.7, 16 - i * 0.7, 'm'); } box(p, 3, 16, 18, 6, ['m', 'l', 'w', 'W']); p.outline('k'); p.paint(g); }
    else { const p = new Px(12, 12); for (const [x, y] of [[2, 3], [5, 6], [9, 4], [7, 9]]) { p.set(x, y, 'W'); p.set(x - 1, y, 'c'); p.set(x + 1, y, 'c'); p.set(x, y - 1, 'c'); p.set(x, y + 1, 'c'); } p.canvas(cv); }
  });
  const rs = document.getElementById('route-ship');
  if (rs) { const c = shipFrame(0, 0, 0, 0, 16); rs.width = c.width; rs.height = c.height; rs.getContext('2d').drawImage(c, 0, 0); }
})();
