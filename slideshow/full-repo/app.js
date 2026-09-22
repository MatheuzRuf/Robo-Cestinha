/* Robô Cestinha — full-repo deck: Reveal init + custom chrome */
(() => {
  'use strict';

  const sections = [...document.querySelectorAll('.reveal .slides > section')];
  const core = sections.filter((s) => (s.dataset.part || 'A') !== 'A');
  const partNames = {
    I: 'PART I · GENERAL OVERVIEW',
    II: 'PART II · FRONTEND',
    III: 'PART III · BACKEND',
    IV: 'PART IV · FINAL CONSIDERATIONS',
    A: 'BACKUP · Q&A',
  };
  const partClasses = { I: 'part-I', II: 'part-II', III: 'part-III', IV: 'part-IV', A: 'part-A' };

  const $ = (id) => document.getElementById(id);
  const partLabel = $('partLabel');
  const counter = $('counter');
  const timerChip = $('timerChip');
  const drawer = $('notesDrawer');
  const notesBody = $('notesBody');
  const notesSlideLabel = $('notesSlideLabel');
  const notesWords = $('notesWords');
  const btnNotes = $('btn-notes');
  const btnTimer = $('btn-timer');

  const state = { timerOn: false, notesOpen: false, slideElapsed: 0, totalElapsed: 0, tick: null, slideStart: 0 };
  let currentIdx = 0; // kept in sync with reveal's indexh

  /* ---------- helpers ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
  function parseBudget(b) {
    const [m, s] = (b || '').split(':').map(Number);
    return m * 60 + (s || 0);
  }
  function partOf(s) { return s.dataset.part || 'A'; }
  function indexInPart(s) {
    const p = partOf(s);
    const same = sections.filter((x) => partOf(x) === p);
    return same.indexOf(s) + 1;
  }
  function noteText(s) {
    const n = s.querySelector('aside.notes');
    return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function slideTitle(s) {
    const h = s.querySelector('h2');
    if (!h) return 'Slide';
    const tmp = document.createElement('span');
    tmp.innerHTML = h.innerHTML.replace(/<br\s*\/?>/gi, ' ');
    return tmp.textContent.replace(/\s+/g, ' ').trim();
  }

  function currentSlide() { return sections[currentIdx] || sections[0]; }

  /* ---------- chrome ---------- */
  function updateChrome(idx) {
    const s = sections[idx];
    if (!s) return;
    currentIdx = idx;
    const part = partOf(s);
    partLabel.innerHTML = `<b class="${partClasses[part]}">${partNames[part]}</b>`;
    counter.textContent = part === 'A'
      ? `A${indexInPart(s)} / 4 · Q&A`
      : `${pad(idx + 1)} / ${pad(core.length)}`;
    if (state.timerOn) { state.slideElapsed = 0; state.slideStart = Date.now(); }
    if (state.notesOpen) renderNotes(s);
    updateTimer();
    warnOverflow(s);
  }

  function updateTimer() {
    if (!state.timerOn) { timerChip.hidden = true; return; }
    const s = currentSlide();
    const budget = s.dataset.budget || '';
    timerChip.hidden = false;
    const over = !!budget && state.slideElapsed > parseBudget(budget);
    timerChip.classList.toggle('over', over);
    timerChip.innerHTML = `SLIDE <b>${fmt(state.slideElapsed)}</b>` +
      (budget ? ` / ${budget}` : ' / Q&A') + ` · TOTAL ${fmt(state.totalElapsed)}`;
  }

  function toggleTimer(force) {
    state.timerOn = force !== undefined ? force : !state.timerOn;
    btnTimer.dataset.on = String(state.timerOn);
    if (state.timerOn) {
      state.slideElapsed = 0; state.totalElapsed = 0; state.slideStart = Date.now();
      state.tick = setInterval(() => {
        const now = Date.now();
        state.slideElapsed = (now - state.slideStart) / 1000;
        state.totalElapsed += 1; // ~1 s per tick
        state.slideStart = now;
        updateTimer();
      }, 1000);
    } else {
      clearInterval(state.tick);
      state.slideElapsed = 0;
      state.totalElapsed = 0;
    }
    updateTimer();
  }

  /* ---------- notes drawer ---------- */
  function renderNotes(s) {
    const txt = noteText(s);
    notesBody.innerHTML = txt
      ? `<blockquote>${txt}</blockquote>`
      : `<p style="color:#a69a87">No speaker notes on this slide.</p>`;
    notesSlideLabel.textContent = `SLIDE ${pad(currentIdx + 1)} · ${partNames[partOf(s)]}`;
    // ~135 words/min
    notesWords.textContent = txt ? `≈ ${Math.max(1, Math.round(txt.split(/\s+/).length / 135))} min talk` : '';
  }
  function toggleNotes(force) {
    state.notesOpen = force !== undefined ? force : !state.notesOpen;
    drawer.classList.toggle('open', state.notesOpen);
    btnNotes.dataset.on = String(state.notesOpen);
    if (state.notesOpen) {
      renderNotes(currentSlide());
    }
  }

  /* ---------- overflow guard (dev aid; no-op in jsdom) ---------- */
  function warnOverflow(s) {
    try {
      if (typeof window === 'undefined' || !window.document) return;
      const r = s.getBoundingClientRect();
      if (!r.width && !r.height) return; // not laid out (jsdom)
      const vp = document.querySelector('.reveal-viewport') || document.body;
      const inner = s.firstElementChild;
      const h = Math.max(s.scrollHeight || 0, inner ? inner.getBoundingClientRect().height : 0);
      // hard cap: at 16:9 the slide must fit within ~720*0.98 minus fixed chrome
      const cap = Math.round(vp.clientHeight * 0.92);
      if (h > cap) {
        console.warn(`[deck] slide "${slideTitle(s)}" content (${Math.round(h)}px) exceeds the ${cap}px safe height — it may get clipped or need scrolling.`);
      }
    } catch (_) { /* ignore */ }
  }

  /* ---------- reveal init ---------- */
  const deck = new Reveal(document.querySelector('.reveal'), {
    width: 1280,
    height: 720,
    margin: 0.02,
    minScale: 0.18,
    maxScale: 1.5,
    hash: true,
    hashOneBasedIndex: true,
    controls: true,
    controlsTutorial: false,
    progress: true,
    slideNumber: false,
    overview: true,
    center: true,
    transition: 'slide',
    transitionSpeed: 'default',
    navigationMode: 'linear',
    disableLayout: false,
    plugins: [RevealNotes, RevealHighlight, RevealZoom],
  });

  deck.initialize().then(() => {
    window.__deck = deck; // exposed for automation/tests
    // initial index from the hash, matching reveal's one-based hash
    const hm = location.hash.match(/^#\/(\d+)/);
    if (hm) currentIdx = Math.min(sections.length - 1, Math.max(0, parseInt(hm[1], 10) - 1));
    updateChrome(currentIdx);

    deck.on('slidechanged', (e) => {
      updateChrome(Number(e.indexh));
      if (state.notesOpen) renderNotes(currentSlide());
    });

    // reveal indexes are data-index on sections; catch overview clicks too
    deck.on('overviewshown', () => { /* reveal handles */ });

    // keyboard: our keys (n, t) — reveal already owns many
    document.addEventListener('keydown', (e) => {
      if (e.key === 'n' || e.key === 'N') { toggleNotes(); e.preventDefault(); }
      if (e.key === 't' || e.key === 'T') { toggleTimer(); e.preventDefault(); }
    });

    $('btn-notes')?.addEventListener('click', () => toggleNotes());
    $('btn-notes-close')?.addEventListener('click', () => toggleNotes(false));
    $('btn-timer')?.addEventListener('click', () => toggleTimer());

    // auto-hide the hint after idle
    let idle;
    const poke = () => {
      document.body.classList.remove('chrome-idle');
      clearTimeout(idle);
      idle = setTimeout(() => document.body.classList.add('chrome-idle'), 6000);
    };
    ['pointerdown', 'keydown', 'pointermove', 'wheel', 'touchstart'].forEach((ev) =>
      document.addEventListener(ev, poke, { passive: true })
    );
    poke();
  });
})();