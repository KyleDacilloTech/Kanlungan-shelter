(function () {
  'use strict';

  // Real Marikina City barangays, grouped into four rough geographic zones (river-hugging
  // District 1 core, the hillier District 1 west end, District 2's north, and District 2's
  // elevated east). Distance is zone-to-zone plus a small per-shelter offset, not real GPS.
  var BARANGAY_ZONE = {
    'Sto. Niño': 'core', 'Sta. Elena': 'core', 'Malanday': 'core',
    'San Roque': 'core', 'Tañong': 'core', 'Calumpang': 'core',
    'Barangka': 'west', 'Industrial Valley Complex': 'west', 'Jesus de la Peña': 'west',
    'Nangka': 'north', 'Tumana': 'north', 'Concepcion Uno': 'north',
    'Concepcion Dos': 'north', 'Parang': 'north',
    'Marikina Heights': 'heights', 'Fortune': 'heights'
  };
  var ZONE_DIST = {
    core:    { core: 0,   west: 2.0, north: 2.5, heights: 3.5 },
    west:    { core: 2.0, west: 0,   north: 3.0, heights: 4.0 },
    north:   { core: 2.5, west: 3.0, north: 0,   heights: 2.0 },
    heights: { core: 3.5, west: 4.0, north: 2.0, heights: 0   }
  };

  var STALE_THRESHOLD_MIN = 30;
  var FADE_MS = 160; // matches --duration-fast in style.css
  var initialAgeMinutes = {
    'malanday-covered-court': 12,
    'sta-elena-elementary': 40,
    'sto-nino-parish-hall': 5,
    'barangka-multipurpose-hall': 60,
    'marikina-heights-nhs-gym': 25,
    'concepcion-uno-chapel-grounds': 120
  };

  var areaSelect = document.getElementById('area');
  var list = document.getElementById('shelter-list');
  var cards = Array.prototype.slice.call(list.querySelectorAll('.card'));

  function reduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // FLIP: measure, mutate, then invert-and-release so any card that changed position
  // (a reorder, or others reflowing into a gap) slides there instead of jumping.
  function withFlip(mutate) {
    if (reduceMotion()) { mutate(); return; }
    var firstRects = new Map();
    cards.forEach(function (c) {
      if (c.style.display !== 'none') firstRects.set(c, c.getBoundingClientRect());
    });
    mutate();
    cards.forEach(function (c) {
      if (c.style.display === 'none') return;
      var first = firstRects.get(c);
      if (!first) return;
      var last = c.getBoundingClientRect();
      var dx = first.left - last.left;
      var dy = first.top - last.top;
      if (Math.round(dx) === 0 && Math.round(dy) === 0) return;
      c.style.transition = 'none';
      c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      c.getBoundingClientRect(); // force reflow so the jump above applies before we release it
      c.style.transition = '';
      requestAnimationFrame(function () { c.style.transform = ''; });
    });
  }

  function statusFor(pct) {
    if (pct > 95) return { cardCls: 'status-full', badgeCls: 'badge-full', text: 'Full' };
    if (pct >= 70) return { cardCls: 'status-warn', badgeCls: 'badge-warn', text: 'Nearly full' };
    return { cardCls: 'status-open', badgeCls: 'badge-open', text: 'Open' };
  }

  function formatAgo(minutes) {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    var hrs = Math.floor(minutes / 60);
    return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  }

  function updateFreshness() {
    var now = Date.now();
    cards.forEach(function (card) {
      var syncedAt = parseInt(card.dataset.syncedAt, 10);
      var minutesAgo = Math.floor((now - syncedAt) / 60000);
      var textEl = card.querySelector('.updated-text');
      var flagEl = card.querySelector('.stale-flag');
      if (textEl) textEl.textContent = 'Last synced ' + formatAgo(minutesAgo);
      if (flagEl) flagEl.classList.toggle('is-visible', minutesAgo > STALE_THRESHOLD_MIN);
    });
  }

  function render(card) {
    var cap = parseInt(card.dataset.capacity, 10);
    var count = Math.max(0, Math.min(cap, parseInt(card.dataset.count, 10)));
    card.dataset.count = count;
    var pct = Math.round((count / cap) * 100);
    var s = statusFor(pct);

    card.classList.remove('status-open', 'status-warn', 'status-full');
    card.classList.add(s.cardCls);

    var badge = card.querySelector('.badge');
    badge.className = 'badge ' + s.badgeCls;
    badge.textContent = s.text;

    card.querySelector('.bar-fill').style.transform = 'scaleX(' + (pct / 100) + ')';
    card.querySelector('.occupancy-text').textContent = count + ' of ' + cap + ' spaces filled (' + pct + '%)';

    var countDisplay = card.querySelector('.count-display');
    if (countDisplay) countDisplay.textContent = count;

    var downBtn = card.querySelector('.step-down');
    var upBtn = card.querySelector('.step-up');
    if (downBtn) downBtn.disabled = count <= 0;
    if (upBtn) upBtn.disabled = count >= cap;

    try {
      localStorage.setItem('kanlungan-count-' + card.dataset.id, String(count));
    } catch (e) { /* storage unavailable, demo still works this session */ }
  }

  function updateDistancesAndSort() {
    var area = areaSelect.value;
    var selectedZone = BARANGAY_ZONE[area] || 'core';
    cards.forEach(function (card) {
      var home = card.dataset.home;
      var homeZone = BARANGAY_ZONE[home] || 'core';
      var offset = parseFloat(card.dataset.offset) || 0;
      var base = (ZONE_DIST[selectedZone] && ZONE_DIST[selectedZone][homeZone] !== undefined) ? ZONE_DIST[selectedZone][homeZone] : 0;
      var km = base + offset;
      var distEl = card.querySelector('.distance');
      if (distEl) distEl.textContent = 'About ' + km.toFixed(1) + ' km from your area';
      card.dataset.km = km;
    });
    withFlip(function () {
      cards.sort(function (a, b) { return parseFloat(a.dataset.km) - parseFloat(b.dataset.km); });
      cards.forEach(function (card) { list.appendChild(card); });
    });
  }

  var searchInput = document.getElementById('shelter-search');
  var emptyState = document.getElementById('empty-state');

  function currentHazard() {
    var checked = document.querySelector('.filter input[name="hazard"]:checked');
    if (!checked || checked.id === 'h-all') return 'all';
    return checked.id.replace('h-', '');
  }

  function cardMatches(card) {
    var hazard = currentHazard();
    if (hazard !== 'all' && !card.classList.contains(hazard)) return false;
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (!query) return true;
    var name = card.querySelector('h3').textContent.toLowerCase();
    var area = card.querySelector('.area').textContent.toLowerCase();
    return name.indexOf(query) !== -1 || area.indexOf(query) !== -1;
  }

  // Filtering runs in script.js instead of the old CSS-only :has() rule, so the
  // leaving cards can fade out before the remaining ones FLIP into the freed space.
  function applyFilters() {
    if (reduceMotion()) {
      cards.forEach(function (c) { c.style.display = cardMatches(c) ? '' : 'none'; });
      updateEmptyState();
      return;
    }

    cards.forEach(function (c) { if (!cardMatches(c)) c.classList.add('card-hidden'); });

    window.setTimeout(function () {
      withFlip(function () {
        cards.forEach(function (c) {
          c.classList.remove('card-hidden');
          c.style.display = cardMatches(c) ? '' : 'none';
        });
      });
      updateEmptyState();
    }, FADE_MS);
  }

  function updateEmptyState() {
    if (!emptyState) return;
    var anyVisible = cards.some(function (c) { return c.style.display !== 'none'; });
    emptyState.hidden = anyVisible;
  }

  var hazardRadios = Array.prototype.slice.call(document.querySelectorAll('.filter input[name="hazard"]'));
  hazardRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (radio.checked) applyFilters();
    });
  });

  if (searchInput) {
    var searchDebounce;
    searchInput.addEventListener('input', function () {
      window.clearTimeout(searchDebounce);
      searchDebounce = window.setTimeout(applyFilters, 200);
    });
  }

  cards.forEach(function (card) {
    var id = card.dataset.id;
    var saved = null;
    try { saved = localStorage.getItem('kanlungan-count-' + id); } catch (e) { /* ignore */ }
    if (saved !== null) card.dataset.count = saved;
    render(card);

    var savedSync = null;
    try { savedSync = localStorage.getItem('kanlungan-synced-' + id); } catch (e) { /* ignore */ }
    var defaultAge = initialAgeMinutes[id] || 0;
    card.dataset.syncedAt = savedSync !== null ? savedSync : (Date.now() - defaultAge * 60000);

    var down = card.querySelector('.step-down');
    var up = card.querySelector('.step-up');
    if (down) down.addEventListener('click', function () {
      card.dataset.count = parseInt(card.dataset.count, 10) - 5;
      card.dataset.syncedAt = Date.now();
      try { localStorage.setItem('kanlungan-synced-' + card.dataset.id, card.dataset.syncedAt); } catch (e) { /* ignore */ }
      render(card);
      updateFreshness();
    });
    if (up) up.addEventListener('click', function () {
      card.dataset.count = parseInt(card.dataset.count, 10) + 5;
      card.dataset.syncedAt = Date.now();
      try { localStorage.setItem('kanlungan-synced-' + card.dataset.id, card.dataset.syncedAt); } catch (e) { /* ignore */ }
      render(card);
      updateFreshness();
    });
  });

  updateFreshness();
  setInterval(updateFreshness, 30000);

  if (areaSelect) {
    areaSelect.addEventListener('change', updateDistancesAndSort);
    updateDistancesAndSort();
  }

  function updateSyncStatus() {
    var text = document.getElementById('sync-text');
    var status = document.getElementById('sync-status');
    if (!text || !status) return;
    if (navigator.onLine) {
      text.textContent = 'Online. Shelter data synced just now.';
      status.classList.remove('is-offline');
    } else {
      text.textContent = 'Offline. Showing shelter data from your last sync.';
      status.classList.add('is-offline');
    }
  }
  window.addEventListener('online', updateSyncStatus);
  window.addEventListener('offline', updateSyncStatus);
  updateSyncStatus();

  var resetBtn = document.getElementById('reset-demo');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      cards.forEach(function (card) {
        var id = card.dataset.id;
        try { localStorage.removeItem('kanlungan-count-' + id); } catch (e) { /* ignore */ }
        try { localStorage.removeItem('kanlungan-synced-' + id); } catch (e) { /* ignore */ }
        card.dataset.count = card.dataset.default;
        card.dataset.syncedAt = Date.now() - (initialAgeMinutes[id] || 0) * 60000;
        render(card);
      });
      updateFreshness();
    });
  }
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('service-worker.js').catch(function () {
      /* offline caching unavailable here (e.g. opened as a local file); the app still works online */
    });
  });
}

