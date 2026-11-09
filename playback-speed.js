(() => {
  'use strict';

  // Compensate for the duration change introduced by shifting the pitch.
  const prepared = new WeakMap();
  const keys = new WeakMap();
  const keyLimit = 6;

  const semitones = context => keys.get(context) ?? 0;
  const pitchRatio = steps => 2 ** (steps / 12);
  const bufferScale = context => pitchRatio(semitones(context));
  const timelineEntries = timeline => timeline.entries ?? [{buffer: timeline.buffer, start: 0}];

  async function stretch(context, buffer, speed, loopStart) {
    const hz = buffer.sampleRate;
    const hop = Math.round(hz * 0.025);
    const radius = Math.round(hz * 0.012);
    const stride = Math.max(2, Math.round(hz / 5500));
    const length = Math.ceil(buffer.length / speed);
    const result = context.createBuffer(buffer.numberOfChannels, length, hz);
    const channels = Array.from({length: buffer.numberOfChannels}, (_, i) => buffer.getChannelData(i));
    const outputs = channels.map((_, i) => result.getChannelData(i));
    const reference = channels[0];
    const weights = Float32Array.from({length: hop}, (_, i) => 0.5 - 0.5 * Math.cos(Math.PI * i / Math.max(1, hop - 1)));
    let lastYield = performance.now();

    function match(expected, previous, first, last, count) {
      if (last <= first) return expected;
      let referenceEnergy = 0;
      for (let i = 0; i < count; i += stride) referenceEnergy += reference[previous + i] ** 2;
      if (referenceEnergy < 1e-9) return expected;

      let best = expected, bestScore = -Infinity;
      function score(at) {
        let dot = 0, energy = 0;
        for (let i = 0; i < count; i += stride) {
          const sample = reference[at + i];
          dot += reference[previous + i] * sample;
          energy += sample * sample;
        }
        const similarity = dot / Math.sqrt(referenceEnergy * energy + 1e-15);
        const value = similarity - 0.015 * Math.abs(at - expected) / radius;
        if (value > bestScore) { bestScore = value; best = at; }
      }

      score(expected);
      for (let at = first; at <= last; at += stride) score(at);
      const coarse = best;
      for (let at = Math.max(first, coarse - stride + 1); at <= Math.min(last, coarse + stride - 1); at++) score(at);
      return best;
    }

    const split = Math.round(loopStart * hz);
    const boundaries = split > 0 && split < buffer.length ? [0, split, buffer.length] : [0, buffer.length];
    for (let segment = 1; segment < boundaries.length; segment++) {
      const start = boundaries[segment - 1], end = boundaries[segment];
      const outputStart = Math.ceil(start / speed), outputEnd = Math.ceil(end / speed);
      let previous = start;
      for (let out = outputStart; out < outputEnd; out += hop) {
        const count = Math.min(hop, outputEnd - out);
        const relative = out - outputStart;
        const maxStart = Math.max(start, end - count);
        const expected = Math.min(maxStart, start + Math.round(relative * speed));
        const continuation = previous + hop;
        const compare = Math.min(count, Math.max(0, end - continuation));
        // Anchor both sides of a loop boundary to their original samples.
        const at = out === outputStart ? start : out + count === outputEnd ? maxStart :
          compare ? match(expected, continuation, Math.max(start, expected - radius), Math.min(maxStart, expected + radius), compare) : expected;
        for (let channel = 0; channel < channels.length; channel++) {
          const input = channels[channel], output = outputs[channel];
          for (let i = 0; i < count; i++) {
            const fresh = input[Math.min(end - 1, at + i)];
            const weight = count < hop ? weights[Math.floor(i * (hop - 1) / Math.max(1, count - 1))] : weights[i];
            output[out + i] = relative && i < compare ? input[continuation + i] * (1 - weight) + fresh * weight : fresh;
          }
        }
        previous = at;
        if (performance.now() - lastYield > 20) {
          await new Promise(resolve => setTimeout(resolve, 0));
          if (context.state === 'closed') throw new DOMException('再生を中止しました。', 'AbortError');
          lastYield = performance.now();
        }
      }
    }
    return result;
  }

  function source(context, buffer) {
    const node = context.createBufferSource();
    node.buffer = prepared.get(context)?.get(buffer) ?? buffer;
    const steps = semitones(context);
    if (steps) node.playbackRate.value = pitchRatio(steps);
    return node;
  }

  function keyControl(getContext, getTimeline, restart) {
    return {
      keyState() {
        const context = getContext();
        return { steps: semitones(context), limit: keyLimit, available: !!context && context.state !== 'closed' };
      },
      async changeKey(direction) {
        const context = getContext();
        const timeline = getTimeline();
        if (!context || !timeline || context.state === 'closed') return;
        const current = semitones(context);
        const next = Math.min(keyLimit, Math.max(-keyLimit, current + direction));
        if (next === current) return;
        const stretchSpeed = 1 / pitchRatio(next);
        const buffers = new WeakMap();
        try {
          if (stretchSpeed !== 1) {
            for (const {buffer} of timelineEntries(timeline)) {
              if (!buffers.has(buffer)) buffers.set(buffer, await stretch(context, buffer, stretchSpeed, timeline.loopStart ?? 0));
              if (getContext() !== context || context.state === 'closed') return;
            }
          }
        } catch (error) {
          if (getContext() !== context || context.state === 'closed') return;
          throw error;
        }
        if (getContext() !== context || context.state === 'closed') return;
        prepared.set(context, buffers);
        keys.set(context, next);
        restart();
      }
    };
  }

  window.OuenkaPlaybackSpeed = { source, bufferScale, keyControl };
})();
