/* Robô Cestinha · player compartilhado das apresentações */
(() => {
  'use strict';

  /* ---------- mermaid theme (matches theme.css palette) ---------- */
  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      fontFamily: 'Inter, system-ui, sans-serif',
      themeVariables: {
        background: '#14100d',
        mainBkg: '#2a221a',
        primaryColor: '#2a221a',
        primaryTextColor: '#f0e6d2',
        primaryBorderColor: '#e2661a',
        secondaryColor: '#1f1913',
        secondaryBorderColor: '#3a2f24',
        tertiaryColor: '#1f1913',
        tertiaryBorderColor: '#3a2f24',
        lineColor: '#e2661a',
        textColor: '#f0e6d2',
        nodeTextColor: '#f0e6d2',
        edgeLabelBackground: '#14100d',
        clusterBkg: 'rgba(31,25,19,0.6)',
        clusterBorder: '#3a2f24',
        titleColor: '#f0e6d2',
        fontSize: '20px',
      },
      flowchart: { useMaxWidth: false, curve: 'basis', htmlLabels: true, padding: 30, nodeSpacing: 90, rankSpacing: 110 },
      state: { useMaxWidth: false },
      er: { useMaxWidth: false, fontSize: 18, entityPadding: 18, minEntityWidth: 150, minEntityHeight: 90 },
      themeCSS: `
        .node small, .nodeLabel small { color: #a69a87; font-size: 20px; }
        .edgeLabel { color: #a69a87 !important; background-color: #14100d !important; font-size: 20px !important; }
        .er.relationshipLabel { fill: #a69a87; font-size: 20px; }
        .er.entityBox { fill: #2a221a; }
        .er.entityLabel { fill: #f0e6d2; font-size: 20px; }
        .er.attributeBoxOdd { fill: #1f1913; }
        .er.attributeBoxEven { fill: #241d16; }
        text { font-size: 25px; }
        .nodeLabel, .edgeLabel, .cluster-label { font-size: 25px; }
      `,
    });
  }

  const slides = [...document.querySelectorAll('.slide')];
  const track = document.getElementById('track');
  const progressFill = document.getElementById('progressFill');
  const counter = document.getElementById('counter');
  const groupLabel = document.getElementById('groupLabel');
  const dotsWrap = document.getElementById('dots');
  const timerChip = document.getElementById('timerChip');
  const notesDrawer = document.getElementById('notesDrawer');
  const notesBody = document.getElementById('notesBody');
  const overview = document.getElementById('overview');
  const overviewGrid = document.getElementById('overviewGrid');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const body = document.body;

  const state = {
    i: 0,
    notesOpen: false,
    timerOn: false,
    overviewOpen: false,
    elapsed: 0,
    elapsedTick: null,
  };

  /* ---------- helpers ---------- */
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const pad = (n) => String(n).padStart(2, '0');

  function groupOf(el) { return el.dataset.group === 'appendix' ? 'appendix' : 'core'; }
  function groupIndex(el) {
    const same = slides.filter((s) => groupOf(s) === groupOf(el));
    return same.indexOf(el) + 1;
  }
  function groupCount(el) {
    return slides.filter((s) => groupOf(s) === groupOf(el)).length;
  }
  function slideHeader(el) {
    const h = el.querySelector('h1, h2');
    if (!h) return el.dataset.title || 'Slide';
    const tmp = document.createElement('span');
    tmp.innerHTML = h.innerHTML.replace(/<br\s*\/?>/gi, ' ');
    return tmp.textContent.replace(/\s+/g, ' ').trim();
  }
  function budgetOf(el) { return el.dataset.budget || ''; }

  /* ---------- rendering chrome ---------- */
  function buildDots() {
    dotsWrap.innerHTML = '';
    slides.forEach((s, idx) => {
      if (idx > 0 && groupOf(slides[idx - 1]) !== groupOf(s)) {
        const sep = document.createElement('span');
        sep.className = 'dot sep';
        sep.textContent = '·';
        dotsWrap.appendChild(sep);
      }
      const d = document.createElement('button');
      d.className = 'dot' + (groupOf(s) === 'appendix' ? ' appendix' : '');
      d.textContent = groupOf(s) === 'appendix' ? `A${groupIndex(s)}` : String(idx + 1);
      d.dataset.index = String(idx);
      d.title = slideHeader(s);
      d.setAttribute('role', 'tab');
      d.addEventListener('click', () => go(idx));
      dotsWrap.appendChild(d);
    });
  }

  function updateChrome() {
    const el = slides[state.i];
    track.style.transform = `translateX(-${state.i * 100}%)`;
    progressFill.style.width = `${((state.i + 1) / slides.length) * 100}%`;

    // counter per group
    counter.textContent = `${pad(groupIndex(el))} / ${pad(groupCount(el))}`;
    groupLabel.textContent = groupOf(el) === 'appendix'
      ? 'APÊNDICE · PERGUNTAS'
      : el.dataset.deckLabel || body.dataset.deckLabel || 'APRESENTAÇÃO';

    // dots
    dotsWrap.querySelectorAll('button.dot').forEach((d) => d.classList.toggle('active', Number(d.dataset.index) === state.i));

    // arrows
    prevBtn.disabled = state.i === 0;
    nextBtn.disabled = state.i === slides.length - 1;

    // hash (no scroll jump)
    const want = `#/${state.i + 1}`;
    if (location.hash !== want) history.replaceState(null, '', want);

    // notes drawer content follows the slide
    if (state.notesOpen) renderNotes();
    updateTimerChip();
    refreshOverviewActive();
  }

  /* ---------- navigation ---------- */
  function go(i) {
    state.i = clamp(i, 0, slides.length - 1);
    if (state.timerOn) state.elapsed = 0;
    updateChrome();
    replayEntrance(slides[state.i]);
    document.getElementById('viewport')?.focus();
  }

  // replay the per-slide entrance animation when we arrive
  function replayEntrance(el) {
    const inner = el.querySelector('.slide-inner');
    if (!inner) return;
    inner.style.animation = 'none';
    void inner.offsetWidth;
    inner.style.animation = '';
  }
  const next = () => state.i < slides.length - 1 && go(state.i + 1);
  const prev = () => state.i > 0 && go(state.i - 1);

  /* ---------- notes ---------- */
  function renderNotes() {
    const el = slides[state.i];
    const quote = el.querySelector('.notes blockquote');
    notesBody.innerHTML = '';
    if (quote) {
      const bq = document.createElement('blockquote');
      bq.textContent = quote.textContent.trim();
      notesBody.appendChild(bq);
    }
    const meta = document.createElement('div');
    meta.className = 'notes-meta';
    const budget = budgetOf(el);
    meta.innerHTML =
      `<span>SLIDE ${pad(groupIndex(el))}${groupOf(el) === 'appendix' ? ' · apoio' : ''}</span>` +
      (budget ? `<span>TEMPO ${budget}</span>` : `<span>SEM TEMPO · PERGUNTAS</span>`) +
      `<span>≈ ${Math.round(el.textContent.trim().split(/\s+/).length / 135)} min de fala</span>`;
    notesBody.appendChild(meta);
  }

  function toggleNotes(force) {
    state.notesOpen = force !== undefined ? force : !state.notesOpen;
    notesDrawer.classList.toggle('open', state.notesOpen);
    document.getElementById('btn-notes').setAttribute('aria-pressed', String(state.notesOpen));
    if (state.notesOpen) renderNotes();
  }

  /* ---------- timer ---------- */
  function updateTimerChip() {
    const el = slides[state.i];
    const budget = budgetOf(el);
    if (!state.timerOn) {
      timerChip.hidden = true;
      return;
    }
    timerChip.hidden = false;
    const m = Math.floor(state.elapsed / 60);
    const s = state.elapsed % 60;
    const budgetTxt = budget ? ` · META ${budget}` : ' · PERGUNTAS';
    timerChip.textContent = `${pad(m)}:${pad(s)}${budgetTxt}`;
    timerChip.classList.toggle('over', !!budget && state.elapsed > parseBudget(budget));
  }
  function parseBudget(b) {
    const [m, s] = b.split(':').map(Number);
    return m * 60 + (s || 0);
  }
  function toggleTimer(force) {
    state.timerOn = force !== undefined ? force : !state.timerOn;
    document.getElementById('btn-timer').setAttribute('aria-pressed', String(state.timerOn));
    clearInterval(state.elapsedTick);
    if (state.timerOn) {
      state.elapsed = 0;
      state.elapsedTick = setInterval(() => { state.elapsed += 1; updateTimerChip(); }, 1000);
    } else {
      state.elapsed = 0;
    }
    updateTimerChip();
  }

  /* ---------- overview ---------- */
  function buildOverview() {
    overviewGrid.innerHTML = '';
    slides.forEach((s, idx) => {
      const card = document.createElement('button');
      card.className = 'ocard' + (groupOf(s) === 'appendix' ? ' appendix-card' : '');
      const num = groupOf(s) === 'appendix' ? `A${groupIndex(s)}` : String(idx + 1);
      card.innerHTML =
        `<span class="ocard-num">${num}</span>` +
        `<h3>${slideHeader(s)}</h3>` +
        `<span class="kicker">${s.dataset.kicker || ''}</span>`;
      card.addEventListener('click', () => { closeOverview(); go(idx); });
      overviewGrid.appendChild(card);
    });
  }
  function openOverview() {
    state.overviewOpen = true;
    overview.hidden = false;
    refreshOverviewActive();
  }
  function closeOverview() {
    state.overviewOpen = false;
    overview.hidden = true;
  }
  function refreshOverviewActive() {
    overviewGrid.querySelectorAll('.ocard').forEach((c, idx) => c.classList.toggle('active', idx === state.i));
  }

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    if (state.overviewOpen) {
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') { closeOverview(); }
      return;
    }
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); go(0); break;
      case 'End': e.preventDefault(); go(slides.length - 1); break;
      case 'n': case 'N': toggleNotes(); break;
      case 't': case 'T': toggleTimer(); break;
      case 'g': case 'G': openOverview(); break;
      case 'Escape': if (state.notesOpen) toggleNotes(false); break;
      case 'f': case 'F': toggleFullscreen(); break;
    }
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  /* ---------- buttons ---------- */
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  document.getElementById('btn-overview').addEventListener('click', openOverview);
  document.getElementById('btn-overview-close').addEventListener('click', closeOverview);
  document.getElementById('btn-notes').addEventListener('click', () => toggleNotes());
  document.getElementById('btn-notes-close').addEventListener('click', () => toggleNotes(false));
  document.getElementById('btn-timer').addEventListener('click', () => toggleTimer());
  document.getElementById('btn-full').addEventListener('click', toggleFullscreen);

  /* ---------- touch swipe ---------- */
  let touchX = null;
  const viewport = document.getElementById('viewport');
  viewport.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) { dx > 0 ? prev() : next(); }
    touchX = null;
  }, { passive: true });

  /* ---------- hash on load + manual edits ---------- */
  const m = location.hash.match(/^#\/(\d+)$/);
  const start = m ? Math.max(0, parseInt(m[1], 10) - 1) : 0;

  window.addEventListener('hashchange', () => {
    const hm = location.hash.match(/^#\/(\d+)$/);
    if (hm) go(clamp(parseInt(hm[1], 10) - 1, 0, slides.length - 1));
  });

  /* ---------- auto-hide chrome after idle (presenter nicety) ---------- */
  let idleTimer = null;
  function pokeIdle() {
    body.classList.remove('nav-hide');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => body.classList.add('nav-hide'), 5000);
  }
  ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, pokeIdle, { passive: true })
  );

  /* ---------- boot ---------- */
  buildDots();
  buildOverview();
  go(start);
  pokeIdle();
  if (window.mermaid) mermaid.run();
})();
