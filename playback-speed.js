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

  function spectrumPlan(size) {
    const cosine = new Float64Array(size / 2);
    const sine = new Float64Array(size / 2);
    const reverse = new Uint16Array(size);
    for (let i = 0; i < size / 2; i++) {
      const angle = 2 * Math.PI * i / size;
      cosine[i] = Math.cos(angle);
      sine[i] = Math.sin(angle);
    }
    for (let i = 1; i < size; i++) reverse[i] = (reverse[i >> 1] >> 1) | ((i & 1) * (size / 2));

    return function fft(real, imag, inverse = false) {
      for (let i = 0; i < size; i++) {
        const j = reverse[i];
        if (j <= i) continue;
        const re = real[i], im = imag[i];
        real[i] = real[j]; imag[i] = imag[j];
        real[j] = re; imag[j] = im;
      }
      for (let width = 2; width <= size; width *= 2) {
        const half = width / 2, step = size / width;
        for (let start = 0; start < size; start += width) {
          for (let i = 0; i < half; i++) {
            const a = start + i, b = a + half;
            const c = cosine[i * step], s = (inverse ? 1 : -1) * sine[i * step];
            const re = c * real[b] - s * imag[b];
            const im = s * real[b] + c * imag[b];
            real[b] = real[a] - re; imag[b] = imag[a] - im;
            real[a] += re; imag[a] += im;
          }
        }
      }
    };
  }

  async function stretch(context, buffer, speed, loopStart) {
    const hz = buffer.sampleRate;
    const size = hz >= 32000 ? 2048 : 1024;
    const half = size / 2, hop = size / 4, bins = half + 1;
    const fft = spectrumPlan(size);
    const tau = 2 * Math.PI;
    const wrap = phase => phase - tau * Math.round(phase / tau);
    const window = Float64Array.from({length: size}, (_, i) => 0.5 - 0.5 * Math.cos(tau * i / size));
    const result = context.createBuffer(buffer.numberOfChannels, Math.ceil(buffer.length / speed), hz);
    const channels = Array.from({length: buffer.numberOfChannels}, (_, channel) => ({
      input: buffer.getChannelData(channel),
      output: result.getChannelData(channel),
      real: new Float64Array(size),
      imag: new Float64Array(size),
      lastReal: new Float64Array(bins),
      lastImag: new Float64Array(bins)
    }));
    const magnitude = new Float64Array(bins), previous = new Float64Array(bins);
    const dot = new Float64Array(bins), cross = new Float64Array(bins);
    const rotation = new Float64Array(bins), applied = new Float64Array(bins);
    const peaks = new Uint16Array(bins);
    const cosRotation = new Float64Array(bins), sinRotation = new Float64Array(bins);
    const split = Math.round(loopStart * hz);
    const loop = split > 0 && split < buffer.length;
    const boundaries = loop ? [0, split, buffer.length] : [0, buffer.length];
    let lastYield = performance.now();

    for (let segment = 1; segment < boundaries.length; segment++) {
      const start = boundaries[segment - 1], end = boundaries[segment];
      const outStart = Math.ceil(start / speed), outEnd = Math.ceil(end / speed);
      let lastCenter = null, lastEnergy = 0;
      previous.fill(0);
      rotation.fill(0);
      for (let out = outStart - hop; out < outEnd + half; out += hop) {
        const center = start + Math.round((out - outStart) * speed);
        const inHop = lastCenter === null ? hop : center - lastCenter;
        magnitude.fill(0); dot.fill(0); cross.fill(0);
        for (const {input, real, imag, lastReal, lastImag} of channels) {
          for (let i = 0; i < size; i++) {
            const at = center - half + i;
            real[i] = at >= start && at < end ? input[at] * window[i] : 0;
          }
          imag.fill(0);
          fft(real, imag);
          for (let k = 0; k < bins; k++) {
            const re = real[k], im = imag[k];
            magnitude[k] += re * re + im * im;
            dot[k] += re * lastReal[k] + im * lastImag[k];
            cross[k] += im * lastReal[k] - re * lastImag[k];
            lastReal[k] = re; lastImag[k] = im;
          }
        }

        let energy = 0, flux = 0, peakCount = 0, strongest = 0;
        for (let k = 0; k < bins; k++) {
          magnitude[k] = Math.sqrt(magnitude[k]);
          if (magnitude[k] > magnitude[strongest]) strongest = k;
          energy += magnitude[k];
          flux += Math.max(0, magnitude[k] - previous[k]);
        }
        const attack = lastCenter === null || (flux > 0.42 * energy && energy > 1.15 * lastEnergy);
        for (let k = 1; k < half; k++) {
          if (magnitude[k] > magnitude[strongest] * 0.003 &&
              magnitude[k] >= magnitude[k - 1] && magnitude[k] > magnitude[k + 1]) peaks[peakCount++] = k;
        }
        if (!peakCount) peaks[peakCount++] = strongest;

        // One rotation per spectral peak keeps nearby bins and stereo channels in phase.
        for (let peak = 0; peak < peakCount; peak++) {
          const anchor = peaks[peak];
          const omega = tau * anchor / size;
          const deviation = wrap(Math.atan2(cross[anchor], dot[anchor]) - omega * inHop);
          const angle = attack ? 0 : wrap(rotation[anchor] + (hop - inHop) * (omega + deviation / inHop));
          const endBin = peak + 1 < peakCount ? 1 + ((anchor + peaks[peak + 1]) >> 1) : bins;
          const startBin = peak ? 1 + ((peaks[peak - 1] + anchor) >> 1) : 0;
          applied.fill(angle, startBin, endBin);
          cosRotation.fill(Math.cos(angle), startBin, endBin);
          sinRotation.fill(Math.sin(angle), startBin, endBin);
        }
        rotation.set(applied);
        previous.set(magnitude);
        lastCenter = center;
        lastEnergy = energy;

        for (const {output, real, imag} of channels) {
          imag[0] = 0; imag[half] = 0;
          for (let k = 1; k < half; k++) {
            const c = cosRotation[k], s = sinRotation[k];
            const re = real[k], im = imag[k];
            real[k] = real[size - k] = c * re - s * im;
            imag[k] = s * re + c * im;
            imag[size - k] = -imag[k];
          }
          fft(real, imag, true);
          const at = out - half;
          // Four overlapping Hann windows have a constant squared sum of 1.5.
          for (let i = Math.max(0, outStart - at); i < Math.min(size, outEnd - at); i++) {
            output[at + i] += real[i] * window[i] * (2 / (3 * size));
          }
        }
        if (performance.now() - lastYield > 20) {
          await new Promise(resolve => setTimeout(resolve, 0));
          if (context.state === 'closed') throw new DOMException('再生を中止しました。', 'AbortError');
          lastYield = performance.now();
        }
      }

      // Preserve the existing waveform at each loop splice, with a short blend.
      if (loop) {
        const count = Math.min(Math.round(hz * 0.008), Math.floor((outEnd - outStart) / 2), end - start);
        for (const {input, output} of channels) {
          for (let i = 0; i < count; i++) {
            const weight = 0.5 + 0.5 * Math.cos(Math.PI * i / count);
            const left = outStart + i, right = outEnd - 1 - i;
            output[left] += (input[start + i] - output[left]) * weight;
            output[right] += (input[end - 1 - i] - output[right]) * weight;
          }
          output[outStart] = input[start];
          output[outEnd - 1] = input[end - 1];
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
