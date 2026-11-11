'use strict';
importScripts('./vendor/rubberband/index.umd.js');

const blockSize = 4096;
const offlineFinerStereo = 0x20000000 | 0x10000000;

function render(rb, input, sampleRate, pitch, speed, start, end, output) {
  const channels = input.length;
  const state = rb.rubberband_new(sampleRate, channels, offlineFinerStereo, 1 / speed, pitch);
  if (!state) throw Error('キー変更エンジンを起動できませんでした。');
  let table = 0;
  const pointers = [];
  try {
    table = rb.malloc(channels * 4);
    if (!table) throw Error('キー変更用のメモリを確保できませんでした。');
    for (let channel = 0; channel < channels; channel++) {
      const ptr = rb.malloc(blockSize * 4);
      if (!ptr) throw Error('キー変更用のメモリを確保できませんでした。');
      pointers.push(ptr);
      rb.memWritePtr(table + channel * 4, ptr);
    }
    rb.rubberband_set_expected_input_duration(state, end - start);
    rb.rubberband_set_max_process_size(state, blockSize);

    const outStart = Math.ceil(start / speed);
    const outLength = Math.ceil(end / speed) - outStart;
    let written = 0;
    for (const study of [true, false]) {
      for (let offset = start; offset < end; offset += blockSize) {
        const stop = Math.min(offset + blockSize, end);
        for (let ch = 0; ch < channels; ch++) rb.memWrite(pointers[ch], input[ch].subarray(offset, stop));
        const final = Number(stop === end);
        if (study) {
          rb.rubberband_study(state, table, stop - offset, final);
          continue;
        }
        rb.rubberband_process(state, table, stop - offset, final);
        let available;
        while ((available = rb.rubberband_available(state)) > 0) {
          const count = rb.rubberband_retrieve(state, table, Math.min(available, blockSize));
          if (!count) throw Error('キー変更した音声を取得できませんでした。');
          const remaining = Math.min(count, outLength - written);
          if (remaining > 0) {
            for (let ch = 0; ch < channels; ch++) output[ch].set(rb.memReadF32(pointers[ch], remaining), outStart + written);
          }
          written += count;
        }
      }
    }
    if (Math.abs(written - outLength) > 1) throw Error('キー変更後の音声の長さが合いませんでした。');
  } finally {
    rb.rubberband_delete(state);
    for (const ptr of pointers) rb.free(ptr);
    if (table) rb.free(table);
  }
}

function blendLoopEdges(input, output, sampleRate, speed, start, end) {
  const count = Math.min(Math.round(sampleRate * .008), Math.floor((end - start) / 2));
  const outStart = Math.ceil(start / speed), outEnd = Math.ceil(end / speed);
  for (let ch = 0; ch < input.length; ch++) {
    for (let i = 0; i < count; i++) {
      const weight = .5 + .5 * Math.cos(Math.PI * i / count);
      const left = start + i, right = end - 1 - i;
      output[ch][outStart + i] += (input[ch][left] - output[ch][outStart + i]) * weight;
      output[ch][outEnd - 1 - i] += (input[ch][right] - output[ch][outEnd - 1 - i]) * weight;
    }
    output[ch][outStart] = input[ch][start];
    output[ch][outEnd - 1] = input[ch][end - 1];
  }
}

self.onmessage = async ({data: {input, sampleRate, pitch, speed = 1, loopStart}}) => {
  try {
    const response = await fetch('./vendor/rubberband/rubberband.wasm');
    if (!response.ok) throw Error('キー変更エンジンを読み込めませんでした。');
    const module = await WebAssembly.compile(await response.arrayBuffer());
    const rb = await rubberband.RubberBandInterface.initialize(module);
    const length = input[0].length;
    const output = input.map(() => new Float32Array(Math.ceil(length / speed)));
    const split = Math.round(loopStart * sampleRate);
    if (split > 0 && split < length) {
      for (const [start, end] of [[0, split], [split, length]]) {
        render(rb, input, sampleRate, pitch, speed, start, end, output);
        blendLoopEdges(input, output, sampleRate, speed, start, end);
      }
    } else {
      render(rb, input, sampleRate, pitch, speed, 0, length, output);
    }
    self.postMessage({output}, output.map(channel => channel.buffer));
  } catch (error) {
    self.postMessage({error: error.message || 'キー変更に失敗しました。'});
  }
};
