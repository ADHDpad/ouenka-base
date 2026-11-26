(() => {
  'use strict';

  const size = 4096;
  const analysisRate = 11025;
  const hop = 220;
  const ppq = 960;
  const windowCurve = Float32Array.from({ length: size }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / size));
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));

  function spectrum(real, imag) {
    imag.fill(0);
    for (let i = 1, j = 0; i < size; i++) {
      let bit = size >> 1;
      while (j & bit) { j ^= bit; bit >>= 1; }
      j ^= bit;
      if (i < j) [real[i], real[j]] = [real[j], real[i]];
    }
    for (let length = 2; length <= size; length *= 2) {
      const step = -2 * Math.PI / length;
      for (let j = 0; j < length / 2; j++) {
        const cos = Math.cos(step * j), sin = Math.sin(step * j);
        for (let i = j; i < size; i += length) {
          const other = i + length / 2;
          const r = real[other] * cos - imag[other] * sin;
          const im = real[other] * sin + imag[other] * cos;
          real[other] = real[i] - r;
          imag[other] = imag[i] - im;
          real[i] += r;
          imag[i] += im;
        }
      }
    }
  }

  function pitches(real, imag, melody) {
    const magnitude = Float32Array.from(real.subarray(0, 1100), (r, i) => Math.hypot(r, imag[i]));
    const peaks = [];
    for (let i = 13; i < 900; i++) {
      const value = magnitude[i];
      if (value < 1.4 || value <= magnitude[i - 1] || value <= magnitude[i + 1]) continue;
      const left = Math.log(magnitude[i - 1] || .001), middle = Math.log(value), right = Math.log(magnitude[i + 1] || .001);
      const bin = i + .5 * (left - right) / (left - 2 * middle + right);
      const pitch = 69 + 12 * Math.log2(bin * analysisRate / size / 440);
      if (pitch >= (melody ? 47.5 : 27.5) && pitch <= 96.5) peaks.push({ bin, pitch: Math.round(pitch), value });
    }
    const strongest = peaks.reduce((max, peak) => Math.max(max, peak.value), 0);
    const fundamentals = peaks.filter(peak => peak.value >= strongest * (melody ? .18 : .12) &&
      !peaks.some(low => {
        const multiple = Math.round(peak.bin / low.bin);
        return multiple >= 2 && multiple <= 8 && Math.abs(peak.bin - multiple * low.bin) < 1.6 &&
          low.value > peak.value * (melody ? .36 : 1.8);
      }));
    fundamentals.sort((a,b) => b.value - a.value);
    if (melody) return [fundamentals.slice(0, 1)];
    const bass = fundamentals.filter(p => p.pitch < 56).sort((a,b) => a.pitch - b.pitch).slice(0, 1);
    const chords = fundamentals.filter(p => p.pitch >= 48 && p !== bass[0]).slice(0, 4);
    return [chords, bass];
  }

  async function analyze(buffer, melody, progress) {
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const stride = buffer.sampleRate / analysisRate;
    const real = new Float32Array(size), imag = new Float32Array(size);
    const active = Array.from({ length: melody ? 1 : 2 }, () => new Map());
    const result = active.map(() => []);
    const frames = Math.ceil(buffer.duration * analysisRate / hop);
    function close(notes, pitch, note, frame) {
      if (note.hits < 3) return;
      const start = Math.max(0, (note.start - .5) * hop / analysisRate);
      const end = Math.min(buffer.duration, (frame - .5) * hop / analysisRate);
      if (end > start) notes.push({ pitch, start, end, velocity: Math.min(110, 45 + Math.round(12 * Math.log2(note.peak))) });
    }

    for (let frame = 0; frame < frames; frame++) {
      // Center the effective window on the frame, retaining zero padding at both edges.
      const width = 1536, pad = (size - width) / 2;
      real.fill(0);
      for (let i = pad; i < size - pad; i++) {
        const at = Math.round((frame * hop + i - size / 2) * stride);
        if (at < 0 || at >= buffer.length) continue;
        let sample = 0;
        for (const channel of channels) sample += channel[at];
        real[i] = sample / channels.length * windowCurve[Math.floor((i-pad) * size / width)];
      }
      spectrum(real, imag);
      pitches(real, imag, melody).forEach((peaks, part) => {
        const playing = new Map(peaks.map(p => [p.pitch, p.value]));
        for (const [pitch, note] of active[part]) {
          if (playing.has(pitch)) continue;
          close(result[part], pitch, note, frame);
          active[part].delete(pitch);
        }
        for (const [pitch, value] of playing) {
          const note = active[part].get(pitch);
          if (note) { note.hits++; note.peak = Math.max(note.peak, value); }
          else active[part].set(pitch, { start: frame, hits: 1, peak: value });
        }
      });
      if (frame % 48 === 0) { progress(frame / frames); await pause(); }
    }
    active.forEach((part, i) => {
      for (const [pitch, note] of part) close(result[i], pitch, note, frames);
    });
    return result;
  }

  function variableLength(value) {
    const bytes = [value & 127];
    while (value > 127) { value >>>= 7; bytes.unshift((value & 127) | 128); }
    return bytes;
  }

  function encode(parts, timeline, duration) {
    const chunks = [Uint8Array.of(77,84,104,100,0,0,0,6,0,1,0,4,3,192)];
    const changes = [];
    timeline.starts.forEach((time, i) => {
      const us = Math.round(60000000 / timeline.tempos[i]);
      const prev = changes.at(-1);
      if (prev?.us === us) return;
      const tick = prev ? prev.tick + Math.round((time - prev.time) * 1000000 * ppq / prev.us) : 0;
      changes.push({ time, tick, us });
    });
    function tickAt(time) {
      const change = changes.findLast(c => c.time <= time) ?? changes[0];
      return Math.max(0, change.tick + Math.round((time - change.time) * 1000000 * ppq / change.us));
    }
    function track(events) {
      const bytes = [];
      let tick = 0;
      for (const event of events) {
        bytes.push(...variableLength(event.tick - tick), ...event.data);
        tick = event.tick;
      }
      bytes.push(...variableLength(Math.max(0, tickAt(duration) - tick)), 255,47,0);
      const head = Uint8Array.of(77,84,114,107,0,0,0,0);
      new DataView(head.buffer).setUint32(4, bytes.length);
      chunks.push(head, Uint8Array.from(bytes));
    }
    track(changes.map(({tick,us}) => ({ tick, data: [255,81,3,us >>> 16,(us >>> 8) & 255,us & 255] })));
    parts.forEach((notes, channel) => {
      const name = new TextEncoder().encode(['Melody','Chords','Bass'][channel]);
      const events = notes.flatMap(n => {
        const tick = tickAt(n.start), end = Math.max(tick + 1, tickAt(n.end));
        return [{tick,data:[144+channel,n.pitch,n.velocity]}, {tick:end,data:[128+channel,n.pitch,0]}];
      });
      events.sort((a,b) => a.tick-b.tick || a.data[0]-b.data[0]);
      events.unshift({tick:0,data:[255,3,name.length,...name]}, {tick:0,data:[192+channel,[56,0,33][channel]]});
      track(events);
    });
    return new Blob(chunks, { type: 'audio/midi' });
  }

  function mount(prepare) {
    const button = document.getElementById('medleyMidiButton');
    const status = document.getElementById('medleyMidiStatus');
    const download = document.getElementById('medleyMidiDownload');
    button.onclick = async () => {
      button.disabled = true;
      download.hidden = true;
      if (download.href) URL.revokeObjectURL(download.href);
      status.textContent = 'メドレーの音声を読み込み中…';
      try {
        const {ctx,timeline,title,isCurrent} = await prepare();
        const core = window.OuenkaMedleyCore;
        const melody = core.renderPart(ctx,timeline,'melody');
        const report = (name, value) => {
          if (!isCurrent()) throw Error('曲順や設定が変わりました。もう一度お試しください。');
          status.textContent = name + 'を解析中… ' + Math.floor(value*100) + '%';
        };
        const [lead] = await analyze(melody,true,value => report('メロディー',value));
        const duration = melody.duration;
        const [chords,bass] = await analyze(core.renderPart(ctx,timeline,'accompaniment'),false,value => report('コード・ベース',value));
        if (![lead,chords,bass].some(notes => notes.length)) throw Error('MIDIに変換できる音符が見つかりませんでした。');
        report('メドレー',1);
        download.href = URL.createObjectURL(encode([lead,chords,bass],timeline,duration));
        download.download = (title.trim() || 'メドレー').replace(/[\\/:*?"<>|]/g,'_') + '.mid';
        download.hidden = false;
        status.textContent = 'MIDIができました。音声から推定した音符です。';
      } catch (error) {
        status.textContent = error.message || String(error);
      } finally {
        button.disabled = false;
      }
    };
  }

  window.OuenkaMedleyMidi = { mount };
})();
