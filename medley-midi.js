(() => {
  'use strict';

  const ticksPerBeat = 960;
  const ticksPerBar = 4 * ticksPerBeat;
  const roles = [
    { name: 'Melody', label: 'メロディー', program: 56 },
    { name: 'Chords', label: 'コード', program: 0 },
    { name: 'Bass', label: 'ベース', program: 33 }
  ];
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  function zipEntries(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = bytes.length - 22;
    while (end >= Math.max(0, bytes.length - 65557)) {
      if (view.getUint32(end, true) === 0x06054b50 &&
          end + 22 + view.getUint16(end + 20, true) === bytes.length) break;
      end--;
    }
    if (end < Math.max(0, bytes.length - 65557)) throw Error('GarageBandのZIPを選んでください。');
    const count = view.getUint16(end + 10, true);
    const entries = [];
    let at = view.getUint32(end + 16, true);
    for (let i = 0; i < count; i++) {
      if (view.getUint32(at, true) !== 0x02014b50) throw Error('ZIPを読み込めません。');
      const nameLength = view.getUint16(at + 28, true);
      const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
      const size = view.getUint32(at + 20, true);
      const expanded = view.getUint32(at + 24, true);
      const method = view.getUint16(at + 10, true);
      const local = view.getUint32(at + 42, true);
      if (!name.startsWith('__MACOSX/') && !name.split('/').pop().startsWith('._')) {
        entries.push({ name, async read() {
          if (expanded > 96 * 1024 * 1024 || view.getUint32(local, true) !== 0x04034b50) {
            throw Error('ZIP内のプロジェクトを読み込めません。');
          }
          const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
          const compressed = bytes.subarray(start, start + size);
          if (method === 0 && compressed.length === expanded) return compressed;
          if (method !== 8) throw Error('このZIPの圧縮方式には対応していません。');
          const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          const output = new Uint8Array(await new Response(stream).arrayBuffer());
          if (output.length !== expanded) throw Error('ZIPのサイズが一致しません。');
          return output;
        } });
      }
      at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    }
    return entries;
  }

  async function readProject(blob) {
    let entries = zipEntries(new Uint8Array(await blob.arrayBuffer()));
    let data = entries.find(e => /(?:^|\/)projectData$/.test(e.name));
    if (!data) {
      const archive = entries.find(e => /\.(band|zip)$/i.test(e.name));
      if (archive) {
        entries = zipEntries(await archive.read());
        data = entries.find(e => /(?:^|\/)projectData$/.test(e.name));
      }
    }
    if (!data) throw Error('GarageBandのprojectDataが見つかりません。');
    const xml = decoder.decode(await data.read());
    const encoded = xml.match(/<key>NS\.data<\/key>\s*<data>([\s\S]*?)<\/data>/)?.[1];
    if (!encoded) throw Error('この形式のGarageBandプロジェクトには対応していません。');
    const song = Uint8Array.from(atob(encoded.replace(/\s/g, '')), c => c.charCodeAt(0));
    const metadata = entries.find(e => /\/Output\/metadata\.plist$/.test('/' + e.name));
    const meta = metadata ? decoder.decode(await metadata.read()) : '';
    const tempo = Number(meta.match(/metadata_songTempo<\/key>\s*<(?:integer|real)>([\d.]+)/)?.[1]) || 170;
    const beats = Number(meta.match(/metadata_songSignatureNominator<\/key>\s*<integer>(\d+)/)?.[1]) || 4;
    const unit = Number(meta.match(/metadata_songSignatureDeNominator<\/key>\s*<integer>(\d+)/)?.[1]) || 4;
    if (beats !== 4 || unit !== 4) throw Error('このMIDI出力は4/4拍子に対応しています。');
    return { tempo, tracks: readTracks(song) };
  }

  function readTracks(song) {
    const view = new DataView(song.buffer, song.byteOffset, song.byteLength);
    const tracks = [];
    const seen = new Set();
    for (let at = 0; at + 36 <= song.length; at++) {
      if (view.getUint32(at) !== 0x71537645 || view.getUint16(at + 4, true) !== 1 ||
          view.getUint16(at + 6, true) !== 23) continue;
      const size = view.getUint32(at + 28, true);
      const end = at + 36 + size;
      if (size % 16 || end > song.length) continue;
      const notes = [];
      for (let pos = at + 36; pos + 32 <= end; pos += 16) {
        if ((song[pos] & 240) !== 144 || song[pos + 23] !== 137) continue;
        const tick = view.getUint32(pos + 4, true);
        const duration = view.getUint32(pos + 28, true);
        const pitch = song[pos + 12];
        const velocity = song[pos + 11];
        if (duration && pitch < 128 && velocity > 0 && velocity < 128) {
          notes.push({ tick, duration, pitch, velocity });
        }
        pos += 16;
      }
      if (!notes.length) continue;
      // GarageBand can retain copies of the same MIDI sequence.
      const key = JSON.stringify(notes);
      if (seen.has(key)) continue;
      seen.add(key);
      const first = notes.reduce((min, n) => Math.min(min, n.tick), Infinity);
      const last = notes.reduce((max, n) => Math.max(max, n.tick + n.duration), 0);
      tracks.push({ notes, firstBar: Math.floor(first / ticksPerBar) + 1, lastBar: Math.ceil(last / ticksPerBar) });
    }
    if (!tracks.length) throw Error('打ち込みのノートデータが見つかりません。');
    return tracks;
  }

  function vlq(value) {
    if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) throw Error('MIDIの時間範囲を超えています。');
    const bytes = [value & 127];
    while (value > 127) {
      value >>>= 7;
      bytes.unshift((value & 127) | 128);
    }
    return bytes;
  }

  function midiFile(projects) {
    const parts = roles.map(() => []);
    const tempoEvents = [{ tick: 0, data: [255, 88, 4, 4, 2, 24, 8] }];
    let cursor = 0, previousTempo = 0;
    for (const project of projects) {
      const { startBar, endBar, tempo, tracks, assignments } = project;
      if (!Number.isInteger(startBar) || !Number.isInteger(endBar) || startBar < 1 || endBar < startBar) {
        throw Error('開始小節と終了小節を確認してください。');
      }
      if (!Number.isFinite(tempo) || tempo < 20 || tempo > 400) throw Error('テンポは20〜400 BPMで指定してください。');
      const start = (startBar - 1) * ticksPerBar;
      const end = endBar * ticksPerBar;
      let hasNotes = false;
      if (tempo !== previousTempo) {
        const us = Math.round(60000000 / tempo);
        tempoEvents.push({ tick: cursor, data: [255, 81, 3, us >>> 16, (us >>> 8) & 255, us & 255] });
        previousTempo = tempo;
      }
      assignments.forEach((index, channel) => {
        for (const n of tracks[index]?.notes || []) {
          if (n.tick >= end || n.tick + n.duration <= start) continue;
          const on = cursor + Math.max(start, n.tick) - start;
          const off = cursor + Math.min(end, n.tick + n.duration) - start;
          parts[channel].push({ tick: on, data: [144 + channel, n.pitch, n.velocity] });
          parts[channel].push({ tick: off, data: [128 + channel, n.pitch, 0] });
          hasNotes = true;
        }
      });
      if (!hasNotes) throw Error(`${project.name} の指定範囲とトラックにノートがありません。`);
      cursor += end - start;
    }
    const chunks = [];
    const header = new Uint8Array([77,84,104,100, 0,0,0,6, 0,1, 0,4, 3,192]);
    chunks.push(header);
    function appendTrack(events) {
      const data = [];
      let position = 0;
      for (const event of events) {
        data.push(...vlq(event.tick - position), ...event.data);
        position = event.tick;
      }
      data.push(...vlq(cursor - position), 255, 47, 0);
      const chunk = new Uint8Array([77,84,114,107,0,0,0,0]);
      new DataView(chunk.buffer).setUint32(4, data.length);
      chunks.push(chunk, Uint8Array.from(data));
    }
    appendTrack(tempoEvents);
    parts.forEach((events, channel) => {
      const name = encoder.encode(roles[channel].name);
      events.sort((a,b) => a.tick-b.tick || a.data[0]-b.data[0]);
      events.unshift(
        { tick: 0, data: [255,3,name.length,...name] },
        { tick: 0, data: [192+channel,roles[channel].program] }
      );
      appendTrack(events);
    });
    return new Blob(chunks, { type: 'audio/midi' });
  }

  function mount({ selected, title }) {
    const dialog = document.getElementById('medleyMidiDialog');
    const list = dialog.querySelector('[data-projects]');
    const status = dialog.querySelector('[role=status]');
    const files = dialog.querySelector('input[type=file]');
    const fromList = dialog.querySelector('[data-registered]');
    const save = dialog.querySelector('[data-export]');
    let busy = false;
    const cards = [];

    function addProject(project, name) {
      const card = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = name;
      card.append(legend);
      const labelFor = (label, input) => {
        const wrapper = document.createElement('label');
        wrapper.append(label, input);
        card.append(wrapper);
      };
      const number = (label, value, min, max) => {
        const input = document.createElement('input');
        Object.assign(input, { type: 'number', value, min, max, step: 1 });
        labelFor(label, input);
        return input;
      };
      const max = Math.max(...project.tracks.map(t => t.lastBar));
      const start = number('開始小節', Math.min(...project.tracks.map(t => t.firstBar)), 1, max);
      const end = number('終了小節', max, 1, max);
      const bpm = number('テンポ (BPM)', project.tempo, 20, 400);
      bpm.step = 'any';
      const assignments = roles.map(role => {
        const select = document.createElement('select');
        select.add(new Option('なし', '-1'));
        project.tracks.forEach((track, i) => {
          select.add(new Option(`トラック ${i+1} · ${track.firstBar}〜${track.lastBar}小節 · ${track.notes.length}音`, i));
        });
        labelFor(role.label, select);
        return select;
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'この曲を外す';
      const read = () => ({
        ...project, name, startBar: start.valueAsNumber, endBar: end.valueAsNumber,
        tempo: bpm.valueAsNumber, assignments: assignments.map(input => Number(input.value))
      });
      remove.onclick = () => { cards.splice(cards.indexOf(read), 1); card.remove(); };
      card.append(remove);
      list.append(card);
      cards.push(read);
    }

    async function load(action) {
      if (busy) return;
      busy = true;
      files.disabled = fromList.disabled = save.disabled = true;
      status.textContent = 'GarageBandのノートを読み込み中…';
      try { await action(); }
      catch (error) { status.textContent = error.message || String(error); }
      finally {
        busy = false;
        files.disabled = fromList.disabled = save.disabled = false;
      }
    }

    document.getElementById('medleyMidiButton').onclick = () => dialog.showModal();
    files.onchange = () => load(async () => {
      const chosen = [...files.files];
      files.value = '';
      const errors = [];
      for (const file of chosen) {
        try { addProject(await readProject(file), file.name); }
        catch (error) { errors.push(`${file.name} — ${error.message}`); }
      }
      status.textContent = errors.join('\n');
    });
    fromList.onclick = () => load(async () => {
      const songs = await selected();
      if (!songs.length) throw Error('メドレーに曲を選んでください。');
      const loaded = [];
      for (const song of songs) {
        try {
          const response = await fetch(song.garagebandUrl, { signal: AbortSignal.timeout(20000) });
          if (!response.ok) throw Error('GarageBandファイルを取得できません。');
          const project = await readProject(await response.blob());
          loaded.push({ project: { ...project, tempo: song.tempo }, name: song.name });
        } catch (error) {
          throw Error(`${song.name} — ${error.message} 手元のプロジェクトを追加できます。`);
        }
      }
      loaded.forEach(({ project, name }) => addProject(project, name));
      status.textContent = '';
    });
    save.onclick = () => {
      try {
        if (!cards.length) throw Error('GarageBandプロジェクトを追加してください。');
        if ([...list.querySelectorAll('input')].some(input => !input.checkValidity())) {
          throw Error('曲ごとの小節範囲とテンポを確認してください。');
        }
        const blob = midiFile(cards.map(read => read()));
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = (title().trim() || 'メドレー').replace(/[\\/:*?"<>|]/g, '_') + '.mid';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        status.textContent = 'MIDIを書き出しました。';
      } catch (error) { status.textContent = error.message || String(error); }
    };
  }

  window.OuenkaMedleyMidi = { mount };
})();
