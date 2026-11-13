(() => {
  'use strict';
  const flag = value => ['1', 'true'].includes(String(value ?? '').trim().toLowerCase());
  window.OuenkaSongRegistrationFlags = {
    inUse(song) {
      const value = song.player_type ?? song.playerType ?? song.active ?? song.isActive ?? song.is_active;
      return ['使用中', '現在使用', '現役', 'active', 'current'].includes(String(value ?? '').trim()) || flag(value);
    },
    pitcher(song) {
      return flag(song.is_pitcher_song ?? song.isPitcherSong);
    }
  };
})();
