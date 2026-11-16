(() => {
  'use strict';
  const test = document.getElementById('test');
  const close = document.getElementById('close');
  const status = document.getElementById('status');

  test.onclick = () => {
    let context;
    let timer;
    test.disabled = true;
    status.textContent = '確認音を再生しています…';
    function finish(message) {
      clearTimeout(timer);
      if (context && context.state !== 'closed') context.close().catch(() => {});
      status.textContent = message;
      test.disabled = false;
      close.hidden = false;
    }
    try {
      context = window.ouenkaAudioRecovery.create();
      const tone = context.createOscillator();
      const volume = context.createGain();
      const start = context.currentTime + 0.04;
      tone.frequency.value = 523.25;
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(0.12, start + 0.025);
      volume.gain.linearRampToValueAtTime(0, start + 0.32);
      tone.connect(volume).connect(context.destination);
      tone.onended = () => finish('確認音が聞こえたら、タブを閉じて応援歌BASEに戻ってください。');
      tone.start(start);
      tone.stop(start + 0.33);
      timer = setTimeout(() => {
        tone.onended = null;
        finish('確認音を再生できませんでした。もう一度押してください。');
      }, 2400);
    } catch {
      finish('確認音を再生できませんでした。もう一度押してください。');
    }
  };
  close.onclick = () => {
    status.textContent = '画面が残る場合は、このタブを手動で閉じて応援歌BASEに戻ってください。';
    window.close();
  };
})();
