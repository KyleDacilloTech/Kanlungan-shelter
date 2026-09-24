(function () {
  'use strict';

  var DIST = {
    'Poblacion':  { 'Poblacion': 0,   'San Isidro': 1.2, 'Sto. Niño': 2.0, 'Malinis': 2.8, 'Riverside': 1.0, 'Calvario': 2.4 },
    'San Isidro': { 'Poblacion': 1.2, 'San Isidro': 0,   'Sto. Niño': 1.6, 'Malinis': 2.2, 'Riverside': 1.8, 'Calvario': 3.0 },
    'Sto. Niño':  { 'Poblacion': 2.0, 'San Isidro': 1.6, 'Sto. Niño': 0,   'Malinis': 1.4, 'Riverside': 2.6, 'Calvario': 1.1 },
    'Malinis':    { 'Poblacion': 2.8, 'San Isidro': 2.2, 'Sto. Niño': 1.4, 'Malinis': 0,   'Riverside': 3.2, 'Calvario': 1.8 },
    'Riverside':  { 'Poblacion': 1.0, 'San Isidro': 1.8, 'Sto. Niño': 2.6, 'Malinis': 3.2, 'Riverside': 0,   'Calvario': 3.0 },
    'Calvario':   { 'Poblacion': 2.4, 'San Isidro': 3.0, 'Sto. Niño': 1.1, 'Malinis': 1.8, 'Riverside': 3.0, 'Calvario': 0   }
  };

  var STALE_THRESHOLD_MIN = 30;
  var initialAgeMinutes = {
    'poblacion-covered-court': 12,
    'san-isidro-elementary': 40,
    'sto-nino-parish-hall': 5,
    'malinis-multipurpose-hall': 60,
    'riverside-nhs-gym': 25,
    'calvario-chapel-grounds': 120
  };

  var areaSelect = document.getElementById('area');
  var list = document.getElementById('shelter-list');
  var cards = Array.prototype.slice.call(list.querySelectorAll('.card'));

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
      if (flagEl) flagEl.hidden = minutesAgo <= STALE_THRESHOLD_MIN;
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

    card.querySelector('.bar-fill').style.width = pct + '%';
    card.querySelector('.occupancy-text').textContent = count + ' of ' + cap + ' spaces filled (' + pct + '%)';

    var countDisplay = card.querySelector('.count-display');
    if (countDisplay) countDisplay.textContent = count;

    try {
      localStorage.setItem('kanlungan-count-' + card.dataset.id, String(count));
    } catch (e) { /* storage unavailable, demo still works this session */ }
  }

  function updateDistancesAndSort() {
    var area = areaSelect.value;
    cards.forEach(function (card) {
      var home = card.dataset.home;
      var offset = parseFloat(card.dataset.offset) || 0;
      var base = (DIST[area] && DIST[area][home] !== undefined) ? DIST[area][home] : 0;
      var km = base + offset;
      var distEl = card.querySelector('.distance');
      if (distEl) distEl.textContent = 'About ' + km.toFixed(1) + ' km from your area';
      card.dataset.km = km;
    });
    cards.sort(function (a, b) { return parseFloat(a.dataset.km) - parseFloat(b.dataset.km); });
    cards.forEach(function (card) { list.appendChild(card); });
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
