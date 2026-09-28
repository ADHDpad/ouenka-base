// ========================================
// 応援歌BASE MIDIプレイヤー
// GarageBandから作った音源でMIDIを演奏
// ========================================

let midiAudioContext = null;
let midiPlaying = false;
let midiSources = [];


// ========================================
// 音源設定
// ========================================

const soundFolders = {

    melody: "音源/メロディー/",
    chord: "音源/コード進行/",
    bass: "音源/ベース/"

};


// ========================================
// 12音のファイル名
// ========================================

const noteNames = [
    "C",
    "Cs",
    "D",
    "Ds",
    "E",
    "F",
    "Fs",
    "G",
    "Gs",
    "A",
    "As",
    "B"
];


// ========================================
// 読み込んだ音源を保存
// ========================================

const soundBuffers = {

    melody: {},
    chord: {},
    bass: {}

};


// ========================================
// ドラム
// ========================================

let drumBuffer = null;


// ========================================
// MIDIから可変長数値を読む
// ========================================

function readVariableLength(data, state) {

    let value = 0;

    while (true) {

        const byte = data[state.pos++];

        value =
            (value << 7) |
            (byte & 0x7F);

        if ((byte & 0x80) === 0) {
            break;
        }

    }

    return value;
}


// ========================================
// 32bit整数
// ========================================

function readUint32(data, pos) {

    return (
        data[pos] * 0x1000000 +
        data[pos + 1] * 0x10000 +
        data[pos + 2] * 0x100 +
        data[pos + 3]
    );

}


// ========================================
// MIDI解析
// ========================================

function parseMidi(arrayBuffer) {

    const data =
        new Uint8Array(arrayBuffer);

    const division =
        (data[12] << 8) |
        data[13];

    let pos = 14;

    const notes = [];

    let tempo = 500000;


    while (pos < data.length) {

        // MTrkを探す
        if (
            data[pos] !== 0x4D ||
            data[pos + 1] !== 0x54 ||
            data[pos + 2] !== 0x72 ||
            data[pos + 3] !== 0x6B
        ) {

            pos++;

            continue;
        }


        const trackLength =
            readUint32(
                data,
                pos + 4
            );


        const trackEnd =
            pos + 8 + trackLength;


        const state = {
            pos: pos + 8
        };


        let tick = 0;

        let runningStatus = 0;

        const activeNotes = {};


        while (state.pos < trackEnd) {

            const delta =
                readVariableLength(
                    data,
                    state
                );

            tick += delta;


            let status =
                data[state.pos];


            // Running Status
            if (status < 0x80) {

                status =
                    runningStatus;

            } else {

                state.pos++;

                runningStatus =
                    status;

            }


            // =================================
            // Meta Event
            // =================================

            if (status === 0xFF) {

                const type =
                    data[state.pos++];

                const length =
                    readVariableLength(
                        data,
                        state
                    );


                // Tempo
                if (
                    type === 0x51 &&
                    length === 3
                ) {

                    tempo =
                        data[state.pos] *
                        65536 +

                        data[state.pos + 1] *
                        256 +

                        data[state.pos + 2];

                }


                state.pos += length;

                continue;
            }


            // =================================
            // SysEx
            // =================================

            if (
                status === 0xF0 ||
                status === 0xF7
            ) {

                const length =
                    readVariableLength(
                        data,
                        state
                    );

                state.pos += length;

                continue;
            }


            const command =
                status & 0xF0;


            // =================================
            // Note ON
            // =================================

            if (command === 0x90) {

                const note =
                    data[state.pos++];

                const velocity =
                    data[state.pos++];


                if (velocity > 0) {

                    activeNotes[note] = {
                        tick: tick,
                        velocity: velocity
                    };

                } else {

                    finishNote(
                        activeNotes,
                        notes,
                        note,
                        tick
                    );

                }

            }


            // =================================
            // Note OFF
            // =================================

            else if (command === 0x80) {

                const note =
                    data[state.pos++];

                state.pos++;

                finishNote(
                    activeNotes,
                    notes,
                    note,
                    tick
                );

            }


            // =================================
            // Program Change / Channel Pressure
            // =================================

            else if (
                command === 0xC0 ||
                command === 0xD0
            ) {

                state.pos++;

            }


            // =================================
            // その他2バイトイベント
            // =================================

            else {

                state.pos += 2;

            }

        }


        pos = trackEnd;

    }


    // ========================================
    // tick → 秒
    // ========================================

    const secondsPerTick =
        tempo /
        1000000 /
        division;


    for (const note of notes) {

        note.time =
            note.startTick *
            secondsPerTick;

        note.duration =
            Math.max(
                0.05,
                (
                    note.endTick -
                    note.startTick
                ) *
                secondsPerTick
            );

    }


    return notes;

}


// ========================================
// Note OFF処理
// ========================================

function finishNote(
    activeNotes,
    notes,
    noteNumber,
    tick
) {

    const start =
        activeNotes[noteNumber];


    if (!start) {
        return;
    }


    notes.push({

        midi: noteNumber,

        velocity:
            start.velocity,

        startTick:
            start.tick,

        endTick:
            tick

    });


    delete activeNotes[noteNumber];

}


// ========================================
// 音源読み込み
// ========================================

async function loadSound(
    part,
    midiNumber
) {

    const noteIndex =
        ((midiNumber % 12) + 12) % 12;


    const fileName =
        noteNames[noteIndex] +
        "4.mp3";


    // 同じ音は再読込しない
    if (
        soundBuffers[part][fileName]
    ) {

        return {
            buffer:
                soundBuffers[part][fileName],

            rate:
                getPlaybackRate(
                    midiNumber
                )
        };

    }


    const url =
        soundFolders[part] +
        fileName;


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            "音源がありません: " +
            url
        );

    }


    const arrayBuffer =
        await response.arrayBuffer();


    const buffer =
        await midiAudioContext
            .decodeAudioData(
                arrayBuffer
            );


    soundBuffers[part][fileName] =
        buffer;


    return {

        buffer: buffer,

        rate:
            getPlaybackRate(
                midiNumber
            )

    };

}


// ========================================
// C4～B4を別オクターブへ変換
// ========================================

function getPlaybackRate(
    midiNumber
) {

    // MIDI 60～71 が
    // C4～B4の素材

    const sampleMidi =
        60 +
        (((midiNumber % 12) + 12) % 12);


    return Math.pow(
        2,
        (
            midiNumber -
            sampleMidi
        ) / 12
    );

}


// ========================================
// MIDIファイル取得
// ========================================

async function loadMidi(url) {

    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            "MIDIがありません: " +
            url
        );

    }


    const buffer =
        await response.arrayBuffer();


    return parseMidi(buffer);

}


// ========================================
// ドラム読み込み
// ========================================

async function loadDrum() {

    if (drumBuffer) {
        return;
    }


    const response =
        await fetch(
            "音源/ドラム/ドラム.m4a"
        );


    if (!response.ok) {

        throw new Error(
            "ドラム音源がありません"
        );

    }


    const arrayBuffer =
        await response.arrayBuffer();


    drumBuffer =
        await midiAudioContext
            .decodeAudioData(
                arrayBuffer
            );

}


// ========================================
// 1パート演奏
// ========================================

async function schedulePart(
    notes,
    part,
    startTime
) {

    // 必要な音源を先にロード
    const uniqueNotes =
        [
            ...new Set(
                notes.map(
                    note => note.midi
                )
            )
        ];


    const loaded = {};


    for (
        const midiNumber
        of uniqueNotes
    ) {

        loaded[midiNumber] =
            await loadSound(
                part,
                midiNumber
            );

    }


    // 音符を予約
    for (const note of notes) {

        const sound =
            loaded[note.midi];


        const source =
            midiAudioContext
                .createBufferSource();


        source.buffer =
            sound.buffer;


        source.playbackRate.value =
            sound.rate;


        const gain =
            midiAudioContext
                .createGain();


        gain.gain.value =
            Math.min(
                1,
                note.velocity / 100
            );


        source.connect(gain);

        gain.connect(
            midiAudioContext.destination
        );


        const when =
            startTime +
            note.time;


        source.start(
            when
        );


        // playbackRateを変えると
        // 実際の再生時間も変わるため、
        // MIDIの音符長で停止させる
        source.stop(
            when +
            note.duration
        );


        midiSources.push(
            source
        );

    }

}


// ========================================
// ドラムをループ
// ========================================

function scheduleDrum(
    startTime,
    duration
) {

    if (!drumBuffer) {
        return;
    }


    const source =
        midiAudioContext
            .createBufferSource();


    source.buffer =
        drumBuffer;


    source.loop = true;


    source.connect(
        midiAudioContext.destination
    );


    source.start(
        startTime
    );


    source.stop(
        startTime +
        duration
    );


    midiSources.push(
        source
    );

}


// ========================================
// 停止
// ========================================

function stopMidiSong() {

    for (
        const source
        of midiSources
    ) {

        try {

            source.stop();

        } catch (error) {

            // すでに停止済みなら無視

        }

    }


    midiSources = [];

    midiPlaying = false;


    const nowPlaying =
        document.getElementById(
            "nowPlaying"
        );


    if (nowPlaying) {

        nowPlaying.textContent =
            "停止しました";

    }

}


// ========================================
// 堂林翔太 MIDI試聴
// ========================================

async function playDobayashiMidi() {

    try {

        // 前回分を停止
        stopMidiSong();


        // AudioContext作成
        if (!midiAudioContext) {

            midiAudioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

        }


        await midiAudioContext.resume();


        const nowPlaying =
            document.getElementById(
                "nowPlaying"
            );


        if (nowPlaying) {

            nowPlaying.textContent =
                "MIDI音源を読み込み中…";

        }


        // ====================================
        // 3つのMIDIを読み込み
        // ====================================

        const [
            melody,
            chord,
            bass
        ] = await Promise.all([

            loadMidi(
                "データ/堂林翔太/①MIDIメロディー.mid"
            ),

            loadMidi(
                "データ/堂林翔太/②MIDIコード進行.mid"
            ),

            loadMidi(
                "データ/堂林翔太/③MIDIベース.mid"
            )

        ]);


        // ドラム
        await loadDrum();


        // ====================================
        // 曲の長さ
        // ====================================

        const allNotes = [
            ...melody,
            ...chord,
            ...bass
        ];


        let duration = 0;


        for (const note of allNotes) {

            duration =
                Math.max(
                    duration,
                    note.time +
                    note.duration
                );

        }


        // ====================================
        // 少し未来から一斉スタート
        // ====================================

        const startTime =
            midiAudioContext.currentTime +
            0.15;


        await Promise.all([

            schedulePart(
                melody,
                "melody",
                startTime
            ),

            schedulePart(
                chord,
                "chord",
                startTime
            ),

            schedulePart(
                bass,
                "bass",
                startTime
            )

        ]);


        // ドラム
        scheduleDrum(
            startTime,
            duration
        );


        midiPlaying = true;


        if (nowPlaying) {

            nowPlaying.textContent =
                "♪ MIDI試聴中：堂林翔太";

        }


        // 曲終了後
        setTimeout(
            () => {

                midiPlaying = false;

            },
            (duration + 1) * 1000
        );


    } catch (error) {

        console.error(error);


        const nowPlaying =
            document.getElementById(
                "nowPlaying"
            );


        if (nowPlaying) {

            nowPlaying.textContent =
                "MIDI再生エラー";

        }


        alert(
            "MIDI再生でエラーが発生しました。\n\n" +
            error.message
        );

    }

}