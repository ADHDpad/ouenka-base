(() => {
  'use strict';

  const start = document.getElementById('humStart');
  const stop = document.getElementById('humStop');
  const cancel = document.getElementById('humCancel');
  const status = document.getElementById('humStatus');
  const results = document.getElementById('humResults');
  const api = 'https://ouenka-base-data.ninzin5600.workers.dev/songs';
  const audioRoot = 'https://adhdpad.github.io/ouenka-base/データ/';
  const cacheLifetime = 7 * 24 * 60 * 60 * 1000;
  let current = null;

  function busy(phase) {
    start.disabled = !!phase;
    stop.hidden = phase !== 'recording';
    cancel.hidden = !phase;
  }

  function clean(job) {
    if (current !== job) return;
    current = null;
    clearTimeout(job.timer);
    job.controller.abort();
    job.stream?.getTracks().forEach(track => track.stop());
    if (job.recorder?.state === 'recording') job.recorder.stop();
    job.worker?.terminate();
    job.context?.close().catch(() => {});
    busy('');
  }

  function workerClient(worker, signal) {
    let id = 0;
    const pending = new Map();
    worker.onmessage = ({data}) => {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.error) job.reject(Error(data.error));
      else job.resolve(data.result);
    };
    let failure;
    function fail(error) {
      failure = error;
      for (const job of pending.values()) job.reject(error);
      pending.clear();
    }
    worker.onerror = () => fail(Error('音程の解析を開始できませんでした。'));
    signal.addEventListener('abort', () => fail(signal.reason), {once: true});
    return (message, transfer = []) => new Promise((resolve, reject) => {
      if (failure) return reject(failure);
      pending.set(++id, {resolve, reject});
      worker.postMessage({id, ...message}, transfer);
    });
  }

  async function analyse(job, encoded, seconds) {
    const buffer = await job.context.decodeAudioData(encoded);
    const length = Math.min(buffer.length, Math.ceil(buffer.sampleRate * seconds));
    const source = buffer.getChannelData(0).slice(0, length);
    return job.run({source, rate: buffer.sampleRate}, [source.buffer]);
  }

  async function referenceContour(job, song) {
    const name = encodeURIComponent(song.name);
    const number = encodeURIComponent(song.productionNumber);
    const key = new URL('./hum-pitch-worker.js', location.href);
    key.searchParams.set('song', song.id ?? song.name + '#' + song.productionNumber);
    const cached = await job.cache?.match(key).then(response => response?.json()).catch(() => null);
    if (Array.isArray(cached?.contour) && Date.now() - cached.savedAt < cacheLifetime) return cached.contour;

    const paths = [name + '/' + number + '/melody.m4a', name + '_' + number + '/melody.m4a',
      name + '/' + number + '_melody.m4a'];
    if (number === '1') paths.push(name + '/melody.m4a');
    for (const path of paths) {
      const response = await fetch(audioRoot + path, {signal: AbortSignal.any([job.controller.signal, AbortSignal.timeout(12000)])});
      if (response.status === 404 || response.status === 410) continue;
      if (!response.ok) throw Error('HTTP ' + response.status);
      const contour = await analyse(job, await response.arrayBuffer(), 40);
      await job.cache?.put(key, new Response(JSON.stringify({contour, savedAt: Date.now()}))).catch(() => {});
      return contour;
    }
    return [];
  }

  async function search(job, audio) {
    busy('searching');
    status.textContent = '鼻歌の音程を解析しています…';
    job.worker = new Worker('hum-pitch-worker.js?v=20261126');
    job.run = workerClient(job.worker, job.controller.signal);
    const query = await analyse(job, await audio.arrayBuffer(), 12);
    const pitches = query.filter(pitch => pitch !== null).sort((a, b) => a - b);
    if (pitches.length < 20 || pitches[Math.floor(pitches.length * .9)] - pitches[Math.floor(pitches.length * .1)] < 1) {
      throw Error('音程の動きを読み取れませんでした。メロディーを数秒続けて歌い直してください。');
    }
    const response = await fetch(api, {cache: 'no-store', signal: AbortSignal.any([job.controller.signal, AbortSignal.timeout(20000)])});
    if (!response.ok) throw Error('登録曲一覧を取得できませんでした。');
    const data = await response.json();
    if (!Array.isArray(data.songs)) throw Error('登録曲一覧を確認できませんでした。');
    const songs = data.songs.map(song => ({
      ...song, name: String(song.player_name ?? song.name ?? '').trim(),
      productionNumber: String(song.production_number ?? song.productionNumber ?? '').trim()
    })).filter(song => song.name && song.productionNumber);
    job.cache = await window.caches?.open('ouenka-hum-pitches-v1').catch(() => null);
    let cursor = 0, complete = 0, compared = 0, lastUpdate = 0;
    status.textContent = '登録曲と照合しています… 0 / ' + songs.length + '曲';
    const matches = [];

    async function compareSongs() {
      while (cursor < songs.length && !job.controller.signal.aborted) {
        const song = songs[cursor++];
        try {
          const reference = await referenceContour(job, song);
          if (reference.length >= 20) {
            const score = await job.run({query, reference});
            compared++;
            if (score <= 4.2) matches.push({song, score});
          }
        } catch (error) {
          if (job.controller.signal.aborted) return;
        }
        complete++;
        if (current === job && (complete === songs.length || Date.now() - lastUpdate > 150)) {
          lastUpdate = Date.now();
          status.textContent = '登録曲と照合しています… ' + complete + ' / ' + songs.length + '曲';
        }
      }
    }

    await Promise.all(Array.from({length: 3}, compareSongs));
    if (current !== job) return;
    const candidates = matches.sort((a, b) => a.score - b.score).slice(0, 8).map(entry => entry.song);
    results.replaceChildren(...candidates.map(song => window.OuenkaLyricCandidates.create(song, selected => {
      window.ouenkaHomeQueue = candidates;
      window.playSongData(selected);
    })));
    status.textContent = (candidates.length ? '候補 ' + candidates.length + '曲' : '近い候補が見つかりませんでした。') +
      '（' + compared + ' / ' + songs.length + '曲を照合）';
  }

  start.onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder || !AbortSignal.any) {
      status.textContent = 'このブラウザでは鼻歌を録音できません。';
      return;
    }
    const job = {controller: new AbortController()};
    current = job;
    busy('permission');
    results.replaceChildren();
    status.textContent = 'マイクの使用を許可してください。';
    try {
      job.context = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (current !== job) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      job.stream = stream;
      const recorder = new MediaRecorder(stream);
      job.recorder = recorder;
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (current !== job) return;
        status.textContent = '録音できませんでした。';
        clean(job);
      };
      recorder.onstop = async () => {
        clearTimeout(job.timer);
        stream.getTracks().forEach(track => track.stop());
        if (current !== job) return;
        try {
          if (!chunks.length) throw Error('録音データを取得できませんでした。');
          await search(job, new Blob(chunks, {type: recorder.mimeType}));
        } catch (error) {
          if (current === job) status.textContent = error.message || '鼻歌を検索できませんでした。';
        } finally {
          clean(job);
        }
      };
      recorder.start();
      busy('recording');
      status.textContent = '録音中… メロディーを歌い終えたら「録音終了・検索」を押してください。';
      job.timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), 12000);
    } catch (error) {
      if (current !== job) return;
      status.textContent = error.name === 'NotAllowedError' ? 'マイクへのアクセスを許可してください。' : 'マイクで録音を開始できませんでした。';
      clean(job);
    }
  };
  stop.onclick = () => {
    if (current?.recorder?.state === 'recording') {
      busy('searching');
      current.recorder.stop();
    }
  };
  cancel.onclick = () => {
    if (current) clean(current);
    status.textContent = '中止しました。';
  };
  window.addEventListener('pagehide', () => { if (current) clean(current); });
})();
