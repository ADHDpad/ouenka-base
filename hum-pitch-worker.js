'use strict';

const RATE = 8000;
const HOP = 400;
const WINDOW = 320;
const LOW_LAG = 8;
const HIGH_LAG = 100;

function analyse(source, rate) {
  const ratio = rate / RATE;
  const audio = new Float32Array(Math.floor(source.length / ratio));
  for (let i = 0; i < audio.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    for (let j = start; j < end; j++) audio[i] += source[j] / (end - start);
  }
  const contour = [];
  const error = new Float32Array(HIGH_LAG + 1);
  for (let start = 0; start + WINDOW + HIGH_LAG <= audio.length; start += HOP) {
    let level = 0;
    for (let i = 0; i < WINDOW; i += 2) level += audio[start + i] ** 2;
    if (level < 0.0015) {
      contour.push(null);
      continue;
    }
    let sum = 0;
    for (let lag = 1; lag <= HIGH_LAG; lag++) {
      let difference = 0;
      for (let i = 0; i < WINDOW; i += 2) {
        difference += (audio[start + i] - audio[start + i + lag]) ** 2;
      }
      sum += difference;
      error[lag] = sum ? difference * lag / sum : 1;
    }
    let best = 0;
    for (let lag = LOW_LAG; lag < HIGH_LAG; lag++) {
      if (error[lag] > error[lag - 1] || error[lag] > error[lag + 1]) continue;
      if (!best || error[lag] < error[best]) best = lag;
      if (error[lag] < 0.16) break;
    }
    if (!best || error[best] > 0.3) {
      contour.push(null);
      continue;
    }
    const curvature = error[best - 1] - 2 * error[best] + error[best + 1];
    const offset = curvature ? (error[best - 1] - error[best + 1]) / (2 * curvature) : 0;
    const note = 69 + 12 * Math.log2(RATE / (best + offset) / 440);
    contour.push(Math.round(note * 10) / 10);
  }
  const stable = contour.map((pitch, frame) => {
    const before = contour[frame - 1], after = contour[frame + 1];
    if (pitch == null || before == null || after == null) return pitch;
    return Math.max(Math.min(before, after), Math.min(pitch, Math.max(before, after)));
  });
  const first = stable.findIndex(pitch => pitch !== null);
  const last = stable.findLastIndex(pitch => pitch !== null);
  return first < 0 ? [] : stable.slice(first, last + 1);
}

function distance(query, reference) {
  const voiced = query.flatMap((pitch, frame) => pitch === null ? [] : [[frame, pitch]]);
  if (voiced.length < 20 || reference.length < 20) return Infinity;
  let best = Infinity;
  // Try several relative tempos and starting positions. Fit a constant pitch
  // shift so a melody can match regardless of the key in which it was hummed.
  for (const tempo of [.65, .75, .85, .93, 1, 1.08, 1.18, 1.32, 1.48]) {
    for (let start = 0; start < reference.length - query.length * tempo * .75; start += 2) {
      let count = 0, mean = 0, squared = 0;
      for (const [frame, pitch] of voiced) {
        const other = reference[start + Math.round(frame * tempo)];
        if (other == null) continue;
        const delta = pitch - other - mean;
        count++;
        mean += delta / count;
        squared += delta * (pitch - other - mean);
      }
      const coverage = count / voiced.length;
      if (coverage < .75) continue;
      best = Math.min(best, Math.sqrt(squared / count) + 5 * (1 - coverage));
    }
  }
  return best;
}

self.onmessage = ({data}) => {
  const {id, source, rate, query, reference} = data;
  try {
    self.postMessage({id, result: source ? analyse(source, rate) : distance(query, reference)});
  } catch {
    self.postMessage({id, error: '音程の解析に失敗しました。'});
  }
};
