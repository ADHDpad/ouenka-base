(() => {
  'use strict';

  // Compensate for the duration change introduced by shifting the pitch.
  const prepared = new WeakMap();
  const keys = new WeakMap();
  const scales = new WeakMap();
  const workerUrl = new URL('pitch-r3-worker.js?v=20261111-r344', document.currentScript.src);
  const finerMemoryLimit = 32 * 1024 * 1024;
  const keyLimit = 6;

  const semitones = context => keys.get(context) ?? 0;
  const pitchRatio = steps => 2 ** (steps / 12);
  const bufferScale = context => scales.get(context) ?? 1;
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
    limitPeaks(channels.map(channel => channel.output));
    return result;
  }

  function limitPeaks(channels) {
    let peak = 0;
    for (const output of channels) {
      for (const sample of output) peak = Math.max(peak, Math.abs(sample));
    }
    if (peak > 1) {
      for (const output of channels) {
        for (let i = 0; i < output.length; i++) output[i] *= 0.99 / peak;
      }
    }
  }

  function shiftInWorker(context, buffer, pitch, speed, loopStart) {
    const worker = new Worker(workerUrl);
    return new Promise((resolve, reject) => {
      function finish(callback, value) {
        context.removeEventListener('statechange', checkClosed);
        worker.terminate();
        callback(value);
      }
      function checkClosed() {
        if (context.state === 'closed') finish(reject, new DOMException('再生を中止しました。', 'AbortError'));
      }
      worker.onmessage = ({data}) => {
        if (data.error) {
          finish(reject, Error(data.error));
          return;
        }
        try {
          const result = context.createBuffer(buffer.numberOfChannels, Math.ceil(buffer.length / speed), buffer.sampleRate);
          data.output.forEach((channel, index) => result.copyToChannel(channel, index));
          limitPeaks(Array.from({length: result.numberOfChannels}, (_, ch) => result.getChannelData(ch)));
          finish(resolve, result);
        } catch (error) {
          finish(reject, error);
        }
      };
      worker.onerror = () => finish(reject, Error('高音質キー変更を起動できませんでした。'));
      context.addEventListener('statechange', checkClosed);
      try {
        const input = Array.from({length: buffer.numberOfChannels}, (_, ch) => buffer.getChannelData(ch).slice());
        worker.postMessage({input, sampleRate: buffer.sampleRate, pitch, speed, loopStart}, input.map(channel => channel.buffer));
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  const adjustedAccompaniments = new WeakMap();

  function tuneAccompaniment(context, song, buffer) {
    const name = String(song?.name || song?.player_name || song?.playerName || '')
      .normalize('NFKC').replace(/\s+/g, '');
    if (name !== '西川龍馬(天賦)' || !buffer) return buffer;
    const cached = adjustedAccompaniments.get(buffer);
    if (cached) return cached;
    // First-order high shelf: keep the bass and body, gently attenuate the upper band.
    const cutoff = Math.min(6200, buffer.sampleRate * .4);
    const g = Math.tan(Math.PI * cutoff / buffer.sampleRate);
    const weight = g / (1 + g);
    const highGain = 10 ** (-3 / 20);
    const output = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const input = buffer.getChannelData(ch), result = output.getChannelData(ch);
      let lowState = 0;
      for (let i = 0; i < input.length; i++) {
        const delta = (input[i] - lowState) * weight;
        const low = lowState + delta;
        lowState = low + delta;
        result[i] = low + (input[i] - low) * highGain;
      }
    }
    adjustedAccompaniments.set(buffer, output);
    return output;
  }

  const mixOutputs = new WeakMap();

  function alignedMixPeak(buffers) {
    let peak = 0;
    const channels = Math.max(...buffers.map(buffer => buffer.numberOfChannels));
    const length = Math.max(...buffers.map(buffer => buffer.length));
    for (let ch = 0; ch < channels; ch++) {
      const tracks = buffers.map(buffer => buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)));
      for (let i = 0; i < length; i++) {
        let sample = 0;
        for (const track of tracks) if (i < track.length) sample += track[i];
        const magnitude = Math.abs(sample);
        if (magnitude > peak) peak = magnitude;
      }
    }
    return peak;
  }

  function mixOutput(context, entries) {
    if (!entries.length || entries.some(entry => entry.start !== entries[0].start)) return context.destination;
    const revision = prepared.get(context);
    const previous = mixOutputs.get(context);
    if (previous?.entries === entries && previous.revision === revision) return previous.output;
    const buffers = entries.map(({buffer}) => revision?.get(buffer) ?? buffer);
    const peak = alignedMixPeak(buffers);
    let output = context.destination;
    if (peak > .98) {
      output = context.createGain();
      output.gain.value = .98 / peak;
      output.connect(context.destination);
    }
    mixOutputs.set(context, {entries,revision,output});
    return output;
  }

  function source(context, buffer) {
    const node = context.createBufferSource();
    node.buffer = prepared.get(context)?.get(buffer) ?? buffer;
    node.playbackRate.value = bufferScale(context);
    return node;
  }

  async function prepare(context, timeline, nextKey) {
    const entries = new Set(timelineEntries(timeline).map(entry => entry.buffer).filter(Boolean));
    let buffers = new WeakMap();
    const pitch = pitchRatio(nextKey);
    const stretchSpeed = 1 / pitch;
    const loopStart = timeline.loopStart ?? 0;
    let scale = 1;
    if (nextKey) {
      let bytes = 0;
      for (const buffer of entries) bytes += buffer.length * buffer.numberOfChannels * 4;
      let useFiner = bytes <= finerMemoryLimit &&
        typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
      if (useFiner) {
        try {
          for (const buffer of entries) {
            buffers.set(buffer, await shiftInWorker(context, buffer, pitch, 1, loopStart));
          }
        } catch (error) {
          if (context.state === 'closed') throw error;
          console.warn('Rubber Band R3:', error);
          buffers = new WeakMap();
          useFiner = false;
        }
      }
      if (!useFiner) {
        scale = 1 / stretchSpeed;
        for (const buffer of entries) {
          buffers.set(buffer, stretchSpeed === 1 ? buffer : await stretch(context, buffer, stretchSpeed, loopStart));
        }
      }
    }
    if (context.state === 'closed') throw new DOMException('再生を中止しました。', 'AbortError');
    prepared.set(context, buffers);
    keys.set(context, nextKey);
    scales.set(context, scale);
  }

  function keyControl(getContext, getTimeline, restart) {
    let processing = false;
    const available = context => !!context && context.state !== 'closed';
    return {
      keyState() {
        const context = getContext();
        return {steps: semitones(context), limit: keyLimit, available: available(context)};
      },
      async changeKey(direction) {
        const context = getContext();
        const timeline = getTimeline();
        if (processing || !available(context) || !timeline) return;
        const previous = semitones(context);
        const next = Math.min(keyLimit, Math.max(-keyLimit, previous + direction));
        if (previous === next) return;
        processing = true;
        try {
          await prepare(context, timeline, next);
          if (getContext() === context && available(context)) restart();
        } catch (error) {
          if (getContext() === context && available(context)) throw error;
        } finally {
          processing = false;
        }
      }
    };
  }

  function transferKey(previous,fresh) {
    if(prepared.has(previous))prepared.set(fresh,prepared.get(previous));
    keys.set(fresh,semitones(previous));
    scales.set(fresh,bufferScale(previous));
  }
  window.OuenkaPlaybackSpeed = {transferKey,source, bufferScale, keyControl, mixOutput, tuneAccompaniment};
})();
