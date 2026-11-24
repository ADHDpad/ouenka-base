(() => {
  'use strict';

  const readKey = 'ouenkaNoticesReadThroughV1';
  const controls = 'a[href="notices.html"], [data-notice-link], #homeMenuButton, #sharedMenuButton';
  let latest;
  let readInPage;
  let checkedAt = 0;

  function registrationTime(value) {
    if (value == null || String(value).trim() === '') return NaN;
    if (/^\d{10}(?:\d{3})?$/.test(String(value))) {
      return Number(value) * (String(value).length === 10 ? 1000 : 1);
    }
    // SQLite timestamps without a timezone are UTC.
    const timestamp = String(value).trim().replace(' ', 'T');
    return Date.parse(/^\d{4}-\d\d-\d\dT[\d:.]+$/.test(timestamp) ? timestamp + 'Z' : timestamp);
  }

  function compare(a, b) {
    return a.timestamp - b.timestamp || a.id - b.id || a.key.localeCompare(b.key);
  }

  async function load(force = false) {
    const songs = await window.OuenkaCatalog.load(force);
    return songs
      .filter(song => !['1', 'true'].includes(String(song.is_generic ?? song.isGeneric).trim().toLowerCase()))
      .map(song => ({
        song,
        timestamp: registrationTime(song.created_at ?? song.createdAt),
        id: Number(song.id) || 0,
        key: JSON.stringify([song.name, song.productionNumber])
      }))
      .filter(entry => Number.isFinite(entry.timestamp))
      .sort((a, b) => compare(b, a));
  }

  function readThrough() {
    try {
      const saved = JSON.parse(localStorage.getItem(readKey));
      if (Number.isFinite(saved?.timestamp) && Number.isFinite(saved.id) && typeof saved.key === 'string') {
        return readInPage && compare(readInPage, saved) > 0 ? readInPage : saved;
      }
    } catch { /* Reading still works for this page if storage is unavailable. */ }
    return readInPage;
  }

  function renderBadge() {
    const read = readThrough();
    const unread = !!latest && (!read || compare(latest, read) > 0);
    for (const control of document.querySelectorAll(controls)) {
      const label = control.id === 'homeMenuButton' || control.id === 'sharedMenuButton'
        ? 'メニューを開く' : 'お知らせ';
      control.toggleAttribute('data-notice-unread', unread);
      control.setAttribute('aria-label', unread ? label + '（未読のお知らせあり）' : label);
    }
  }

  function markRead(entry) {
    latest = entry;
    const read = readThrough();
    if (entry && (!read || compare(entry, read) > 0)) {
      const { timestamp, id, key } = entry;
      readInPage = { timestamp, id, key };
      try { localStorage.setItem(readKey, JSON.stringify(readInPage)); } catch {}
    }
    renderBadge();
  }

  async function refresh() {
    if (document.hidden || Date.now() - checkedAt < 60_000) return;
    const force = checkedAt > 0;
    checkedAt = Date.now();
    try {
      const entries = await load(force);
      latest = entries[0];
      renderBadge();
    } catch { /* Keep the previous badge state if the feed is unavailable. */ }
  }

  window.OuenkaNoticeFeed = { load, markRead };
  window.addEventListener('storage', event => {
    if (event.key === readKey || event.key === null) renderBadge();
  });
  window.addEventListener('load', () => {
    if (document.getElementById('noticeList')) return;
    refresh();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', () => { renderBadge(); refresh(); });
  }, { once: true });
})();
