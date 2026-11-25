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

  function songCard({ song, timestamp }) {
    const row = document.createElement('article');
    row.className = 'notice-song';
    const colors = window.OuenkaTeamColors;
    const palette = colors.get(song.team);
    row.style.setProperty('--main', palette[0]);
    row.style.setProperty('--notice-team-gradient', colors.css(palette, colors.getWidth(song.team)));

    const info = document.createElement('div');
    const name = document.createElement('h2');
    name.tabIndex = -1;
    name.textContent = song.name;
    const detail = document.createElement('small');
    const date = document.createElement('time');
    date.dateTime = new Date(timestamp).toISOString();
    date.textContent = dateFormat.format(timestamp);
    detail.append(date, '追加');
    if (song.productionNumber !== '1') detail.append(' ／ 制作番号 ' + song.productionNumber);
    info.append(name, detail);
    if (song.team) {
      const team = document.createElement('span');
      team.className = 'notice-team';
      team.textContent = song.team;
      info.append(team);
    }

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
      entries = await window.OuenkaNoticeFeed.load(force);
      shown = 0;
      list.replaceChildren();
      window.ouenkaHomeQueue = entries.map(entry => entry.song);
      appendPage();
      if (!document.hidden) window.OuenkaNoticeFeed.markRead(entries[0]);
    } catch {
      status.textContent = 'お知らせを読み込めませんでした。';
      retry.hidden = false;
    }
  }

  more.onclick = () => appendPage(true);
  retry.onclick = () => load(true);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && entries.length) window.OuenkaNoticeFeed.markRead(entries[0]);
  });
  load();
})();
