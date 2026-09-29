// ========================================
// 応援歌BASE MIDIプレイヤー（メロディー）
// ========================================
// 音源/メロディー の各音階WAVを使い、MIDIのノートをWeb Audioで再生します。

let midiAudioContext = null;
let midiSampleBuffers = new Map();
let midiScheduledSources = [];
let midiPlaying = false;

const MIDI_SAMPLE_ROOT = "音源/メロディー/";
const MIDI_NOTE_NAMES = {
    60:"C4",61:"Cs4",62:"D4",63:"Ds4",64:"E4",65:"F4",
    66:"Fs4",67:"G4",68:"Gs4",69:"A4",70:"As4",71:"B4"
};

async function playPlayerMidi(playerId) {
    const player = players[playerId];
    if (!player) return;

    stopMidiPlayback();
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }

    const nowPlaying = document.getElementById("nowPlaying");
    nowPlaying.textContent = "MIDIを準備中…";

    try {
        midiAudioContext = midiAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        await midiAudioContext.resume();
        await loadMidiSamples();

        const midiBuffer = await fetchPlayerMelodyMidi(player);
        const song = parseMidiFile(midiBuffer);
        scheduleMidiSong(song);

        midiPlaying = true;
        nowPlaying.textContent = "♪ MIDI再生中：" + player.name;
    } catch (error) {
        console.error("MIDI再生エラー:", error);
        nowPlaying.textContent = "MIDIを再生できませんでした";
        alert("MIDI再生の準備に失敗しました。\n" + error.message);
    }
}

function stopMidiPlayback() {
    midiScheduledSources.forEach(item => {
        try { item.source.stop(); } catch (_) {}
    });
    midiScheduledSources = [];
    midiPlaying = false;
}

async function loadMidiSamples() {
    const jobs = Object.entries(MIDI_NOTE_NAMES).map(async ([note, name]) => {
        const n = Number(note);
        if (midiSampleBuffers.has(n)) return;
        const response = await fetch(MIDI_SAMPLE_ROOT + name + ".wav", { cache: "no-store" });
        if (!response.ok) throw new Error("音源を読み込めません: " + name);
        const data = await response.arrayBuffer();
        const decoded = await midiAudioContext.decodeAudioData(data);
        midiSampleBuffers.set(n, decoded);
    });
    await Promise.all(jobs);
}

async function fetchPlayerMelodyMidi(player) {
    const candidates = [];
    if (player.melodyMidi) candidates.push(player.melodyMidi);

    // 現在のデータフォルダで使っている実ファイル名にも対応
    if (player.audio) {
        const slash = player.audio.lastIndexOf("/");
        if (slash >= 0) {
            const dir = player.audio.slice(0, slash + 1);
            candidates.push(dir + "①MIDIメロディー.mid");
            candidates.push(dir + "①MIDIメロディー.mid");
        }
    }

    for (const path of [...new Set(candidates)]) {
        try {
            const response = await fetch(path, { cache: "no-store" });
            if (response.ok) return await response.arrayBuffer();
        } catch (_) {}
    }
    throw new Error("メロディーMIDIが見つかりません");
}

function parseMidiFile(buffer) {
    const view = new DataView(buffer);
    let pos = 0;
    const readStr = n => { let s=""; while(n--) s += String.fromCharCode(view.getUint8(pos++)); return s; };
    const u16 = () => { const v=view.getUint16(pos); pos+=2; return v; };
    const u32 = () => { const v=view.getUint32(pos); pos+=4; return v; };
    const vlq = () => { let v=0,b; do { b=view.getUint8(pos++); v=(v<<7)|(b&0x7f); } while(b&0x80); return v; };

    if (readStr(4) !== "MThd") throw new Error("MIDI形式ではありません");
    const headerLen = u32();
    const format = u16();
    const tracks = u16();
    const division = u16();
    if (division & 0x8000) throw new Error("SMPTE形式のMIDIには未対応です");
    pos = 8 + headerLen;

    const events = [];
    for (let t=0; t<tracks; t++) {
        if (readStr(4) !== "MTrk") throw new Error("MIDIトラックを読めません");
        const len = u32(), end = pos + len;
        let tick=0, running=0;
        while (pos < end) {
            tick += vlq();
            let status = view.getUint8(pos++);
            if (status < 0x80) { pos--; status = running; } else if (status < 0xf0) running = status;

            if (status === 0xff) {
                const type=view.getUint8(pos++), l=vlq();
                if (type===0x51 && l===3) {
                    const tempo=(view.getUint8(pos)<<16)|(view.getUint8(pos+1)<<8)|view.getUint8(pos+2);
                    events.push({type:"tempo",tick,tempo});
                }
                pos += l;
            } else if (status === 0xf0 || status === 0xf7) {
                pos += vlq();
            } else {
                const kind=status&0xf0;
                const d1=view.getUint8(pos++);
                const d2=(kind===0xc0||kind===0xd0) ? 0 : view.getUint8(pos++);
                if (kind===0x90 && d2>0) events.push({type:"on",tick,note:d1,velocity:d2});
                else if (kind===0x80 || (kind===0x90 && d2===0)) events.push({type:"off",tick,note:d1});
            }
        }
        pos=end;
    }

    events.sort((a,b)=>a.tick-b.tick || (a.type==="tempo"?-1:0));
    return {format, division, events};
}

function scheduleMidiSong(song) {
    const tempoEvents = song.events.filter(e=>e.type==="tempo");
    if (!tempoEvents.length || tempoEvents[0].tick !== 0) tempoEvents.unshift({tick:0,tempo:500000});

    function tickToSeconds(tick) {
        let seconds=0, lastTick=0, tempo=500000;
        for (const e of tempoEvents) {
            if (e.tick > tick) break;
            seconds += (e.tick-lastTick) * tempo / 1000000 / song.division;
            lastTick=e.tick; tempo=e.tempo;
        }
        return seconds + (tick-lastTick) * tempo / 1000000 / song.division;
    }

    const active = new Map(), notes=[];
    for (const e of song.events) {
        if (e.type==="on") {
            if (!active.has(e.note)) active.set(e.note, []);
            active.get(e.note).push(e);
        } else if (e.type==="off" && active.has(e.note) && active.get(e.note).length) {
            const on=active.get(e.note).shift();
            notes.push({note:e.note, velocity:on.velocity, start:tickToSeconds(on.tick), end:tickToSeconds(e.tick)});
        }
    }
    if (!notes.length) throw new Error("MIDIにノートがありません");

    const baseTime = midiAudioContext.currentTime + 0.08;
    let lastEnd=0;
    for (const n of notes) {
        // C4〜B4のサンプルをオクターブ違いにも使用（必要時のみ再生速度を2倍/半分）
        const normalized = 60 + ((n.note - 60) % 12 + 12) % 12;
        const sample = midiSampleBuffers.get(normalized);
        if (!sample) continue;
        const octave = Math.floor((n.note - normalized) / 12);
        const rate = Math.pow(2, octave);
        const duration = Math.max(0.03, n.end-n.start);

        const source = midiAudioContext.createBufferSource();
        const gain = midiAudioContext.createGain();
        source.buffer=sample;
        source.playbackRate.value=rate;
        source.connect(gain).connect(midiAudioContext.destination);

        const start=baseTime+n.start, stop=start+duration;
        const level=Math.min(1, Math.max(0.12, n.velocity/127));
        // ごく短いクロスフェードだけを使い、ノート途中で波形を切り直さない
        const fade=Math.min(0.008, duration/4);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start+fade);
        gain.gain.setValueAtTime(level, Math.max(start+fade, stop-fade));
        gain.gain.linearRampToValueAtTime(0, stop);

        source.start(start);
        source.stop(stop+0.01);
        midiScheduledSources.push({source,gain});
        lastEnd=Math.max(lastEnd,n.end);
    }

    setTimeout(() => {
        if (midiPlaying) {
            midiPlaying=false;
            const el=document.getElementById("nowPlaying");
            if (el && el.textContent.startsWith("♪ MIDI再生中")) el.textContent="MIDI再生が終了しました";
        }
    }, (lastEnd+0.2)*1000);
}
