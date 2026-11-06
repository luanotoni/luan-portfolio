const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, at: 0 };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.nx = e.clientX / innerWidth - 0.5; pointer.ny = e.clientY / innerHeight - 0.5;
  pointer.at = performance.now();
}, { passive: true });

// ---------- sound: off until the visitor turns it on ----------
const sfx = (() => {
  let ctx = null, on = false;
  const btn = document.getElementById('sfx');
  const ensure = () => (ctx ??= new AudioContext());
  function tone(freq, dur, type = 'sine', vol = 0.03, slide = 0, delay = 0) {
    if (!on) return;
    const a = ensure(), t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  const chirp = (n = 3) => { for (let i = 0; i < n; i++) tone(900 + Math.random() * 1500, 0.07, 'square', 0.018, 600 + Math.random() * 2200, i * 0.09); };
  btn?.addEventListener('click', () => {
    on = !on; btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Som ligado' : 'Som';
    if (on) { ensure().resume(); chirp(2); }
  });
  window.sfx = { tone, chirp };
  return { tone, chirp };
})();

// ---------- the sky: stars, a little parallax, and the ship's ion trail ----------
const sky = (() => {
  const canvas = document.getElementById('sky');
  if (!canvas) return { jump() {}, trail: [] };
  const ctx = canvas.getContext('2d');
  const ink = css('--color-ink') || 'white', warm = css('--color-glow') || ink, trailInk = css('--color-accent') || ink;
  let w, h, stars = [], warp = 0, warpTarget = 0, running = true, shoot = null;
  const trail = [];
  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round((w * h) / 2200) }, (_, i) => {
      const layer = i % 10 < 7 ? 0 : i % 10 < 9 ? 1 : 2;
      return { x: Math.random() * w, y: Math.random() * h, z: [0.15, 0.45, 1][layer], r: [0.7, 1.1, 1.6][layer], t: Math.random() * 6.28, s: 0.4 + Math.random() * 1.2, c: Math.random() < 0.12 ? warm : ink };
    });
  }
  function frame(time) {
    warp += (warpTarget - warp) * 0.08;
    ctx.clearRect(0, 0, w, h);
    const y = scrollY, cx = w / 2, cy = h / 2;
    for (const s of stars) {
      const x = ((s.x + pointer.nx * s.z * -18) % w + w) % w;
      const sy = (((s.y - y * s.z * 0.1 + pointer.ny * s.z * -18) % h) + h) % h;
      ctx.globalAlpha = reduce ? 0.7 : clamp(0.45 + Math.sin(s.t + time * 0.001 * s.s) * 0.35, 0.08, 1);
      if (warp > 0.02) {
        const len = warp * s.z * 0.5;
        ctx.strokeStyle = s.c; ctx.lineWidth = s.r;
        ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + (x - cx) * len, sy + (sy - cy) * len); ctx.stroke();
      } else { ctx.fillStyle = s.c; ctx.fillRect(x, sy, s.r, s.r); }
    }
    if (!reduce && !shoot && Math.random() < 0.003) shoot = { x: w * (0.3 + Math.random() * 0.7), y: Math.random() * h * 0.5, vx: -(7 + Math.random() * 5), vy: 2 + Math.random() * 2, life: 1 };
    if (shoot) {
      ctx.globalAlpha = shoot.life; ctx.strokeStyle = ink; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 12, shoot.y - shoot.vy * 12); ctx.stroke();
      shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.018;
      if (shoot.life <= 0) shoot = null;
    }
    if (trail.length > 1) {
      ctx.lineCap = 'round'; ctx.strokeStyle = trailInk;
      for (let i = 1; i < trail.length; i++) {
        const k = i / trail.length;
        ctx.globalAlpha = k * 0.35; ctx.lineWidth = k * 2;
        ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1] - y); ctx.lineTo(trail[i][0], trail[i][1] - y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (running) requestAnimationFrame(frame);
  }
  build();
  addEventListener('resize', build);
  if (reduce) { running = false; frame(0); addEventListener('resize', () => frame(0)); }
  else requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (reduce) return; running = !document.hidden; if (running) requestAnimationFrame(frame); });
  return { jump(ms = 600) { warpTarget = 1; setTimeout(() => { warpTarget = 0; }, ms); }, trail };
})();

// ---------- a short jump to hyperspace on in-page navigation ----------
function hyperspace(go) {
  dispatchEvent(new Event('hyperspace'));
  if (reduce) { go(); return; }
  sky.jump(600);
  sfx.tone(220, 0.5, 'sawtooth', 0.02, 1400);
  setTimeout(go, 320);
}
function travel(id) {
  const el = id === '#topo' ? document.body : document.querySelector(id);
  if (!el) return false;
  hyperspace(() => {
    scrollTo({ top: id === '#topo' ? 0 : el.getBoundingClientRect().top + scrollY, behavior: 'instant' });
    history.replaceState(null, '', id);
    const h = el.querySelector?.('h2') || el;
    h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
  });
  return true;
}
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[data-warp]');
  if (a && travel(a.getAttribute('href'))) e.preventDefault();
});

// ---------- projects, read live from GitHub on every visit ----------
const projects = (() => {
  const USER = 'luanotoni';
  const KEY = 'gh-repos-v1', FRESH = 30 * 60 * 1000;
  const NEXT = ['proximo', 'em-construcao'], CONTROL = ['destaque', 'oculto', ...NEXT];
  // Optional extras for a repo: a Portuguese title and text, pictures. Everything else comes from GitHub.
  const EXTRA = {
    'conduit-aws-terraform': {
      title: 'Conduit na AWS',
      text: 'Um app Django de 2017, levado do 1.10 ao 5.2 e posto em ECS Fargate, RDS Multi-AZ, CloudFront e WAF. Sete módulos Terraform e deploy por GitHub Actions com OIDC, sem nenhuma access key.',
      img: 'assets/web/conduit-48.webp', alt: 'Mapa da VPC do Conduit: sub-redes públicas e privadas, load balancer, tarefas Fargate e RDS em duas zonas',
      video: 'assets/conduit-demo-loop.mp4', poster: 'assets/web/conduit-demo-poster.webp', caption: 'O vídeo de lançamento, com crawl e trilha própria.',
    },
    'varal-de-pedidos': { title: 'Varal de Pedidos', text: 'Mural web de issues e pedidos. O deploy saiu do ar; o código continua no GitHub.', hideSite: true },
  };
  const box = document.getElementById('repos'), when = document.getElementById('gh-when'), pulse = document.getElementById('pulse');
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ago = (iso) => {
    const s = (new Date(iso) - Date.now()) / 1000;
    for (const [u, n] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
    return 'agora';
  };
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} } };

  async function load() {
    const cached = store.get();
    if (cached && Date.now() - cached.t < FRESH) return { repos: cached.repos, from: 'live', t: cached.t };
    try {
      const r = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(r.status);
      const repos = await r.json();
      store.set({ t: Date.now(), repos });
      return { repos, from: 'live', t: Date.now() };
    } catch {
      if (cached) return { repos: cached.repos, from: 'cache', t: cached.t };
      const snap = await fetch('assets/repos.json').then((r) => r.json()).catch(() => null);
      return snap ? { repos: snap.repos, from: 'snapshot', t: Date.parse(snap.saved) } : null;
    }
  }

  const tags = (r) => (r.topics || []).filter((t) => !CONTROL.includes(t)).slice(0, 6);
  function facts(r) {
    const f = [];
    if (r.language) f.push(['Linguagem', esc(r.language)]);
    f.push(['Último push', `<time datetime="${r.pushed_at}">${ago(r.pushed_at)}</time>`]);
    if (r.stargazers_count) f.push(['Estrelas', r.stargazers_count]);
    return `<dl class="facts">${f.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`;
  }
  function feature(r) {
    const x = EXTRA[r.name] || {};
    const media = x.img
      ? `<div class="feature-media"><img src="${x.img}" width="900" height="1125" alt="${esc(x.alt)}" loading="lazy">${x.video ? `<figure><video muted loop playsinline preload="none" poster="${x.poster}" width="540" height="676" aria-label="Trecho do vídeo de ${esc(x.title || r.name)}"><source src="${x.video}" type="video/mp4"></video><figcaption>${esc(x.caption)}</figcaption></figure>` : ''}</div>`
      : `<div class="feature-type" aria-hidden="true"><span class="big">${esc(r.name.replace(/-/g, ' '))}</span><span class="lang">${esc(r.language || '')}</span></div>`;
    const site = r.homepage && !x.hideSite ? `<a href="${esc(r.homepage)}" target="_blank" rel="noopener">Ver no ar</a>` : '';
    const t = tags(r);
    return `<article class="feature" data-scan>${media}<div class="feature-text">
      <h3>${esc(x.title || r.name)}</h3><p class="repo-id">${esc(r.name)}</p>
      <p>${esc(x.text || r.description || 'Sem descrição no GitHub ainda.')}</p>
      ${t.length ? `<ul class="tags" aria-label="Tópicos">${t.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      ${facts(r)}
      <div class="feature-links"><a class="button" href="${esc(r.html_url)}" target="_blank" rel="noopener">Abrir o repositório</a>${site}</div>
    </div></article>`;
  }
  function row(r) {
    const x = EXTRA[r.name] || {};
    return `<li class="repo" data-scan><h3><a href="${esc(r.html_url)}" target="_blank" rel="noopener">${esc(r.name)}</a></h3>
      <p>${esc(x.text || r.description || 'Sem descrição no GitHub ainda.')}</p>
      <p class="repo-meta">${r.language ? `<span>${esc(r.language)}</span>` : ''}<span>push <time datetime="${r.pushed_at}">${ago(r.pushed_at)}</time></span></p></li>`;
  }
  function render({ repos, from, t }) {
    const shown = repos.filter((r) => !r.fork && !r.archived && r.name !== USER && !(r.topics || []).includes('oculto'));
    if (!shown.length) return;
    const next = shown.filter((r) => (r.topics || []).some((s) => NEXT.includes(s)));
    const pool = shown.filter((r) => !next.includes(r));
    const picked = pool.filter((r) => (r.topics || []).includes('destaque'));
    const top = picked.length ? picked : [...pool].sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at)).slice(0, 1);
    const rest = pool.filter((r) => !top.includes(r)).sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at));
    box.innerHTML = top.map(feature).join('')
      + `<div class="more"><h3 class="more-h">Outros repositórios</h3><div class="more-body"><ol class="repo-list">${rest.map(row).join('')}${next.length ? next.map((r) => row(r).replace('<li class="repo"', '<li class="repo next"').replace('<h3>', '<h3>Próximo: ')).join('') : '<li class="repo next"><h3>Próximo</h3><p>Nada novo na rampa de lançamento ainda. Estudando agora: DevSecOps e segurança.</p></li>'}</ol></div></div>`;
    if (when) when.textContent = from === 'live' ? 'a cada visita' : `na última leitura, ${ago(new Date(t).toISOString())}`;
    const last = [...shown].sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at))[0];
    if (pulse && last) pulse.innerHTML = `Último push em <a href="${esc(last.html_url)}" target="_blank" rel="noopener">${esc(last.name)}</a>, ${ago(last.pushed_at)}.`;
    playLoops(box);
    window.ghData = { shown, last };
    document.dispatchEvent(new CustomEvent('projects', { detail: window.ghData }));
  }
  const ready = box ? load().then((d) => { if (d) render(d); return d; }) : Promise.resolve(null);
  return { ready };
})();

// ---------- planets drift a little with the pointer and the scroll ----------
(() => {
  const els = [...document.querySelectorAll('[data-depth]')];
  if (reduce || !els.length) return;
  const base = new Map();
  const measure = () => els.forEach((el) => { el.style.transform = ''; const r = el.getBoundingClientRect(); base.set(el, r.top + scrollY + r.height / 2); });
  addEventListener('load', measure); addEventListener('resize', measure); measure();
  let mx = 0, my = 0;
  (function tick() {
    mx += (pointer.nx - mx) * 0.05; my += (pointer.ny - my) * 0.05;
    const mid = scrollY + innerHeight / 2;
    for (const el of els) {
      const d = +el.dataset.depth, c = base.get(el);
      if (Math.abs(c - mid) > innerHeight * 1.6) continue;
      el.style.transform = `translate3d(${(-mx * d * 80).toFixed(1)}px, ${((c - mid) * d * 0.45 - my * d * 80).toFixed(1)}px, 0)`;
    }
    requestAnimationFrame(tick);
  })();
})();

// ---------- the route rail: a tiny ship marks where you are on the trip ----------
(() => {
  const route = document.getElementById('route'), marker = document.getElementById('route-ship');
  if (!route) return;
  const links = [...route.querySelectorAll('a')];
  const stops = links.map((a) => document.querySelector(a.getAttribute('href') === '#topo' ? '#topo' : a.getAttribute('href')));
  function update() {
    const y = scrollY + innerHeight * 0.4;
    let i = 0;
    stops.forEach((s, k) => { if (s && s.getBoundingClientRect().top + scrollY <= y) i = k; });
    links.forEach((a, k) => a.setAttribute('aria-current', String(k === i)));
    if (marker) {
      const a = links[i], b = links[Math.min(i + 1, links.length - 1)];
      const s0 = stops[i].getBoundingClientRect().top + scrollY, s1 = i + 1 < stops.length ? stops[i + 1].getBoundingClientRect().top + scrollY : s0 + 1;
      const t = clamp((y - s0) / Math.max(1, s1 - s0), 0, 1);
      const top = a.offsetTop + (b.offsetTop - a.offsetTop) * t + 12;
      marker.style.transform = `translateY(${top.toFixed(1)}px) translateY(-50%) rotate(90deg)`;
    }
  }
  addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); addEventListener('load', update); update();
})();

// ---------- loops play only while on screen ----------
function playLoops(scope) {
  if (reduce) return;
  const io = new IntersectionObserver((es) => es.forEach(({ target, isIntersecting }) => (isIntersecting ? target.play().catch(() => {}) : target.pause())), { threshold: 0.2 });
  scope.querySelectorAll('video').forEach((v) => io.observe(v));
}

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
      ry = ((e.clientX - r.left) / r.width - 0.5) * 16; rx = -((e.clientY - r.top) / r.height - 0.5) * 12; card.classList.add('dragging'); apply(); return;
    }
    const ndx = e.clientX - startX, ndy = e.clientY - startY;
    if (Math.hypot(ndx - dx, ndy - dy) > 3) moved = true;
    dx = clamp(ndx, -innerWidth * 0.3, innerWidth * 0.3); dy = clamp(ndy, -200, 200);
    ry = clamp(e.movementX * 2, -25, 25); rx = clamp(-e.movementY * 2, -25, 25); apply();
  });
  const end = () => { if (!dragging) return; dragging = false; card.classList.remove('dragging'); rx = ry = 0; if (!moved) flip(); else apply(); };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
  card.addEventListener('pointerleave', () => { if (!dragging) { rx = ry = 0; card.classList.remove('dragging'); apply(); } });
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
})();

// ---------- constellations of tools ----------
(() => {
  const map = document.getElementById('sky-map'), panel = document.getElementById('const-panel');
  if (!map) return;
  const GROUPS = [
    { name: 'AWS', at: [300, 140], items: [['ECS Fargate com autoscaling', 'Conduit'], ['RDS Postgres Multi-AZ', 'Conduit'], ['CloudFront, S3, ALB e WAF', 'Conduit'], ['Secrets Manager e CloudWatch', 'Conduit'], ['Amazon Managed Grafana', 'Workstage']] },
    { name: 'Infra como código', at: [540, 110], items: [['Terraform em 7 módulos', 'Conduit'], ['Charts Helm', 'LEDS'], ['State em S3 com lock no DynamoDB', 'Conduit']] },
    { name: 'Kubernetes', at: [800, 190], items: [['RKE2', 'LEDS'], ['MinIO e MariaDB em cluster', 'LEDS'], ['Docker', 'Tudo']] },
    { name: 'CI/CD', at: [450, 320], items: [['GitHub Actions com OIDC', 'Conduit'], ['SonarQube com Quality Gate', 'Otto'], ['Ruff e testes no pipeline', 'Otto']] },
    { name: 'Observabilidade', at: [700, 400], items: [['Grafana e Prometheus', 'LEDS'], ['Exporters de pfSense e Proxmox', 'LEDS'], ['Alarmes no CloudWatch', 'Conduit']] },
    { name: 'Redes', at: [250, 470], items: [['pfSense e OpenVPN', 'LEDS'], ['NetBird e Cloudflare WARP', 'LEDS']] },
    { name: 'Linguagens', at: [450, 560], items: [['Python', 'Otto, Conduit'], ['Java e JavaScript', 'IFES'], ['PHP e SQL', 'IFES']] },
    { name: 'Sistemas', at: [830, 560], items: [['Arch Linux com Hyprland', 'Em casa'], ['Ubuntu e Proxmox', 'LEDS']] },
  ];
  const phone = () => innerWidth < 640;
  let seed = 3;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const shapes = GROUPS.map((g) => g.items.map((_, i) => {
    const a = (i / g.items.length) * Math.PI * 2 + rnd() * 0.9, r = 46 + rnd() * 52;
    return [g.at[0] + Math.cos(a) * r * 1.25, g.at[1] + Math.sin(a) * r * 0.8];
  }).sort((p, q) => p[0] - q[0]));
  let current = 0;
  function render() {
    const H = phone() ? 1200 : 700, sy = H / 700;
    let svg = `<svg viewBox="0 -20 1000 ${H + 40}" aria-hidden="true">`;
    for (let i = 0; i < 90; i++) svg += `<circle class="dust" cx="${(rnd() * 1000).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(rnd() * 1.3 + 0.3).toFixed(1)}"/>`;
    shapes.forEach((pts, gi) => {
      const P = pts.map(([x, y]) => [x, y * sy]);
      svg += `<g class="group" data-g="${gi}">`;
      for (let i = 1; i < P.length; i++) svg += `<line class="link-line" x1="${P[i - 1][0]}" y1="${P[i - 1][1]}" x2="${P[i][0]}" y2="${P[i][1]}"/>`;
      P.forEach(([x, y]) => { svg += `<circle class="star" cx="${x}" cy="${y}" r="6"/>`; });
      svg += '</g>';
    });
    map.innerHTML = svg + '</svg>' + GROUPS.map((g, i) => `<button type="button" class="const-btn" data-g="${i}" aria-pressed="false" style="left:${g.at[0] / 10}%;top:${((g.at[1] * sy + 20 + 84 * sy) / (H + 40)) * 100}%">${g.name}</button>`).join('')
      + '<a class="map-egg" href="jogo.html" aria-label="Um invasor escondido entre as estrelas. Siga para o jogo secreto"><svg viewBox="0 0 11 8" aria-hidden="true"><use href="#invader"/></svg></a>';
    map.querySelectorAll('.const-btn').forEach((b) => {
      const pick = () => select(+b.dataset.g);
      b.addEventListener('click', () => select(+b.dataset.g, true)); b.addEventListener('focus', pick); if (fine) b.addEventListener('pointerenter', pick);
    });
    select(current);
  }
  function select(i, picked = false) {
    current = i;
    map.querySelectorAll('.group').forEach((g) => g.classList.toggle('on', +g.dataset.g === i));
    map.querySelectorAll('.const-btn').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.g === i)));
    const g = GROUPS[i];
    document.dispatchEvent(new CustomEvent('constellation', { detail: { name: g.name, items: g.items, picked: !!picked } }));
    panel.innerHTML = `<h3>${g.name}</h3><ul>${g.items.map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join('')}</ul>`;
  }
  render();
  let wasPhone = phone();
  addEventListener('resize', () => { if (phone() !== wasPhone) { wasPhone = phone(); seed = 3; render(); } });
  window.toolGroups = GROUPS;
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
    if (!e.target.closest?.('.egg, .map-egg')) return;
    e.preventDefault(); go();
  });
})();

// ---------- the jump dialog: "/" or the Saltar button, type a destination, Enter jumps ----------
(() => {
  const dlg = document.getElementById('navi'), q = document.getElementById('navi-q'), list = document.getElementById('navi-list'), openBtn = document.getElementById('navi-open');
  if (!dlg || !q || !list) return;
  const go = (id) => () => travel(id);
  const ITEMS = [
    ['Início', 'o nome e a Lua', go('#topo')],
    ['Sobre', 'quem pilota', go('#sobre')],
    ['Projetos', 'lidos do GitHub', go('#projetos')],
    ['Observatório', 'telescópio e rover', go('#observatorio')],
    ['LEDS', 'registros de missão', go('#leds')],
    ['Ferramentas', 'as constelações', go('#ferramentas')],
    ['Contato', 'e-mail e redes', go('#contato')],
    ['Abrir o GitHub', 'github.com/luanotoni', () => open('https://github.com/luanotoni', '_blank', 'noopener')],
    ['Copiar o e-mail', 'luan.otoni.dev@gmail.com', () => navigator.clipboard?.writeText('luan.otoni.dev@gmail.com')],
    ['Ligar ou desligar o som', 'bipes e lasers', () => document.getElementById('sfx')?.click()],
    ...(matchMedia('(prefers-reduced-motion: reduce)').matches ? [] : [['Chamar os stormtroopers', 'um esquadrão do Império', () => document.dispatchEvent(new CustomEvent('imperio', { detail: 'tropa' }))],
    ['Chamar o Vader', matchMedia('(hover: hover) and (pointer: fine)').matches ? 'ele traz o sabre' : 'toque nele pra desintegrar', () => document.dispatchEvent(new CustomEvent('imperio', { detail: 'lorde' }))],
    ['Estação de batalha', 'carregar o superlaser', () => { travel('#topo'); setTimeout(() => document.dispatchEvent(new CustomEvent('imperio', { detail: 'estacao' })), 900); }]]),
    ['Defesa da VPC', 'o jogo escondido', () => hyperspace(() => { location.href = 'jogo.html'; })],
  ];
  const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let shown = ITEMS, at = 0;
  function render() {
    const t = norm(q.value.trim());
    shown = ITEMS.filter(([a, b]) => !t || norm(a + ' ' + b).includes(t));
    at = Math.min(at, Math.max(0, shown.length - 1));
    list.innerHTML = shown.length ? shown.map(([a, b], i) => `<li role="option" id="navi-${i}" aria-selected="${i === at}"><span>${a}</span><span>${b}</span></li>`).join('') : '<li role="option" aria-disabled="true"><span>Nenhum destino com esse nome</span></li>';
    if (shown.length) q.setAttribute('aria-activedescendant', `navi-${at}`);
  }
  function pickAt(i) { const it = shown[i]; if (!it) return; dlg.close(); setTimeout(it[2], 60); }
  // the dialog sits in the top layer; carry the pixel layer (the ship cursor) into it while it is open
  const carry = (into) => { const arena = document.querySelector('.arena'); if (arena) (into ? dlg : document.body).append(arena); };
  dlg.addEventListener('close', () => carry(false));
  function openNavi() { if (dlg.open) return; q.value = ''; at = 0; render(); dlg.showModal(); carry(true); q.focus(); window.sfx?.tone(660, 0.12, 'sine', 0.03, 990); }
  openBtn?.addEventListener('click', openNavi);
  addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, [contenteditable]');
    if (!dlg.open && !typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); openNavi(); }
  });
  q.addEventListener('input', () => { at = 0; render(); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); at = (at + 1) % Math.max(1, shown.length); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); at = (at - 1 + shown.length) % Math.max(1, shown.length); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); pickAt(at); }
  });
  list.addEventListener('click', (e) => { const li = e.target.closest('li[id]'); if (li) pickAt(+li.id.split('-')[1]); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
})();

document.getElementById('copy')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try { await navigator.clipboard.writeText(btn.dataset.mail); btn.textContent = 'E-mail copiado'; document.dispatchEvent(new CustomEvent('copied', { detail: btn.dataset.mail })); } catch { btn.textContent = btn.dataset.mail; }
  setTimeout(() => { btn.textContent = 'Copiar e-mail'; }, 2400);
});
