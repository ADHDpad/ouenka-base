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
    disconnectCapture(job);
    job.worker?.terminate();
    job.context?.close().catch(() => {});
    busy('');
  }

  function disconnectCapture(job) {
    if (job.processor) {
      job.processor.onaudioprocess = null;
      job.processor.disconnect();
      job.processor = null;
    }
    job.input?.disconnect();
    job.input = null;
  }

  async function fetchWithTimeout(job, url, milliseconds, options = {}) {
    const controller = new AbortController();
    const signal = job.controller.signal;
    const abort = () => controller.abort();
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(abort, milliseconds);
    try {
      const response = await fetch(url, {...options, signal: controller.signal});
      return {response, body: response.ok ? await response.arrayBuffer() : null};
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
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
      const {response, body} = await fetchWithTimeout(job, audioRoot + path, 12000);
      if (response.status === 404 || response.status === 410) continue;
      if (!response.ok) throw Error('HTTP ' + response.status);
      const contour = await analyse(job, body, 40);
      await job.cache?.put(key, new Response(JSON.stringify({contour, savedAt: Date.now()}))).catch(() => {});
      return contour;
    }
    return [];
  }

  async function search(job, source) {
    busy('searching');
    status.textContent = '鼻歌の音程を解析しています…';
    job.worker = new Worker('hum-pitch-worker.js?v=20261126');
    job.run = workerClient(job.worker, job.controller.signal);
    const query = await job.run({source, rate: job.context.sampleRate}, [source.buffer]);
    const pitches = query.filter(pitch => pitch !== null).sort((a, b) => a - b);
    if (pitches.length < 20 || pitches[Math.floor(pitches.length * .9)] - pitches[Math.floor(pitches.length * .1)] < 1) {
      throw Error('音程の動きを読み取れませんでした。メロディーを数秒続けて歌い直してください。');
    }
    const {response, body} = await fetchWithTimeout(job, api, 20000, {cache: 'no-store'});
    if (!response.ok) throw Error('登録曲一覧を取得できませんでした。');
    const data = JSON.parse(new TextDecoder().decode(body));
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

  async function finishRecording(job) {
    if (current !== job || !job.processor) return;
    clearTimeout(job.timer);
    disconnectCapture(job);
    job.stream.getTracks().forEach(track => track.stop());
    try {
      if (!job.samplesWritten) throw Error('マイクの音を取得できませんでした。マイクを確認して録音し直してください。');
      await search(job, job.samples.subarray(0, job.samplesWritten));
    } catch (error) {
      if (current === job) status.textContent = error.message || '鼻歌を検索できませんでした。';
    } finally {
      clean(job);
    }
  }

  function recordingError(error) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'SafariのWebサイト設定で「マイク」を許可して、録音し直してください。';
      case 'NotFoundError':
        return 'マイクが見つかりません。マイクの接続を確認してください。';
      case 'NotReadableError':
      case 'AbortError':
        return 'マイクを使えませんでした。通話や別の録音を終了してからお試しください。';
      default:
        return 'マイクで録音を開始できませんでした（' + (error.name || '不明なエラー') + '）。';
    }
  }

  start.onclick = async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (current) return;
    if (!navigator.mediaDevices?.getUserMedia || !AudioContext?.prototype.createScriptProcessor) {
      status.textContent = 'このブラウザでは鼻歌を録音できません。';
      return;
    }
    const job = {controller: new AbortController(), samplesWritten: 0};
    current = job;
    busy('permission');
    results.replaceChildren();
    status.textContent = 'マイクの使用を許可してください。';
    try {
      job.context = new AudioContext();
      job.context.resume().catch(() => {});
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (current !== job) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      job.stream = stream;
      job.samples = new Float32Array(Math.ceil(job.context.sampleRate * 12));
      job.input = job.context.createMediaStreamSource(stream);
      job.processor = job.context.createScriptProcessor(4096, 1, 1);
      job.processor.onaudioprocess = event => {
        if (current !== job || !job.processor) return;
        const input = event.inputBuffer.getChannelData(0);
        const length = Math.min(input.length, job.samples.length - job.samplesWritten);
        job.samples.set(input.subarray(0, length), job.samplesWritten);
        job.samplesWritten += length;
        if (job.samplesWritten === job.samples.length) finishRecording(job);
      };
      job.input.connect(job.processor);
      // The output buffer stays silent while the processor reads the microphone.
      job.processor.connect(job.context.destination);
      if (job.context.state !== 'running') job.context.resume().catch(() => {});
      busy('recording');
      status.textContent = '録音中… メロディーを歌い終えたら「録音終了・検索」を押してください。';
      job.timer = setTimeout(() => finishRecording(job), 12000);
    } catch (error) {
      if (current !== job) return;
      status.textContent = recordingError(error);
      clean(job);
    }
  };
  stop.onclick = () => { if (current) finishRecording(current); };
  cancel.onclick = () => {
    if (current) clean(current);
    status.textContent = '中止しました。';
  };
  window.addEventListener('pagehide', () => { if (current) clean(current); });
})();
