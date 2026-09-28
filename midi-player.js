// ========================================
// 応援歌BASE MIDIプレイヤー
// 長音WAV音源対応版
// ========================================


// ========================================
// AudioContext
// ========================================

let midiAudioContext = null;


// 現在鳴っている音
let midiSources = [];


// ========================================
// 音源フォルダ
// ========================================

const soundFolders = {

    melody:
        "音源/メロディー/",

    chord:
        "音源/コード進行/",

    bass:
        "音源/ベース/"

};


// ========================================
// 音名
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
// 読み込み済み音源
// ========================================

const soundBuffers = {

    melody: {},

    chord: {},

    bass: {}

};


// ========================================
// MIDI 可変長数値
// ========================================

function readVariableLength(
    data,
    state
) {

    let value = 0;


    while (true) {

        const byte =
            data[state.pos++];


        value =
            (value << 7) |
            (byte & 0x7F);


        if (
            (byte & 0x80) === 0
        ) {

            break;

        }

    }


    return value;

}



// ========================================
// 32bit整数
// ========================================

function readUint32(
    data,
    pos
) {

    return (

        data[pos] *
        0x1000000 +

        data[pos + 1] *
        0x10000 +

        data[pos + 2] *
        0x100 +

        data[pos + 3]

    );

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
        activeNotes[
            noteNumber
        ];


    if (!start) {
        return;
    }


    notes.push({

        midi:
            noteNumber,

        velocity:
            start.velocity,

        startTick:
            start.tick,

        endTick:
            tick

    });


    delete activeNotes[
        noteNumber
    ];

}



// ========================================
// MIDI解析
// ========================================

function parseMidi(
    arrayBuffer
) {

    const data =
        new Uint8Array(
            arrayBuffer
        );


    // ticks per quarter note
    const division =
        (
            data[12] << 8
        ) |
        data[13];


    let pos = 14;


    const notes = [];


    // デフォルト120 BPM
    let tempo =
        500000;


    while (
        pos <
        data.length
    ) {


        // =================================
        // MTrkを探す
        // =================================

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
            pos +
            8 +
            trackLength;


        const state = {

            pos:
                pos + 8

        };


        let tick = 0;

        let runningStatus = 0;


        const activeNotes = {};


        while (
            state.pos <
            trackEnd
        ) {


            const delta =
                readVariableLength(
                    data,
                    state
                );


            tick += delta;


            let status =
                data[
                    state.pos
                ];


            // =================================
            // Running Status
            // =================================

            if (
                status < 0x80
            ) {

                status =
                    runningStatus;

            }

            else {

                state.pos++;

                runningStatus =
                    status;

            }


            // =================================
            // Meta Event
            // =================================

            if (
                status === 0xFF
            ) {

                const type =
                    data[
                        state.pos++
                    ];


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

                        data[
                            state.pos
                        ] *
                        65536 +

                        data[
                            state.pos + 1
                        ] *
                        256 +

                        data[
                            state.pos + 2
                        ];

                }


                state.pos +=
                    length;


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


                state.pos +=
                    length;


                continue;

            }


            const command =
                status &
                0xF0;


            // =================================
            // Note ON
            // =================================

            if (
                command === 0x90
            ) {

                const note =
                    data[
                        state.pos++
                    ];


                const velocity =
                    data[
                        state.pos++
                    ];


                if (
                    velocity > 0
                ) {

                    activeNotes[
                        note
                    ] = {

                        tick:
                            tick,

                        velocity:
                            velocity

                    };

                }

                else {

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

            else if (
                command === 0x80
            ) {

                const note =
                    data[
                        state.pos++
                    ];


                state.pos++;


                finishNote(
                    activeNotes,
                    notes,
                    note,
                    tick
                );

            }


            // =================================
            // Program Change
            // Channel Pressure
            // =================================

            else if (

                command === 0xC0 ||

                command === 0xD0

            ) {

                state.pos++;

            }


            // =================================
            // その他
            // =================================

            else {

                state.pos += 2;

            }

        }


        pos =
            trackEnd;

    }



    // ========================================
    // tick → 秒
    // ========================================

    const secondsPerTick =

        tempo /
        1000000 /
        division;


    notes.forEach(
        function(note) {


            note.time =

                note.startTick *
                secondsPerTick;


            note.duration =

                Math.max(

                    0.03,

                    (
                        note.endTick -
                        note.startTick
                    ) *
                    secondsPerTick

                );

        }
    );


    return notes;

}



// ========================================
// MIDIファイル読み込み
// ========================================

async function loadMidi(
    url
) {

    const response =
        await fetch(
            url
        );


    if (
        !response.ok
    ) {

        throw new Error(
            "MIDIがありません: " +
            url
        );

    }


    const arrayBuffer =
        await response
            .arrayBuffer();


    return parseMidi(
        arrayBuffer
    );

}



// ========================================
// MIDI番号から
// 使用するWAVを決める
// ========================================

function getSampleInfo(
    midiNumber
) {

    const noteIndex =

        (
            (
                midiNumber %
                12
            ) +
            12
        ) %
        12;


    // 今回の素材は
    // C4～B4
    const sampleMidi =
        60 +
        noteIndex;


    const fileName =

        noteNames[
            noteIndex
        ] +
        "4.wav";


    // オクターブ違いは
    // playbackRateで対応
    const playbackRate =

        Math.pow(

            2,

            (
                midiNumber -
                sampleMidi
            ) /
            12

        );


    return {

        fileName:
            fileName,

        playbackRate:
            playbackRate

    };

}



// ========================================
// WAV音源読み込み
// ========================================

async function loadSound(
    part,
    midiNumber
) {

    const info =
        getSampleInfo(
            midiNumber
        );


    // キャッシュ済み
    if (
        soundBuffers[
            part
        ][
            info.fileName
        ]
    ) {

        return {

            buffer:

                soundBuffers[
                    part
                ][
                    info.fileName
                ],

            rate:
                info.playbackRate

        };

    }


    const url =

        soundFolders[
            part
        ] +

        info.fileName;


    const response =
        await fetch(
            url
        );


    if (
        !response.ok
    ) {

        throw new Error(
            "WAV音源がありません: " +
            url
        );

    }


    const arrayBuffer =
        await response
            .arrayBuffer();


    const audioBuffer =

        await midiAudioContext
            .decodeAudioData(
                arrayBuffer
            );


    soundBuffers[
        part
    ][
        info.fileName
    ] =
        audioBuffer;


    return {

        buffer:
            audioBuffer,

        rate:
            info.playbackRate

    };

}



// ========================================
// MIDIプレイヤー停止
// ========================================

function stopMidiSong() {

    midiSources.forEach(
        function(item) {

            try {

                // Gainを即座に落とす
                if (
                    item.gain
                ) {

                    const now =
                        midiAudioContext
                            .currentTime;


                    item.gain.gain
                        .cancelScheduledValues(
                            now
                        );


                    item.gain.gain
                        .setValueAtTime(
                            item.gain.gain.value,
                            now
                        );


                    item.gain.gain
                        .linearRampToValueAtTime(
                            0.0001,
                            now + 0.03
                        );

                }


                if (
                    item.source
                ) {

                    item.source.stop(
                        midiAudioContext
                            .currentTime +
                        0.04
                    );

                }

            }

            catch (error) {

                // 停止済みなら無視

            }

        }
    );


    midiSources = [];

}



// ========================================
// 1音鳴らす
// ========================================

function scheduleNote(
    note,
    sound,
    startTime
) {

    const source =

        midiAudioContext
            .createBufferSource();


    source.buffer =
        sound.buffer;


    source.playbackRate
        .setValueAtTime(
            sound.rate,
            startTime
        );



    // ====================================
    // Gain
    // ====================================

    const gain =

        midiAudioContext
            .createGain();


    const volume =

        Math.max(

            0.08,

            Math.min(

                1,

                note.velocity /
                127

            )

        );



    // ====================================
    // 時間
    // ====================================

    const noteStart =

        startTime +
        note.time;


    const noteEnd =

        noteStart +
        note.duration;



    // ====================================
    // Attack
    // ====================================

    const attack =
        0.008;


    // ====================================
    // Release
    //
    // 次の音に少し重なることで
    // ブツ切れ感を減らす
    // ====================================

    const release =
        0.22;



    // 最初はほぼ無音
    gain.gain
        .setValueAtTime(
            0.0001,
            noteStart
        );


    // ほんの少しだけ
    // フェードイン
    gain.gain
        .linearRampToValueAtTime(
            volume,
            noteStart +
            attack
        );


    // MIDI上の音符終了まで
    // 音量を維持
    gain.gain
        .setValueAtTime(
            volume,
            noteEnd
        );


    // MIDI終了後も
    // WAVの余韻を少し残す
    gain.gain
        .exponentialRampToValueAtTime(
            0.0001,
            noteEnd +
            release
        );



    source.connect(
        gain
    );


    gain.connect(
        midiAudioContext
            .destination
    );



    // ====================================
    // 再生開始
    // ====================================

    source.start(
        noteStart
    );



    // ====================================
    // WAV自体は音符終了時に
    // ブツ切りしない
    // ====================================

    const availableDuration =

        sound.buffer.duration /
        sound.rate;


    const wantedDuration =

        note.duration +
        release +
        0.05;


    const playDuration =

        Math.min(

            availableDuration,

            wantedDuration

        );


    source.stop(

        noteStart +
        playDuration

    );



    midiSources.push({

        source:
            source,

        gain:
            gain

    });

}



// ========================================
// 1パートを予約再生
// ========================================

async function schedulePart(
    notes,
    part,
    startTime
) {

    // ====================================
    // 使用音を先読み
    // ====================================

    const uniqueNotes =

        [
            ...new Set(

                notes.map(
                    function(note) {

                        return note.midi;

                    }
                )

            )
        ];


    const loaded = {};


    for (
        const midiNumber
        of uniqueNotes
    ) {

        loaded[
            midiNumber
        ] =

            await loadSound(
                part,
                midiNumber
            );

    }



    // ====================================
    // 全音符を予約
    // ====================================

    notes.forEach(
        function(note) {

            scheduleNote(

                note,

                loaded[
                    note.midi
                ],

                startTime

            );

        }
    );

}



// ========================================
// 堂林翔太
// MIDI試聴
// ========================================

async function playDobayashiMidi() {

    try {


        // ====================================
        // AudioContext
        // ====================================

        if (
            !midiAudioContext
        ) {

            midiAudioContext =

                new (

                    window.AudioContext ||

                    window.webkitAudioContext

                )();

        }


        await midiAudioContext
            .resume();



        // 前回の音を停止
        stopMidiSong();



        const nowPlaying =

            document.getElementById(
                "nowPlaying"
            );


        if (
            nowPlaying
        ) {

            nowPlaying.textContent =
                "MIDIを読み込み中…";

        }



        // ====================================
        // MIDI読み込み
        //
        // ※ 実際のファイル名と
        // 完全一致させる
        // ====================================

        const [
            melody,
            chord,
            bass
        ] =

            await Promise.all([


                loadMidi(

                    "データ/堂林翔太/①MIDIメロディー.mid"

                ),


                loadMidi(

                    "データ/堂林翔太/②MIDIコード進行.mid"

                ),


                loadMidi(

                    "データ/堂林翔太/③MIDIベース.mid"

                )


            ]);



        if (
            nowPlaying
        ) {

            nowPlaying.textContent =
                "GarageBand音源を読み込み中…";

        }



        // ====================================
        // まず必要な音源を
        // 全部読み込んでから開始
        // ====================================

        const startTime =

            midiAudioContext
                .currentTime +
            0.25;



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



        if (
            nowPlaying
        ) {

            nowPlaying.textContent =
                "♪ MIDI試聴中：堂林翔太";

        }


    }

    catch (error) {

        console.error(
            error
        );


        const nowPlaying =

            document.getElementById(
                "nowPlaying"
            );


        if (
            nowPlaying
        ) {

            nowPlaying.textContent =
                "MIDI再生エラー";

        }


        alert(

            "MIDI再生でエラーが発生しました。\n\n" +

            error.message

        );

    }

}