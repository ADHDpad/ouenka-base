(() => {
  'use strict';

  const list = document.getElementById('noticeList');
  const status = document.getElementById('noticeStatus');
  const more = document.getElementById('noticeMore');
  const retry = document.getElementById('noticeRetry');
  const dateFormat = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium' });
  const pageSize = 20;
  let entries = [];
  let shown = 0;

  function registrationTime(value) {
    if (value == null || String(value).trim() === '') return NaN;
    if (/^\d{10}(?:\d{3})?$/.test(String(value))) {
      return Number(value) * (String(value).length === 10 ? 1000 : 1);
    }
    // SQLite timestamps without a timezone are UTC.
    const timestamp = String(value).trim().replace(' ', 'T');
    return Date.parse(/^\d{4}-\d\d-\d\dT[\d:.]+$/.test(timestamp) ? timestamp + 'Z' : timestamp);
  }

  function songCard({ song, timestamp }) {
    const row = document.createElement('article');
    row.className = 'feature-song notice-song';
    row.style.setProperty('--main', window.OuenkaTeamColors.get(song.team)[0]);

    const info = document.createElement('div');
    const name = document.createElement('h2');
    name.tabIndex = -1;
    name.textContent = song.name;
    const detail = document.createElement('small');
    const date = document.createElement('time');
    date.dateTime = new Date(timestamp).toISOString();
    date.textContent = dateFormat.format(timestamp);
    detail.append(date, '追加', song.team ? ' ／ ' + song.team : '');
    if (song.productionNumber !== '1') detail.append(' ／ 制作番号 ' + song.productionNumber);
    info.append(name, detail);

    const actions = document.createElement('div');
    actions.className = 'feature-actions';
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = '▶ 再生';
    play.setAttribute('aria-label', song.name + 'の応援歌を再生');
    play.onclick = () => playSongData(song);
    actions.append(play, window.OuenkaFavorites.button(song));
    row.append(info, actions);
    return row;
  }

  function appendPage(focus = false) {
    const rows = entries.slice(shown, shown + pageSize).map(songCard);
    list.append(...rows);
    shown += rows.length;
    more.hidden = shown >= entries.length;
    status.textContent = entries.length
      ? '新しい順に ' + shown + ' / ' + entries.length + '件を表示'
      : '追加のお知らせはまだありません。';
    if (focus) rows[0]?.querySelector('h2').focus();
  }

  async function load(force = false) {
    retry.hidden = true;
    status.textContent = 'お知らせを読み込み中…';
    try {
      const songs = await window.OuenkaCatalog.load(force);
      entries = songs
        .filter(song => !['1', 'true'].includes(String(song.is_generic ?? song.isGeneric).trim().toLowerCase()))
        .map(song => ({ song, timestamp: registrationTime(song.created_at ?? song.createdAt) }))
        .filter(entry => Number.isFinite(entry.timestamp))
        .sort((a, b) => b.timestamp - a.timestamp || (Number(b.song.id) || 0) - (Number(a.song.id) || 0));
      shown = 0;
      list.replaceChildren();
      window.ouenkaHomeQueue = entries.map(entry => entry.song);
      appendPage();
    } catch {
      status.textContent = 'お知らせを読み込めませんでした。';
      retry.hidden = false;
    }
  }

  more.onclick = () => appendPage(true);
  retry.onclick = () => load(true);
  load();
})();
