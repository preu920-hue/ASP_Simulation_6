import {
  addBaselineWander,
  addPowerlineNoise,
  addMuscleNoise,
} from "./addNoise";

function resampleForDisplay(data, fsOriginal, fsUser) {
  const step = fsOriginal / fsUser;
  if (step <= 1) return data;
  const out = [];
  for (let i = 0; i < data.length; i += step) {
    out.push(data[Math.floor(i)]);
  }
  return out;
}

function inferFs(dataAll) {
  if (dataAll.length < 2) return 500;
  const dt = dataAll[1].x - dataAll[0].x;
  if (dt > 0) return 1 / dt;
  return 500;
}

/**
 * Build time-windowed, noise-contaminated samples (same pipeline as the noisy ECG chart).
 */
export function buildNoisySamples({
  rawSamples,
  selectedChannels,
  noise,
  time,
  originalFs,
}) {
  if (!rawSamples?.length) return [];

  const fsOriginal = inferFs(rawSamples);
  const displayData = resampleForDisplay(rawSamples, fsOriginal, originalFs);
  const limited = displayData.filter((p) => p.x <= time);

  const noisyChannels = {};
  selectedChannels.forEach((ch) => {
    let channelSignal = limited.map((p) => p[ch]);

    if (noise.baseline) {
      channelSignal = addBaselineWander(channelSignal, originalFs);
    }
    if (noise.powerline) {
      channelSignal = addPowerlineNoise(channelSignal, originalFs);
    }
    if (noise.emg) {
      channelSignal = addMuscleNoise(channelSignal);
    }

    noisyChannels[ch] = channelSignal;
  });

  return limited.map((p, i) => {
    const obj = { x: p.x };
    selectedChannels.forEach((ch) => {
      obj[ch] = noisyChannels[ch][i];
    });
    return obj;
  });
}

export function noisySamplesToChannelSignal(samples, channel = "ECG_I") {
  if (!samples?.length) return [];
  return samples.map((p) => p[channel] ?? 0);
}
