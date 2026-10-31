(() => {
  'use strict';

  const CA = 'GexThZHgaswpAQ7Fi8QrHFubjPimUNSYhJiAA7XZpump';
  const API = 'https://api.dexscreener.com/latest/dex/tokens/' + CA;
  const PAIR = 'TT7DKs9YjJZj1fwMGoPmKBmDreZzyMAMrHoDCGdfwqN';
  const REFRESH_MS = 30000;
  const DEATH_AT = 3.15; // seconds into the loop where the clip shows "wasted"

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  /* ---------- intro ---------- */
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-loaded')));

  /* ---------- feed (GTA-style notifications) ---------- */
  const feed = $('#feed');
  function notify(text) {
    const el = document.createElement('p');
    el.className = 'toast';
    el.textContent = text;
    feed.append(el);
    while (feed.children.length > 3) feed.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('is-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      if (reduce.matches) el.remove();
    }, 3200);
  }

  /* ---------- copy CA ---------- */
  async function copyCA(source) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(CA);
      ok = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = CA;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    notify(ok ? 'Contract address copied.' : 'Copy failed. Select the address and copy it manually.');
    if (ok && source) {
      source.classList.add('is-copied');
      const hint = $('.ca__hint span', source) || $('.ca-chip__act', source);
      if (hint) {
        const prev = hint.dataset.label || hint.textContent;
        hint.dataset.label = prev;
        hint.textContent = 'Copied';
        clearTimeout(source._t);
        source._t = setTimeout(() => { hint.textContent = prev; source.classList.remove('is-copied'); }, 1800);
      }
    }
  }
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', () => copyCA(btn)));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'c' && e.key !== 'C') return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest('input,textarea,select,[contenteditable]')) return;
    if (String(window.getSelection())) return;
    copyCA($('.ca-chip'));
  });

  /* ---------- hero film ---------- */
  const film = $('#film');
  const flash = $('.hero__flash');
  const soundBtn = $('#sound');
  const pauseBtn = $('#pause');
  let userPaused = reduce.matches;
  let heroVisible = true;
  let lastT = 0;

  function syncButtons() {
    const paused = film.paused;
    pauseBtn.textContent = paused ? 'Play' : 'Pause';
    pauseBtn.setAttribute('aria-pressed', String(paused));
    soundBtn.innerHTML = 'Sound <b>' + (film.muted ? 'off' : 'on') + '</b>';
    soundBtn.setAttribute('aria-pressed', String(!film.muted));
  }
  function tryPlay() {
    if (userPaused || !heroVisible || document.hidden) return;
    const p = film.play();
    if (p && p.catch) p.catch(() => { syncButtons(); });
  }
  film.muted = true;
  film.volume = 0.35;
  film.addEventListener('play', syncButtons);
  film.addEventListener('pause', syncButtons);
  film.addEventListener('volumechange', syncButtons);

  pauseBtn.addEventListener('click', () => {
    if (film.paused) { userPaused = false; heroVisible = true; tryPlay(); }
    else { userPaused = true; film.pause(); }
  });
  soundBtn.addEventListener('click', () => {
    film.muted = !film.muted;
    if (!film.muted && film.paused) { userPaused = false; tryPlay(); }
  });

  // Impact flash in sync with the in-clip death moment.
  function onFrame(_, meta) {
    const t = meta ? meta.mediaTime : film.currentTime;
    if (lastT < DEATH_AT && t >= DEATH_AT && !reduce.matches) {
      flash.classList.remove('is-on');
      void flash.offsetWidth;
      flash.classList.add('is-on');
    }
    lastT = t;
    if ('requestVideoFrameCallback' in film) film.requestVideoFrameCallback(onFrame);
  }
  if ('requestVideoFrameCallback' in film) film.requestVideoFrameCallback(onFrame);
  else film.addEventListener('timeupdate', () => onFrame());

  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    if (heroVisible) tryPlay(); else film.pause();
  }, { threshold: 0.05 }).observe($('.hero'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) film.pause(); else tryPlay(); });
  syncButtons();

  /* ---------- reveals + death screen ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.reveal').forEach((el) => revealIO.observe(el));

  const dead = $('#wasted');
  new IntersectionObserver(([e]) => {
    dead.classList.toggle('is-dead', e.intersectionRatio > 0.55);
  }, { threshold: [0, 0.55, 1] }).observe(dead);

  /* ---------- scroll: header, parallax, health ---------- */
  const hud = $('.hud');
  const hero = $('.hero');
  const heroFilm = $('.hero__film');
  const health = $('.health');
  const hp = $('#hp');
  let ticking = false;
  let respawned = false;

  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const heroH = hero.offsetHeight;

    hud.classList.toggle('is-solid', y > heroH - 90);

    if (!reduce.matches && y < heroH) {
      heroFilm.style.transform = 'translate3d(0,' + (y * 0.28).toFixed(1) + 'px,0)';
    }

    // Health drains on the way to the death screen, refills after it.
    const start = heroH * 0.5;
    const deathAt = dead.offsetTop + dead.offsetHeight / 2 - vh / 2;
    const reviveAt = dead.offsetTop + dead.offsetHeight;
    let value;
    const after = y > reviveAt - vh * 0.35;
    if (after) value = 1;
    else value = 1 - Math.min(1, Math.max(0, (y - start) / (deathAt - start)));
    if (after !== respawned) {
      respawned = after;
      health.classList.toggle('is-respawn', after);
      if (after && !reduce.matches) notify('Respawned.');
    }
    hp.style.transform = 'scaleX(' + value.toFixed(3) + ')';
    health.classList.toggle('is-low', value < 0.3);
    health.classList.toggle('is-on', y > heroH * 0.35);
  }
  function requestScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }
  new IntersectionObserver(([e]) => health.classList.toggle('is-off', e.isIntersecting))
    .observe($('.foot'));
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll);
  onScroll();

  /* ---------- live market data ---------- */
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  function usd(n) {
    if (n === null) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(2);
  }
  function price(n, prefix = '$') {
    if (n === null) return '—';
    if (n >= 1) return prefix + n.toFixed(4);
    const decimals = Math.min(12, Math.max(2, -Math.floor(Math.log10(n)) + 3));
    return prefix + n.toFixed(decimals);
  }
  function pct(n) {
    if (n === null) return '—';
    const sign = n > 0 ? '+' : n < 0 ? '−' : '±';
    const abs = Math.abs(n);
    return sign + abs.toFixed(abs >= 100 ? 0 : 1) + '%';
  }
  const int = (n) => (n === null ? '—' : Math.round(n).toLocaleString('en-US'));

  function setAll(key, text, cls) {
    $$('[data-k="' + key + '"]').forEach((el) => {
      el.textContent = text;
      el.classList.remove('is-up', 'is-down');
      if (cls) el.classList.add(cls);
    });
  }
  const trend = (n) => (n === null ? '' : n < 0 ? 'is-down' : 'is-up');

  function pickPair(pairs) {
    if (!Array.isArray(pairs)) return null;
    const ours = pairs.filter((p) => p && p.chainId === 'solana' && p.baseToken && p.baseToken.address === CA);
    return ours.find((p) => p.pairAddress === PAIR)
      || ours.find((p) => p.dexId === 'pumpswap')
      || ours.sort((a, b) => (num(b.liquidity && b.liquidity.usd) || 0) - (num(a.liquidity && a.liquidity.usd) || 0))[0]
      || null;
  }

  function buildTicker(d) {
    const items = [
      ['$WASTED', d.price],
      ['Market cap', d.mcap],
      ['24h volume', d.vol],
      ['24h', d.h24],
      ['Liquidity', d.liq],
      ['24h buys', d.buys],
      ['24h sells', d.sells],
      ['Bears', 'wasted'],
    ];
    const group = () => {
      const g = document.createElement('div');
      items.forEach(([k, v]) => {
        const s = document.createElement('span');
        s.append(k + ' ');
        const b = document.createElement('b');
        b.textContent = v;
        s.append(b);
        g.append(s);
      });
      return g;
    };
    const track = $('#ticker');
    track.replaceChildren(group(), group());
  }

  const kills = (() => {
    const el = $('[data-k="kills"]');
    const sec = $('.kills');
    let target = null, shown = 0, seen = false, raf = 0;
    const show = (v) => { el.textContent = int(Math.round(v)); };
    function run() {
      cancelAnimationFrame(raf);
      if (!el || target === null || !seen) return;
      if (reduce.matches) { shown = target; show(target); return; }
      const from = shown, to = target, t0 = performance.now(), dur = from === 0 ? 1800 : 900;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        shown = from + (to - from) * (1 - Math.pow(1 - k, 3));
        show(shown);
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    if (sec) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        seen = true;
        io.disconnect();
        run();
      }, { threshold: 0.35 });
      io.observe(sec);
    }
    return {
      set(v) { if (v === null) return; target = v; run(); },
      fail() { if (el && target === null) el.textContent = '—'; },
    };
  })();

  function render(pair) {
    const p = num(pair.priceUsd);
    const pc = pair.priceChange || {};
    const tx = (pair.txns && pair.txns.h24) || {};
    const ch = { m5: num(pc.m5), h1: num(pc.h1), h6: num(pc.h6), h24: num(pc.h24) };
    const d = {
      price: price(p),
      priceSol: price(num(pair.priceNative), '') + ' SOL',
      mcap: usd(num(pair.marketCap) ?? num(pair.fdv)),
      vol: usd(num(pair.volume && pair.volume.h24)),
      liq: usd(num(pair.liquidity && pair.liquidity.usd)),
      buys: int(num(tx.buys)),
      sells: int(num(tx.sells)),
      h24: pct(ch.h24),
    };

    setAll('price', d.price);
    setAll('priceSol', d.priceSol);
    setAll('mcap', d.mcap);
    setAll('vol', d.vol);
    setAll('liq', d.liq);
    setAll('txns', d.buys + ' / ' + d.sells);
    setAll('buys', d.buys);
    setAll('sells', d.sells);
    const nb = num(tx.buys), ns = num(tx.sells);
    const total = (nb || 0) + (ns || 0);
    const bar = $('[data-k="buyShare"]');
    if (bar) bar.style.transform = 'scaleX(' + (total ? nb / total : 0) + ')';
    kills.set(nb);
    ['m5', 'h1', 'h6'].forEach((k) => setAll(k, pct(ch[k]), trend(ch[k])));
    $$('[data-k="h24"]').forEach((el) => {
      el.textContent = el.closest('.cash') ? pct(ch.h24) + ' 24H' : pct(ch.h24);
      el.classList.remove('is-up', 'is-down');
      const t = trend(ch.h24);
      if (t) el.classList.add(t);
    });

    const verdict = $('[data-k="verdict"]');
    const sub = $('[data-k="verdictSub"]');
    if (ch.h24 !== null && ch.h24 < 0) {
      verdict.textContent = 'wasted.';
      verdict.classList.add('is-wasted');
      sub.textContent = 'Down ' + pct(Math.abs(ch.h24)).slice(1) + ' on the day. Respawning shortly. Probably.';
    } else {
      verdict.textContent = 'Respawned.';
      verdict.classList.remove('is-wasted');
      sub.textContent = ch.h24 === null
        ? 'Still standing. DexScreener didn’t report a 24h change.'
        : 'Up ' + pct(ch.h24).slice(1) + ' on the day. Bears, meanwhile, are lying in the road.';
    }

    setAll('status', 'Live');
    setAll('updated', 'updated ' + new Date().toLocaleTimeString('en-GB', { hour12: false }));
    document.body.classList.add('is-live');
    buildTicker(d);
  }

  function renderError() {
    setAll('status', 'No signal');
    kills.fail();
    document.body.classList.remove('is-live');
    const verdict = $('[data-k="verdict"]');
    if (verdict.textContent === 'Loading…') {
      verdict.textContent = 'No signal.';
      $('[data-k="verdictSub"]').textContent = 'DexScreener isn’t answering. Retrying every 30 seconds.';
      setAll('updated', 'waiting for data');
    }
  }

  let timer = 0;
  let inflight = null;
  async function load() {
    clearTimeout(timer);
    if (inflight) inflight.abort();
    const ctrl = new AbortController();
    inflight = ctrl;
    const kill = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(API, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const pair = pickPair(json.pairs);
      if (!pair) throw new Error('pair not found');
      render(pair);
    } catch (err) {
      if (ctrl.signal.aborted && inflight !== ctrl) return;
      renderError();
    } finally {
      clearTimeout(kill);
      if (inflight === ctrl) inflight = null;
      if (!document.hidden) timer = setTimeout(load, REFRESH_MS);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else load();
  });
  load();
})();
