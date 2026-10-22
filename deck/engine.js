(() => {
  const PRESENTER = new URLSearchParams(location.search).has('presenter');
  let bc = null; try { bc = new BroadcastChannel('deck-' + document.title); } catch (e) {}
  const deck = document.getElementById('deck');
  const slides = [...deck.querySelectorAll('.slide')];
  const hud = { sec: document.querySelector('#hud .sec'), num: document.querySelector('#hud .num'), dots: document.querySelector('#hud .dots') };
  const bar = document.getElementById('bar');
  const notes = document.getElementById('notes');
  const ov = document.getElementById('overview');

  // ----- build step groups per slide -----
  const groups = slides.map(s => {
    const els = [...s.querySelectorAll('.step, .trigger, .codestep')].filter(e => !e.closest('.notes'));
    const g = [];
    els.forEach(e => { if (e.hasAttribute('data-with') && g.length) g[g.length - 1].push(e); else g.push([e]); });
    return g;
  });
  // sections
  let curSec = '';
  const sections = slides.map(s => (curSec = s.dataset.section ?? curSec));

  // typing lengths
  document.querySelectorAll('.typing').forEach(t => { t.style.setProperty('--n', t.textContent.length); if (!t.style.getPropertyValue('--t')) t.style.setProperty('--t', Math.max(.6, t.textContent.length * .045) + 's'); });

  // svg draw lengths
  document.querySelectorAll('.draw path,.draw line,.draw polyline,path.draw,line.draw,.autodraw path,path.autodraw').forEach(p => {
    try { const L = Math.ceil(p.getTotalLength()) + 2; p.style.setProperty('--len', L); } catch (e) {}
  });

  let i = 0, k = 0;
  const parseHash = () => { const m = location.hash.match(/#\/?(\d+)(?:\.(\d+))?/); if (m) { i = Math.min(slides.length - 1, Math.max(0, +m[1] - 1)); k = Math.min(groups[i].length, +(m[2] || 0)); } };
  parseHash();

  function smil(root, filter) {
    root.querySelectorAll('animate,animateMotion,animateTransform,set').forEach(a => {
      if (filter(a)) { try { a.beginElement(); } catch (e) {} }
    });
  }
  function ranges(spec) {
    const out = new Set();
    String(spec).split(',').forEach(p => { const [a, b] = p.split('-').map(Number); for (let x = a; x <= (b || a); x++) out.add(x); });
    return out;
  }

  let prevI = -1, prevK = -1;
  function render(forward) {
    slides.forEach((s, x) => { s.classList.toggle('active', x === i); s.classList.toggle('past', x < i); });
    const s = slides[i];
    groups[i].forEach((g, x) => g.forEach(e => e.classList.toggle('shown', x < k)));
    // data-hide triggers: hide target element(s) once the trigger is shown
    s.querySelectorAll('[data-hide]').forEach(t => {
      s.querySelectorAll(t.dataset.hide).forEach(el => el.classList.toggle('gone', t.classList.contains('shown')));
    });
    // code highlights
    s.querySelectorAll('pre.code[id]').forEach(pre => {
      const steps = [...s.querySelectorAll(`.codestep[data-for="${pre.id}"]`)].filter(c => c.classList.contains('shown'));
      const last = steps[steps.length - 1];
      const lines = [...pre.querySelectorAll('.ln')];
      if (!last || last.dataset.lines === 'all') { lines.forEach(l => l.classList.remove('hl', 'dim')); return; }
      const set = ranges(last.dataset.lines);
      lines.forEach((l, n) => { const on = set.has(n + 1); l.classList.toggle('hl', on); l.classList.toggle('dim', !on); });
    });
    // animations
    if (i !== prevI) {
      smil(s, a => a.hasAttribute('data-auto'));
    }
    if (i === prevI && k > prevK) {
      for (let x = prevK; x < k; x++) groups[i][x].forEach(e => smil(e, a => !a.hasAttribute('data-auto')));
    } else if (i !== prevI && k > 0) {
      for (let x = 0; x < k; x++) groups[i][x].forEach(e => smil(e, a => !a.hasAttribute('data-auto')));
    }
    prevI = i; prevK = k;
    // hud
    hud.sec.textContent = sections[i] || '';
    hud.num.textContent = `${i + 1} / ${slides.length}`;
    const n = groups[i].length;
    hud.dots.innerHTML = n ? Array.from({ length: n }, (_, x) => x < k ? '<b>●</b>' : '○').join('') : '';
    bar.style.width = ((i + (n ? k / n : 1)) / slides.length * 100) + '%';
    const nt = s.querySelector('.notes');
    notes.innerHTML = `<h6>შენიშვნები ლექტორისთვის · სლაიდი ${i + 1}</h6>` + (nt ? nt.innerHTML : '<span class="muted">—</span>');
    notes.querySelectorAll('.cue').forEach(c => { const n = +c.dataset.c; c.classList.toggle('done', n <= k); c.classList.toggle('next', n === k + 1); });
    const nx = notes.querySelector('.cue.next'); if (nx && notes.classList.contains('open')) nx.scrollIntoView({ block: 'nearest' });
    history.replaceState(null, '', `#/${i + 1}${k ? '.' + k : ''}`);
    try { bc && !PRESENTER && bc.postMessage({ t: 'state', i, k }); } catch (e) {}
    if (PRESENTER) renderPresenter();
    [...ov.children].forEach((b, x) => b.classList.toggle('cur', x === i));
  }

  function next() { if (k < groups[i].length) k++; else if (i < slides.length - 1) { i++; k = 0; } render(true); }
  function prev() { if (k > 0) { k--; prevK = k; } else if (i > 0) { i--; k = groups[i].length; } render(false); }
  function go(x, all) { i = Math.max(0, Math.min(slides.length - 1, x)); k = all ? groups[i].length : 0; render(true); }

  // overview
  slides.forEach((s, x) => {
    const b = document.createElement('button');
    const t = s.querySelector('h1,h2,h3')?.textContent.trim() || s.dataset.title || 'სლაიდი';
    b.innerHTML = `<small>${x + 1} · ${sections[x] || ''}</small>${t}`;
    b.onclick = e => { e.stopPropagation(); ov.classList.remove('open'); go(x); };
    ov.appendChild(b);
  });

  const t0 = Date.now();
  function renderPresenter() {
    const P = document.getElementById('presenter'); if (!P) return;
    const sl = slides[i], nt = sl.querySelector('.notes');
    const title = t => (t.querySelector('h1,h2')?.innerText || t.dataset.section || '').replace(/\n/g, ' ');
    P.querySelector('.p-title').textContent = `${i + 1} / ${slides.length} · ${title(sl)}`;
    P.querySelector('.p-next').textContent = i < slides.length - 1 ? 'შემდეგი სლაიდი: ' + title(slides[i + 1]) : 'ბოლო სლაიდი';
    P.querySelector('.p-steps').textContent = groups[i].length ? `ნაბიჯი ${k} / ${groups[i].length}` : '';
    const body = P.querySelector('.p-notes'); body.innerHTML = nt ? nt.innerHTML : '';
    body.querySelectorAll('.cue').forEach(c => { const n = +c.dataset.c; c.classList.toggle('done', n <= k); c.classList.toggle('next', n === k + 1); });
    (body.querySelector('.cue.next') || body.firstElementChild)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  if (bc) bc.onmessage = ({ data }) => {
    if (PRESENTER && data.t === 'state') { i = data.i; k = data.k; render(true); }
    if (!PRESENTER && data.t === 'cmd') { ({ next, prev, go: () => go(data.n) })[data.c](); }
    if (!PRESENTER && data.t === 'hello') bc.postMessage({ t: 'state', i, k });
  };
  if (PRESENTER) {
    document.body.classList.add('presenter');
    const P = document.createElement('div'); P.id = 'presenter';
    P.innerHTML = '<div class="p-head"><span class="p-title"></span><span class="p-steps"></span><span class="p-clock"></span></div><div class="p-notes"></div><div class="p-foot"><span class="p-next"></span><span class="p-help">→ / Space შემდეგი · ← წინა · ეს ფანჯარა მართავს პროექტორზე გახსნილ სლაიდებს</span></div>';
    document.body.appendChild(P);
    setInterval(() => { const m = Math.floor((Date.now() - t0) / 60000); P.querySelector('.p-clock').textContent = `⏱ ${String(Math.floor(m / 60)).padStart(1, '0')}:${String(m % 60).padStart(2, '0')}`; }, 1000);
    try { bc.postMessage({ t: 'hello' }); } catch (e) {}
    document.addEventListener('keydown', e => {
      const fwd = ['ArrowRight', 'PageDown', ' ', 'Enter', 'ArrowDown'], back = ['ArrowLeft', 'PageUp', 'Backspace', 'ArrowUp'];
      if (fwd.includes(e.key)) { e.preventDefault(); bc.postMessage({ t: 'cmd', c: 'next' }); }
      else if (back.includes(e.key)) { e.preventDefault(); bc.postMessage({ t: 'cmd', c: 'prev' }); }
    });
  }
  document.addEventListener('keydown', e => {
    if (PRESENTER) return;
    if (e.key === 'p' || e.key === 'P') { window.open(location.pathname + '?presenter' + location.hash, 'presenter', 'width=1100,height=800'); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key;
    if (['ArrowRight', 'PageDown', ' ', 'Enter', 'ArrowDown'].includes(key)) { e.preventDefault(); e.shiftKey ? go(i + 1) : next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace', 'ArrowUp'].includes(key)) { e.preventDefault(); e.shiftKey ? go(i - 1) : prev(); }
    else if (key === 'Home') go(0);
    else if (key === 'End') go(slides.length - 1, true);
    else if (key === 'n' || key === 'N') notes.classList.toggle('open');
    else if (key === 'o' || key === 'O' || key === 'Escape') ov.classList.toggle('open', key === 'Escape' ? false : !ov.classList.contains('open'));
    else if (key === 'f' || key === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); }
    else if (key === 'a' || key === 'A') { k = groups[i].length; render(true); }
  });
  document.getElementById('stage').addEventListener('click', e => {
    if (PRESENTER) return;
    if (e.target.closest('a,button,#notes')) return;
    (e.clientX < innerWidth * 0.3) ? prev() : next();
  });
  let tx = null;
  addEventListener('touchstart', e => tx = e.touches[0].clientX, { passive: true });
  addEventListener('touchend', e => { if (tx == null) return; const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) (d < 0 ? next() : prev()); tx = null; });
  addEventListener('hashchange', () => { const oi = i, ok = k; parseHash(); if (oi !== i || ok !== k) render(true); });

  function fit() {
    // 16:9 on wide screens; grow canvas height up to 16:10 so MacBook-style screens have no bars
    const H = Math.max(900, Math.min(1000, Math.round(1600 * innerHeight / innerWidth)));
    deck.style.setProperty('--h', H + 'px');
    deck.style.setProperty('--s', Math.min(innerWidth / 1600, innerHeight / H));
  }
  setTimeout(() => document.getElementById('help')?.classList.add('hide'), 6000);
  addEventListener('resize', fit); fit();
  render(true);
})();
