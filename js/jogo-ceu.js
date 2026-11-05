const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, moved: false };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = e.clientX / innerWidth - 0.5; pointer.ny = e.clientY / innerHeight - 0.5;
  pointer.moved = true;
}, { passive: true });

// ---------- sound: off until the visitor turns it on ----------
const sfx = (() => {
  let ctx = null, on = false;
  const btn = document.getElementById('sfx');
  const ensure = () => (ctx ??= new AudioContext());
  function tone(freq, dur, type = 'sine', vol = 0.03, slide = 0) {
    if (!on) return;
    const a = ensure(), t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  function whoosh() {
    if (!on) return;
    const a = ensure(), len = a.sampleRate * 0.9, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, a.currentTime); f.frequency.exponentialRampToValueAtTime(3200, a.currentTime + 0.8);
    g.gain.value = 0.12; s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start();
  }
  btn?.addEventListener('click', () => {
    on = !on; btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Som ligado' : 'Som';
    if (on) { ensure().resume(); tone(880, 0.12, 'square', 0.03, 1320); }
  });
  document.addEventListener('pointerover', (e) => { if (e.target.closest?.('a, button, [role="button"]')) tone(1900, 0.04, 'sine', 0.012); });
  return { tone, whoosh };
})();

// ---------- the sky: three layers of stars, parallax, shooting stars and the jump to hyperspace ----------
const sky = (() => {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  let w, h, dpr, stars = [], shoot = null, warp = 0, warpTarget = 0, lastY = scrollY, vel = 0, running = true;
  const tints = ['#ffffff', '#ffffff', '#dfe8ff', '#b9ccff', '#ffd2ad', '#ffb27a'];

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((w * h) / 900);
    stars = Array.from({ length: n }, (_, i) => {
      const layer = i % 10 < 6 ? 0 : i % 10 < 9 ? 1 : 2;
      return {
        x: Math.random() * w, y: Math.random() * h, layer,
        z: [0.15, 0.45, 1][layer],
        r: [0.6, 1.1, 1.7][layer] * (0.7 + Math.random() * 0.6),
        t: Math.random() * 6.28, s: 0.6 + Math.random() * 1.8,
        c: tints[(Math.random() * tints.length) | 0],
        spike: layer === 2 && Math.random() < 0.18,
      };
    });
  }

  function frame(time) {
    const y = scrollY; vel = vel * 0.85 + (y - lastY) * 0.15; lastY = y;
    warp += (warpTarget - warp) * 0.08;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    for (const s of stars) {
      const ox = pointer.nx * s.z * -26;
      const oy = ((-y * s.z * 0.12) % h + h) % h + pointer.ny * s.z * -26;
      let x = (s.x + ox + w) % w, sy = (s.y + oy) % h;
      const tw = reduce ? 0.85 : 0.55 + Math.sin(s.t + time * 0.001 * s.s) * 0.45;
      ctx.globalAlpha = clamp(tw, 0.08, 1);
      if (warp > 0.02) {
        const dx = x - cx, dy = sy - cy, len = warp * s.z * 0.55;
        ctx.strokeStyle = s.c; ctx.lineWidth = s.r;
        ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + dx * len, sy + dy * len); ctx.stroke();
      } else if (Math.abs(vel) > 2 && !reduce) {
        ctx.fillStyle = s.c;
        const l = clamp(Math.abs(vel) * s.z * 0.9, 0, 60);
        ctx.fillRect(x, vel > 0 ? sy : sy - l, s.r, l + s.r);
      } else {
        ctx.fillStyle = s.c;
        ctx.fillRect(x, sy, s.r, s.r);
        if (s.spike) {
          ctx.globalAlpha *= 0.5;
          ctx.fillRect(x - 5, sy + s.r / 2 - 0.4, 10 + s.r, 0.8);
          ctx.fillRect(x + s.r / 2 - 0.4, sy - 5, 0.8, 10 + s.r);
        }
      }
    }
    if (!reduce && !shoot && Math.random() < 0.004) shoot = { x: Math.random() * w, y: Math.random() * h * 0.5, vx: -(6 + Math.random() * 5), vy: 2.5 + Math.random() * 2, life: 1 };
    if (shoot) {
      ctx.globalAlpha = shoot.life; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 12, shoot.y - shoot.vy * 12); ctx.stroke();
      shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.016;
      if (shoot.life <= 0) shoot = null;
    }
    ctx.globalAlpha = 1;
    if (running) requestAnimationFrame(frame);
  }

  build();
  addEventListener('resize', build);
  if (reduce) { frame(0); running = false; addEventListener('resize', () => frame(0)); }
  else requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });
  return {
    jump(ms = 650) { warpTarget = 1; setTimeout(() => { warpTarget = 0; }, ms); },
  };
})();

// ---------- jump to hyperspace on navigation ----------
const flash = document.getElementById('warp-flash');
function hyperspace(go) {
  if (reduce) { go(); return; }
  sky.jump(700);
  sfx.whoosh();
  if (flash) { flash.style.display = 'block'; flash.animate([{ opacity: 0 }, { opacity: 0.18, offset: 0.45 }, { opacity: 0 }], { duration: 900, easing: 'ease-out' }).onfinish = () => { flash.style.display = ''; }; }
  setTimeout(go, 380);
}
document.querySelectorAll('a[data-warp]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  const el = id === '#topo' ? document.body : document.querySelector(id);
  if (!el) return;
  e.preventDefault();
  hyperspace(() => {
    const top = id === '#topo' ? 0 : el.getBoundingClientRect().top + scrollY;
    scrollTo({ top, behavior: 'instant' });
    history.replaceState(null, '', id);
    (el.querySelector('h2') || el).setAttribute?.('tabindex', '-1');
    (el.querySelector('h2') || el).focus?.({ preventScroll: true });
  });
}));

// ---------- depth: layers that drift with the pointer and the scroll ----------
(() => {
  const els = [...document.querySelectorAll('[data-depth]')];
  if (reduce || !els.length) return;
  const base = new Map();
  const measure = () => els.forEach((el) => { el.style.transform = ''; const r = el.getBoundingClientRect(); base.set(el, r.top + scrollY + r.height / 2); });
  measure(); addEventListener('resize', measure);
  let mx = 0, my = 0;
  (function tick() {
    mx += (pointer.nx - mx) * 0.06; my += (pointer.ny - my) * 0.06;
    const mid = scrollY + innerHeight / 2;
    for (const el of els) {
      const d = +el.dataset.depth;
      const ty = (base.get(el) - mid) * d * 0.5 - my * d * 90;
      el.style.transform = `translate3d(${(-mx * d * 90).toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    }
    requestAnimationFrame(tick);
  })();
})();

// ---------- the pilot's ship: follows the pointer in the hero, boosts on click ----------
(() => {
  const ship = document.getElementById('pilot');
  const hero = document.querySelector('.hero');
  if (!ship || !hero) return;
  let x = innerWidth * 0.7, y = innerHeight * 0.72, vx = 0, vy = 0, face = 1, angle = 0, boost = 0, visible = true, inHero = false;
  hero.addEventListener('pointermove', () => { inHero = true; });
  hero.addEventListener('pointerleave', () => { inHero = false; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  ship.addEventListener('click', () => {
    boost = 1; vx += face * 2600;
    sfx.tone(180, 0.5, 'sawtooth', 0.04, 900);
  });
  let last = performance.now();
  (function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible) {
      const r = hero.getBoundingClientRect();
      const W = ship.offsetWidth, H = ship.offsetHeight;
      const t = now / 1000;
      let tx, ty;
      if (inHero && pointer.moved && !reduce) { tx = pointer.x - r.left + 60 * -face; ty = pointer.y - r.top + 40; }
      else { tx = r.width * (0.6 + Math.sin(t * 0.3) * 0.26); ty = r.height * (0.77 + Math.sin(t * 0.8) * 0.025); }
      if (reduce) { x = tx; y = ty; vx = vy = 0; }
      else {
        const k = 9, damp = 5.2;
        vx += ((tx - x) * k - vx * damp) * dt; vy += ((ty - y) * k - vy * damp) * dt;
        x += vx * dt; y += vy * dt;
      }
      if (x > r.width + W) x = -W; if (x < -W * 1.5) x = r.width + W * 0.5;
      if (Math.abs(vx) > 60) face = vx > 0 ? 1 : -1;
      angle += (clamp(vy * 0.03, -24, 24) * face - angle) * 0.12;
      boost = Math.max(0, boost - dt * 1.4);
      const thrust = 0.55 + clamp(Math.hypot(vx, vy) / 900, 0, 1) * 0.9 + boost;
      ship.style.setProperty('--thrust', thrust.toFixed(2));
      ship.style.transform = `translate3d(${(x - W / 2).toFixed(1)}px, ${(y - H / 2).toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg) scaleX(${face})`;
    }
    requestAnimationFrame(tick);
  })(last);
})();

// ---------- x-wing style fighters that cross the sky now and then ----------
(() => {
  if (reduce) return;
  const layer = document.createElement('div');
  layer.className = 'fighters'; layer.setAttribute('aria-hidden', 'true');
  document.body.prepend(layer);
  function sortie() {
    const fromLeft = Math.random() < 0.5, y0 = innerHeight * (0.15 + Math.random() * 0.6), y1 = y0 + (Math.random() - 0.5) * innerHeight * 0.4;
    const x0 = fromLeft ? -120 : innerWidth + 120, x1 = fromLeft ? innerWidth + 160 : -160;
    for (let i = 0; i < 2; i++) {
      const f = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      f.setAttribute('class', 'fighter'); f.innerHTML = '<use href="#ship-xfighter"/>';
      layer.append(f);
      const off = i * 46, dur = 2600 + Math.random() * 600, s = 0.55 + i * 0.2;
      f.animate([
        { transform: `translate(${x0}px, ${y0 + off}px) scale(${s}) rotate(${fromLeft ? 8 : -8}deg)` },
        { transform: `translate(${x1}px, ${y1 + off}px) scale(${s * 1.3}) rotate(${fromLeft ? -6 : 6}deg)` },
      ], { duration: dur, easing: 'cubic-bezier(.4,.1,.6,.9)', delay: i * 160 }).onfinish = () => f.remove();
      for (let b = 0; b < 3; b++) {
        const bolt = document.createElement('i'); bolt.className = 'bolt'; layer.append(bolt);
        const at = 0.25 + b * 0.18, bx = x0 + (x1 - x0) * at, by = y0 + (y1 - y0) * at + off + 20;
        const ang = Math.atan2(y1 - y0, x1 - x0);
        bolt.animate([
          { transform: `translate(${bx}px, ${by}px) rotate(${ang}rad)`, opacity: 1 },
          { transform: `translate(${bx + Math.cos(ang) * 900}px, ${by + Math.sin(ang) * 900}px) rotate(${ang}rad)`, opacity: 0 },
        ], { duration: 700, delay: i * 160 + dur * at, fill: 'both' }).onfinish = () => bolt.remove();
      }
    }
    setTimeout(sortie, 11000 + Math.random() * 9000);
  }
  setTimeout(sortie, 4500);
})();

// ---------- telescope reticle cursor ----------
(() => {
  const ret = document.getElementById('reticle');
  if (!fine || reduce || !ret) return;
  document.documentElement.classList.add('has-reticle');
  let rx = pointer.x, ry = pointer.y;
  (function tick() {
    rx += (pointer.x - rx) * 0.35; ry += (pointer.y - ry) * 0.35;
    ret.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(tick);
  })();
  document.addEventListener('pointerover', (e) => ret.classList.toggle('lock', !!e.target.closest?.('a, button, [role="button"], .tilt, .const-btn')));
  document.addEventListener('pointerleave', () => { ret.style.opacity = '0'; });
  document.addEventListener('pointerenter', () => { ret.style.opacity = ''; });
})();

// ---------- observatory readouts in the hero ----------
(() => {
  const coord = document.getElementById('coord'), clock = document.getElementById('clock');
  if (!coord || !clock) return;
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  addEventListener('pointermove', () => {
    const ra = (pointer.x / innerWidth) * 24, dec = 60 - (pointer.y / innerHeight) * 120;
    coord.textContent = `AR ${pad(ra)}h ${pad((ra % 1) * 60)}m · DEC ${dec >= 0 ? '+' : '−'}${pad(Math.abs(dec))}° ${pad((Math.abs(dec) % 1) * 60)}′`;
  }, { passive: true });
  const fmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const tick = () => { clock.textContent = `Serra, ES · ${fmt.format(new Date())}`; };
  tick(); setInterval(tick, 20000);
})();

// ---------- reveal as sections enter ----------
(() => {
  const targets = document.querySelectorAll('[data-reveal]');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  targets.forEach((el) => io.observe(el));
  addEventListener('load', () => setTimeout(() => targets.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in'); }), 2500));
})();

// ---------- tilt on cards ----------
(() => {
  if (!fine || reduce) return;
  document.querySelectorAll('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) translateZ(8px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();

// ---------- mission patches, drawn from their data ----------
(() => {
  const ICONS = {
    rocket: '<path d="M0 -30 C12 -18 12 6 8 18 L-8 18 C-12 6 -12 -18 0 -30 Z" fill="C"/><path d="M-8 8 L-18 22 L-8 18 Z M8 8 L18 22 L8 18 Z" fill="#e8412c"/><circle cy="-6" r="5" fill="#3d7bff" stroke="#07080d" stroke-width="2"/><path d="M-5 20 L0 32 L5 20 Z" fill="#ffb27a"/>',
    chat: '<path d="M-24 -18 H24 V12 H-4 L-16 24 V12 H-24 Z" fill="C"/><circle cx="-10" cy="-3" r="3.5" fill="#07080d"/><circle cy="-3" r="3.5" fill="#07080d"/><circle cx="10" cy="-3" r="3.5" fill="#07080d"/>',
    planet: '<circle r="16" fill="C"/><ellipse rx="30" ry="9" fill="none" stroke="#f4ead7" stroke-width="3.5" transform="rotate(-18)"/><circle cx="-6" cy="-5" r="4" fill="#07080d" opacity=".25"/>',
    dish: '<path d="M-22 -10 C-22 14 22 14 22 -10 Z" fill="C"/><path d="M0 4 L0 -22" stroke="C" stroke-width="3"/><circle cy="-24" r="4" fill="#e8412c"/><path d="M-10 18 H10 L6 26 H-6 Z" fill="#9aa6bd"/>',
    star: '<path d="M0 -26 L7 -8 L26 -8 L11 4 L17 24 L0 12 L-17 24 L-11 4 L-26 -8 L-7 -8 Z" fill="C"/>',
    moon: '<circle r="22" fill="C"/><circle cx="10" cy="-6" r="20" fill="#0c0f17"/>',
  };
  let n = 0;
  document.querySelectorAll('[data-patch]').forEach((el) => {
    const id = `arc${n++}`, color = el.dataset.color, icon = (ICONS[el.dataset.icon] || ICONS.star).replaceAll('"C"', `"${color}"`);
    el.innerHTML = `<svg viewBox="-70 -70 140 140" aria-hidden="true">
      <circle r="66" fill="#07080d"/><circle r="62" fill="#161b29" stroke="${color}" stroke-width="5"/>
      <circle r="40" fill="#0c0f17" stroke="#07080d" stroke-width="3"/>
      <path id="${id}" d="M-51 0 A51 51 0 1 1 51 0 A51 51 0 1 1 -51 0" fill="none"/>
      <text font-family="Panchang" font-weight="800" font-size="10.5" fill="${color}" letter-spacing="1.5"><textPath href="#${id}" startOffset="25%" text-anchor="middle">${el.dataset.patch}</textPath></text>
      <g fill="#eef1f7"><circle cx="-46" cy="22" r="2"/><circle cx="46" cy="22" r="2"/><circle cx="0" cy="54" r="2.4"/></g>
      <g stroke="#07080d" stroke-width="2.5" stroke-linejoin="round">${icon}</g>
    </svg>`;
  });
})();

// ---------- pilot's license: drag it around, click to flip ----------
(() => {
  const card = document.getElementById('license');
  if (!card) return;
  const bars = document.getElementById('barcode');
  let bx = 0, seed = 7;
  while (bx < 200) { seed = (seed * 9301 + 49297) % 233280; const wv = 1 + (seed % 4); bars.insertAdjacentHTML('beforeend', `<rect x="${bx}" y="0" width="${wv}" height="24"/>`); bx += wv + 1 + (seed % 3); }
  let flipped = false, dx = 0, dy = 0, startX, startY, moved = false, dragging = false, rx = 0, ry = 0;
  const apply = () => { card.style.transform = `translate(${dx}px, ${dy}px) rotateX(${rx}deg) rotateY(${(flipped ? 180 : 0) + ry}deg)`; };
  const flip = () => { flipped = !flipped; card.setAttribute('aria-pressed', String(flipped)); sfx.tone(520, 0.12, 'triangle', 0.04, 780); apply(); };
  card.addEventListener('pointerdown', (e) => { dragging = true; moved = false; startX = e.clientX - dx; startY = e.clientY - dy; card.setPointerCapture(e.pointerId); card.classList.add('dragging'); });
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    if (!dragging) {
      if (!fine || reduce) return;
      ry = ((e.clientX - r.left) / r.width - 0.5) * 18; rx = -((e.clientY - r.top) / r.height - 0.5) * 14; card.classList.add('dragging'); apply(); return;
    }
    const ndx = e.clientX - startX, ndy = e.clientY - startY;
    if (Math.hypot(ndx - dx, ndy - dy) > 3) moved = true;
    dx = clamp(ndx, -innerWidth * 0.4, innerWidth * 0.4); dy = clamp(ndy, -260, 260);
    ry = clamp(e.movementX * 2, -25, 25); rx = clamp(-e.movementY * 2, -25, 25); apply();
  });
  const end = () => { if (!dragging) return; dragging = false; card.classList.remove('dragging'); rx = ry = 0; if (!moved) flip(); else apply(); };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
  card.addEventListener('pointerleave', () => { if (!dragging) { rx = ry = 0; card.classList.remove('dragging'); apply(); } });
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
})();

// ---------- the observatory: fly through the 1975 paintings ----------
(() => {
  const section = document.getElementById('observatorio');
  const slides = [...document.querySelectorAll('.slide')];
  const title = section?.querySelector('.obs-title');
  const cap = document.getElementById('obs-cap');
  if (!section || !slides.length || reduce) return;
  const GAP = 900, N = slides.length;
  const pos = slides.map((_, i) => ({ x: (i % 2 ? 1 : -1) * (14 + ((i * 7) % 11)), y: ((i * 37) % 34) - 17 }));
  let current = -1;
  function update() {
    const r = section.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    const travel = (N - 1) * GAP + 1100;
    const narrow = innerWidth < 640 ? 0.55 : 1;
    let best = -1, bestD = 1e9;
    slides.forEach((s, i) => {
      const z = -i * GAP - 250 + p * travel;
      const op = clamp((z + 7200) / 2400, 0, 1) * clamp((700 - z) / 500, 0, 1);
      s.style.opacity = op.toFixed(3);
      s.style.visibility = op < 0.01 ? 'hidden' : 'visible';
      s.style.transform = `translate3d(calc(-50% + ${pos[i].x * narrow}vw), calc(-50% + ${pos[i].y}vh), ${z.toFixed(0)}px)`;
      const d = Math.abs(z - 150);
      if (op > 0.5 && d < bestD && s.dataset.cap) { bestD = d; best = i; }
    });
    if (title) { title.style.opacity = clamp(1 - p * 7, 0, 1); title.style.transform = `translate3d(0, ${-p * 400}px, 0)`; }
    if (best !== current) { current = best; cap.textContent = best >= 0 && p > 0.06 ? slides[best].dataset.cap : ''; }
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();

// ---------- constellations of tools ----------
(() => {
  const map = document.getElementById('sky-map'), panel = document.getElementById('const-panel');
  if (!map) return;
  const GROUPS = [
    { name: 'AWS', at: [300, 140], items: [['ECS Fargate com autoscaling', 'Conduit'], ['RDS Postgres Multi-AZ', 'Conduit'], ['CloudFront, S3, ALB e WAF', 'Conduit'], ['Secrets Manager e CloudWatch', 'Conduit'], ['Amazon Managed Grafana', 'Workstage']] },
    { name: 'Infra como código', at: [520, 110], items: [['Terraform, 7 módulos e 66 resources', 'Conduit'], ['Charts Helm', 'LEDS'], ['State em S3 com lock no DynamoDB', 'Conduit']] },
    { name: 'Kubernetes', at: [800, 190], items: [['RKE2', 'LEDS'], ['MinIO e MariaDB em cluster', 'LEDS'], ['Docker', 'Tudo']] },
    { name: 'CI/CD', at: [450, 320], items: [['GitHub Actions com OIDC, zero access keys', 'Conduit'], ['SonarQube com Quality Gate antes do CD', 'Otto'], ['Ruff e testes no pipeline', 'Otto']] },
    { name: 'Observabilidade', at: [690, 400], items: [['Grafana e Prometheus', 'LEDS'], ['Exporters de pfSense e Proxmox', 'LEDS'], ['Alarmes no CloudWatch', 'Conduit']] },
    { name: 'Redes', at: [250, 470], items: [['pfSense e OpenVPN', 'LEDS'], ['NetBird e Cloudflare WARP', 'LEDS']] },
    { name: 'Linguagens', at: [430, 560], items: [['Python', 'Otto, Conduit'], ['Java e JavaScript', 'IFES'], ['PHP e SQL', 'IFES']] },
    { name: 'Sistemas', at: [860, 560], items: [['Arch Linux com Hyprland', 'Em casa'], ['Ubuntu e Proxmox', 'LEDS']] },
  ];
  const phone = () => innerWidth < 640;
  let seed = 3;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const shapes = GROUPS.map((g) => {
    const pts = g.items.map((_, i) => {
      const a = (i / g.items.length) * Math.PI * 2 + rnd() * 0.9, r = 46 + rnd() * 52;
      return [g.at[0] + Math.cos(a) * r * 1.25, g.at[1] + Math.sin(a) * r * 0.8];
    });
    return pts.sort((p, q) => p[0] - q[0]);
  });
  function render() {
    const H = phone() ? 1200 : 700, sy = H / 700;
    let svg = `<svg viewBox="0 -20 1000 ${H + 40}" aria-hidden="true">`;
    for (let i = 0; i < 140; i++) svg += `<circle cx="${(rnd() * 1000).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(rnd() * 1.4 + 0.3).toFixed(1)}" fill="#5b6680"/>`;
    shapes.forEach((pts, gi) => {
      const P = pts.map(([x, y]) => [x, y * sy]);
      svg += `<g class="group" data-g="${gi}">`;
      for (let i = 1; i < P.length; i++) svg += `<line class="link-line" x1="${P[i - 1][0]}" y1="${P[i - 1][1]}" x2="${P[i][0]}" y2="${P[i][1]}"/>`;
      P.forEach(([x, y], k) => { svg += `<circle class="halo" cx="${x}" cy="${y}" r="18"/><circle class="star${k % 2 ? ' twinkle' : ''}" cx="${x}" cy="${y}" r="7" style="animation-delay:${(k * 0.7).toFixed(1)}s"/>`; });
      svg += '</g>';
    });
    svg += '</svg>';
    map.innerHTML = svg + GROUPS.map((g, i) => `<button type="button" class="const-btn" data-g="${i}" aria-pressed="false" style="left:${g.at[0] / 10}%;top:${((g.at[1] * sy + 20 + 84 * sy) / (H + 40)) * 100}%">${g.name}</button>`).join('')
      + '<a class="map-egg" href="jogo.html" aria-label="Um invasor escondido entre as estrelas. Siga para o jogo secreto"><svg viewBox="0 0 11 8"><use href="#invader"/></svg></a>';
    map.querySelectorAll('.const-btn').forEach((b) => {
      const pick = () => select(+b.dataset.g);
      b.addEventListener('click', pick); b.addEventListener('pointerenter', pick); b.addEventListener('focus', pick);
    });
    select(current);
  }
  let current = 0;
  function select(i) {
    current = i;
    map.querySelectorAll('.group').forEach((g) => g.classList.toggle('on', +g.dataset.g === i));
    map.querySelectorAll('.const-btn').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.g === i)));
    const g = GROUPS[i];
    panel.innerHTML = `<h3>${g.name}</h3><ul>${g.items.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join('')}</ul>`;
  }
  render();
  let wasPhone = phone();
  addEventListener('resize', () => { if (phone() !== wasPhone) { wasPhone = phone(); seed = 3; render(); } });
})();

// ---------- easter egg: the Konami code, or the invaders hiding on the page ----------
(() => {
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let at = 0;
  const go = () => hyperspace(() => { location.href = 'jogo.html'; });
  addEventListener('keydown', (e) => {
    at = e.code === code[at] ? at + 1 : e.code === code[0] ? 1 : 0;
    if (at === code.length) { at = 0; go(); }
  });
  document.addEventListener('click', (e) => {
    const egg = e.target.closest?.('.egg, .map-egg');
    if (!egg) return;
    e.preventDefault(); go();
  });
})();

// ---------- loops play only while on screen; copy the address ----------
(() => {
  const vids = document.querySelectorAll('video.autoplay');
  if (reduce) return;
  const io = new IntersectionObserver((es) => es.forEach(({ target, isIntersecting }) => (isIntersecting ? target.play().catch(() => {}) : target.pause())), { threshold: 0.2 });
  vids.forEach((v) => io.observe(v));
})();
(() => {
  const mail = document.querySelector('.mail');
  if (!mail) return;
  const fit = () => {
    if (innerWidth < 640) { mail.style.fontSize = ''; return; }
    mail.style.fontSize = '100px';
    const w = mail.scrollWidth, box = mail.parentElement.clientWidth - parseFloat(getComputedStyle(mail.parentElement).paddingLeft) * 2;
    mail.style.fontSize = `${Math.floor((100 * box) / w)}px`;
  };
  document.fonts.ready.then(fit); addEventListener('resize', fit);
})();
document.getElementById('copy')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try { await navigator.clipboard.writeText(btn.dataset.mail); btn.textContent = 'E-mail copiado'; } catch { btn.textContent = btn.dataset.mail; }
  setTimeout(() => { btn.textContent = 'Copiar e-mail'; }, 2400);
});
