import {
  addBaselineWander,
  addPowerlineNoise,
  addMuscleNoise,
} from "./addNoise.js";

function createRng(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDeterministicSeed(input) {
  const str = typeof input === "string" ? input : JSON.stringify(input);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function solveLinear(A, b) {
  const n = b.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col] / pivot;
      for (let k = col; k <= n; k++) aug[row][k] -= f * aug[col][k];
    }
  }
  return aug.map((row, i) => (Math.abs(row[i]) > 1e-12 ? row[n] / row[i] : 0));
}

function invertMatrix(M) {
  const n = M.length;
  const A = M.map((r) => [...r]);
  const I = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [I[col], I[maxRow]] = [I[maxRow], I[col]];
    if (Math.abs(A[col][col]) < 1e-10) return null;
    const pivot = A[col][col];
    for (let j = 0; j < n; j++) {
      A[col][j] /= pivot;
      I[col][j] /= pivot;
    }
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      for (let j = 0; j < n; j++) {
        A[row][j] -= factor * A[col][j];
        I[row][j] -= factor * I[col][j];
      }
    }
  }
  return I;
}

function smoothArray(arr, w) {
  return arr.map((_, i) => {
    let s = 0,
      c = 0;
    for (let k = Math.max(0, i - w + 1); k <= i; k++) {
      s += arr[k];
      c++;
    }
    return s / c;
  });
}

function estimateAutocorrelation(signal, maxLag) {
  const N = signal.length;
  const R = new Array(maxLag + 1).fill(0);
  for (let lag = 0; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = lag; i < N; i++) acc += signal[i] * signal[i - lag];
    R[lag] = acc / (N - lag);
  }
  return R;
}

function buildToeplitz(R, P) {
  return Array.from({ length: P }, (_, i) =>
    Array.from({ length: P }, (_, j) => R[Math.abs(i - j)])
  );
}

/** Apply noise types per Monte Carlo run (theory §7.2 stage 2). */
function synthesizeNoisySignal(clean, fs, noiseConfig, rng) {
  let out = [...clean];
  const intensityScale = 0.85 + 0.3 * rng();
  if (noiseConfig?.baseline)
    out = addBaselineWander(out, fs, 0.2 * intensityScale);
  if (noiseConfig?.powerline)
    out = addPowerlineNoise(out, fs, 0.05 * intensityScale);
  if (noiseConfig?.emg) out = addMuscleNoise(out, 0.02 * intensityScale);
  return out;
}

export function calcSNR(clean, observed) {
  const N = Math.min(clean.length, observed.length);
  if (!N) return null;
  let sigPow = 0;
  let noisePow = 0;
  for (let i = 0; i < N; i++) {
    sigPow += clean[i] * clean[i];
    const n = observed[i] - clean[i];
    noisePow += n * n;
  }
  if (noisePow <= 1e-15) return 999;
  return 10 * Math.log10(sigPow / noisePow);
}

function computeMcConfidenceBands(mseRuns) {
  const len = mseRuns[0]?.length ?? 0;
  const mseAvg = new Array(len).fill(0);
  const mseCiLower = new Array(len).fill(0);
  const mseCiUpper = new Array(len).fill(0);
  const nRuns = mseRuns.length;

  for (let i = 0; i < len; i++) {
    const vals = mseRuns.map((run) => run[i] ?? 0);
    const mean = vals.reduce((s, v) => s + v, 0) / nRuns;
    const variance =
      vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(nRuns - 1, 1);
    const se = Math.sqrt(variance) / Math.sqrt(nRuns);
    mseAvg[i] = mean;
    mseCiLower[i] = mean - 1.96 * se;
    mseCiUpper[i] = mean + 1.96 * se;
  }

  return { mseAvg, mseCiLower, mseCiUpper };
}

/** Block-based MVDR denoising on ECG (theory §5.4–5.6, §7.2 stage 4). */
function runMVDR_ECGDenoise(noisySignal, windowSize, diagLoad) {
  const N = noisySignal.length;
  const M = Math.min(windowSize, 8);
  const filtered = new Float64Array(N);

  for (let start = 0; start < N; start += M) {
    const end = Math.min(start + M, N);
    const seg = noisySignal.slice(start, end);
    if (seg.length < 2) {
      for (let i = start; i < end; i++) filtered[i] = noisySignal[i];
      continue;
    }
    const len = seg.length;
    const d = new Float64Array(len).fill(1 / Math.sqrt(len));
    const R = Array.from({ length: len }, (_, i) =>
      Array.from({ length: len }, (_, j) => {
        let s = 0;
        for (let k = 0; k < len; k++)
          s += seg[(k + i) % len] * seg[(k + j) % len];
        return s / len + (i === j ? diagLoad : 0);
      })
    );
    const Rinv = invertMatrix(R);
    if (!Rinv) {
      for (let i = start; i < end; i++) filtered[i] = noisySignal[i];
      continue;
    }
    const Rinvd = Rinv.map((row) => row.reduce((s, v, k) => s + v * d[k], 0));
    const dRinvd = d.reduce((s, dk, k) => s + dk * Rinvd[k], 0);
    const w = Rinvd.map((v) => v / (dRinvd || 1));
    for (let i = start; i < end; i++) {
      const idx = i - start;
      filtered[i] = w.reduce(
        (s, wk, k) => s + wk * seg[(idx + k) % len],
        0
      );
    }
  }
  return Array.from(filtered);
}

function estimateCovarianceHeatmap(signal, windowSize) {
  const W = Math.min(windowSize, 8);
  const seg = signal.slice(0, Math.min(signal.length, W * 4));
  if (seg.length < W) return null;
  return Array.from({ length: W }, (_, i) =>
    Array.from({ length: W }, (_, j) => {
      let s = 0;
      let cnt = 0;
      for (let k = 0; k < seg.length - W; k++) {
        s += seg[k + i] * seg[k + j];
        cnt++;
      }
      return s / (cnt || 1);
    })
  );
}

// ── LMS-AR on real ECG (theory §3–4, §7.1) ─────────────────────────────────
export function runLMS_AR(
  ecgSignal,
  P = 4,
  mu = 0.001,
  monteCarloRuns = 50,
  seed = 12345,
  options = {}
) {
  const N = ecgSignal.length;
  if (N < P + 1) return null;

  const { noisySignal = null, noiseConfig = null, fs = 360 } = options;
  const inputSignal = noisySignal ?? ecgSignal;

  const R = estimateAutocorrelation(ecgSignal, P);
  const Rmat = buildToeplitz(R, P);
  const p_vec = Array.from({ length: P }, (_, i) => R[i + 1]);
  const w_opt = solveLinear(Rmat, p_vec);
  const a_yw = w_opt.map((v) => -v);
  const sigma2_w = Math.max(R[0] + a_yw.reduce((s, a, i) => s + a * p_vec[i], 0), 1e-12);
  const traceR = Rmat.reduce((s, row, i) => s + row[i], 0);
  const jMin = Math.max(sigma2_w, 1e-12);
  const misadjustment = mu * traceR;
  const jSsTheory = jMin / Math.max(1 - mu * traceR, 1e-6);

  const rng = createRng(seed);
  const mseRuns = [];
  let allW = null;

  for (let run = 0; run < monteCarloRuns; run++) {
    const runSeed = (seed + run * 9973) >>> 0;
    const runRng = createRng(runSeed);
    const observed =
      noisySignal ??
      (noiseConfig &&
      (noiseConfig.baseline || noiseConfig.powerline || noiseConfig.emg)
        ? synthesizeNoisySignal(ecgSignal, fs, noiseConfig, runRng)
        : ecgSignal);

    const w = new Array(P).fill(0);
    const w_hist = Array.from({ length: P }, () => []);
    const mse_run = [];

    for (let i = P; i < N; i++) {
      const x = Array.from({ length: P }, (_, k) => observed[i - k - 1]);
      let y_pred = 0;
      for (let k = 0; k < P; k++) y_pred += w[k] * x[k];
      const e = ecgSignal[i] - y_pred;
      mse_run.push(e * e);
      for (let k = 0; k < P; k++) w[k] += 2 * mu * e * x[k];
      if (run === monteCarloRuns - 1) w_hist.forEach((wh, k) => wh.push(w[k]));
    }

    mseRuns.push(mse_run);
    if (run === monteCarloRuns - 1) allW = w_hist;
  }

  const { mseAvg, mseCiLower, mseCiUpper } = computeMcConfidenceBands(mseRuns);
  const mse_smooth = smoothArray(mseAvg, 20);
  const mseCiLowerSmooth = smoothArray(mseCiLower, 20);
  const mseCiUpperSmooth = smoothArray(mseCiUpper, 20);
  const w_final = allW
    ? allW.map((wArr) => wArr[wArr.length - 1])
    : new Array(P).fill(0);

  const displayLen = Math.min(N - P, 1500);
  const predicted = Array.from({ length: displayLen }, (_, idx) => {
    const i = idx + P;
    let y = 0;
    for (let k = 0; k < P; k++) y += w_final[k] * inputSignal[i - k - 1];
    return { x: idx, y };
  });
  const original = ecgSignal
    .slice(P, P + displayLen)
    .map((v, i) => ({ x: i, y: v }));

  const jSs = mse_smooth[mse_smooth.length - 1] ?? jSsTheory;
  const snrIn = noisySignal ? calcSNR(ecgSignal, noisySignal) : null;
  const predictedArr = predicted.map((p) => p.y);
  const snrOut = calcSNR(
    ecgSignal.slice(P, P + predictedArr.length),
    predictedArr
  );

  return {
    type: "AR Process",
    mse: mse_smooth,
    mseCiLower: mseCiLowerSmooth,
    mseCiUpper: mseCiUpperSmooth,
    w_hist: allW,
    w_opt,
    a_yw,
    predicted,
    original,
    iterations: mse_smooth.map((_, i) => i + 1),
    N: mse_smooth.length,
    P,
    mu,
    monteCarloRuns,
    misadjustment,
    jMin,
    jSs,
    traceR,
    sigma2_w,
    snrIn,
    snrOut,
    usedNoisyInput: Boolean(noisySignal || noiseConfig),
  };
}

// ── MVDR on real ECG (theory §5, §7.2) ─────────────────────────────────────
export function runMVDR(
  ecgSignal,
  M = 8,
  snapshots = 256,
  theta_s = 30,
  theta_i = -45,
  snr_dB = 20,
  inr_dB = 25,
  monteCarloRuns = 50,
  options = {}
) {
  const { noisySignal = null, diagLoad = 0.01 } = options;
  const N = ecgSignal.length;
  const rng = createRng(42);
  const ecgMax = Math.max(...ecgSignal.map(Math.abs)) || 1;
  const ecgNorm = ecgSignal.map((v) => v / ecgMax);
  const noisyNorm = noisySignal
    ? noisySignal.map((v) => v / ecgMax)
    : ecgNorm;

  const steer = (deg) => {
    const th = (deg * Math.PI) / 180;
    return {
      re: Array.from({ length: M }, (_, m) => Math.cos(Math.PI * m * Math.sin(th))),
      im: Array.from({ length: M }, (_, m) => Math.sin(Math.PI * m * Math.sin(th))),
    };
  };

  const a_s = steer(theta_s);
  const a_i = steer(theta_i);
  const snr = Math.pow(10, snr_dB / 10);
  const inr = Math.pow(10, inr_dB / 10);
  const blockSize = Math.min(snapshots, Math.floor(N / M));

  const R_re = Array.from({ length: M }, () => new Array(M).fill(0));
  for (let snap = 0; snap < blockSize; snap++) {
    const idx = (snap * M) % (N - M);
    const x_re = new Array(M);
    const x_im = new Array(M);
    for (let m = 0; m < M; m++) {
      const s = ecgNorm[idx + m];
      const inter = Math.sqrt(inr / snr) * (rng() - 0.5) * 2;
      const noise = ((rng() - 0.5) * 2) / Math.sqrt(snr);
      x_re[m] = s * a_s.re[m] + inter * a_i.re[m] + noise;
      x_im[m] = s * a_s.im[m] + inter * a_i.im[m] + noise;
    }
    for (let i = 0; i < M; i++)
      for (let j = 0; j < M; j++)
        R_re[i][j] += (x_re[i] * x_re[j] + x_im[i] * x_im[j]) / blockSize;
  }
  for (let m = 0; m < M; m++) R_re[m][m] += diagLoad;

  const Rinv_a = solveLinear(R_re, a_s.re);
  let denom = 0;
  for (let m = 0; m < M; m++) denom += a_s.re[m] * Rinv_a[m];
  denom = Math.abs(denom) || 1e-10;
  const w_mvdr = Rinv_a.map((v) => v / denom);

  const denoisedNorm = runMVDR_ECGDenoise(noisyNorm, M, diagLoad);
  const displayLen = Math.min(N - M, 1500);
  const denoised = Array.from({ length: displayLen }, (_, i) => ({
    x: i,
    y: denoisedNorm[i] * ecgMax,
  }));
  const original = Array.from({ length: displayLen }, (_, i) => ({
    x: i,
    y: ecgSignal[i + Math.floor(M / 2)],
  }));

  const phi = Array.from({ length: 181 }, (_, i) => i - 90);
  const G_dB_avg = phi.map((angle) => {
    let gainAcc = 0;
    for (let run = 0; run < monteCarloRuns; run++) {
      const at = steer(angle + (rng() - 0.5) * 0.5);
      let num = 0;
      for (let m = 0; m < M; m++) num += w_mvdr[m] * at.re[m];
      gainAcc += num * num;
    }
    return 10 * Math.log10(Math.max(gainAcc / monteCarloRuns, 1e-10));
  });
  const maxG = Math.max(...G_dB_avg);

  const covarianceHeatmap = estimateCovarianceHeatmap(noisyNorm, M);
  const snrIn = noisySignal ? calcSNR(ecgSignal, noisySignal) : null;
  const snrOut = calcSNR(
    ecgSignal.slice(0, denoised.length),
    denoised.map((p) => p.y)
  );

  return {
    type: "MVDR Beamformer",
    phi,
    G_dB_avg: G_dB_avg.map((v) => v - maxG),
    denoised,
    original,
    covarianceHeatmap,
    M,
    snapshots: blockSize,
    theta_s,
    theta_i,
    snr_dB,
    inr_dB,
    monteCarloRuns,
    diagLoad,
    snrIn,
    snrOut,
    usedNoisyInput: Boolean(noisySignal),
  };
}

// ── Legacy exports (3b) ──────────────────────────────────────────────────────
export function runLMS_Equalization(N, M, mu, seed = Date.now()) {
  const random = createRng(seed);
  const s = Array.from({ length: N }, () => (random() > 0.5 ? 1 : -1));
  const h = [1, 0.5];
  const r = s.map((_, i) =>
    h[0] * s[i] + (i > 0 ? h[1] * s[i - 1] : 0) + 0.1 * (random() - 0.5)
  );
  let w = new Array(M).fill(0);
  const mse = [];
  const w_history = Array.from({ length: M }, () => []);
  for (let i = M; i < N; i++) {
    const x = r.slice(i - M, i).reverse();
    const y = w.reduce((sum, wi, j) => sum + wi * x[j], 0);
    const e = s[i - Math.floor(M / 2)] - y;
    mse.push(e * e);
    w = w.map((wi, j) => wi + 2 * mu * e * x[j]);
    w.forEach((wi, j) => w_history[j].push(wi));
  }
  return {
    mse,
    weights: w_history,
    iterations: Array.from({ length: mse.length }, (_, i) => i + 1),
    finalWeights: w,
  };
}

export function runLMS_Prediction(N, P, mu, seed = Date.now()) {
  const random = createRng(seed);
  const v = Array.from({ length: N }, () => (random() - 0.5) * 0.5);
  const u = new Array(N).fill(0);
  u[0] = 0.5;
  u[1] = 1.0;
  for (let i = 2; i < N; i++)
    u[i] = 0.75 * u[i - 1] - 0.5 * u[i - 2] + v[i];
  let w = new Array(P).fill(0);
  const mse = [];
  const w_history = Array.from({ length: P }, () => []);
  for (let i = P; i < N; i++) {
    const x = u.slice(i - P, i).reverse();
    const y_pred = w.reduce((s, wi, j) => s + wi * x[j], 0);
    const e = u[i] - y_pred;
    mse.push(e * e);
    w = w.map((wi, j) => wi + 2 * mu * e * x[j]);
    w.forEach((wi, j) => w_history[j].push(wi));
  }
  return {
    mse,
    weights: w_history,
    iterations: Array.from({ length: mse.length }, (_, i) => i + 1),
    signal: u.slice(0, 300),
    finalWeights: w,
  };
}

export function runRLS_Equalization(N, M, lambda, delta, seed = Date.now()) {
  const random = createRng(seed);
  const s = Array.from({ length: N }, () => (random() > 0.5 ? 1 : -1));
  const h = [1, 0.5];
  const r = s.map((_, i) =>
    h[0] * s[i] + (i > 0 ? h[1] * s[i - 1] : 0) + 0.1 * (random() - 0.5)
  );
  let w = new Array(M).fill(0);
  let Pmat = Array.from({ length: M }, (_, i) =>
    Array.from({ length: M }, (_, j) =>
      i === j ? 1 / Math.max(delta, 1e-9) : 0
    )
  );
  const mse = [];
  const w_history = Array.from({ length: M }, () => []);
  for (let i = M; i < N; i++) {
    const x = r.slice(i - M, i).reverse();
    const d = s[i - Math.floor(M / 2)];
    const Px = new Array(M).fill(0);
    for (let row = 0; row < M; row++) {
      let sum = 0;
      for (let col = 0; col < M; col++) sum += Pmat[row][col] * x[col];
      Px[row] = sum;
    }
    let xTPx = 0;
    for (let k = 0; k < M; k++) xTPx += x[k] * Px[k];
    const dn = Math.max(lambda + xTPx, 1e-12);
    const K = Px.map((v) => v / dn);
    let y = 0;
    for (let k = 0; k < M; k++) y += w[k] * x[k];
    const e = d - y;
    mse.push(e * e);
    for (let k = 0; k < M; k++) w[k] += K[k] * e;
    const xTP = new Array(M).fill(0);
    for (let col = 0; col < M; col++) {
      let sum = 0;
      for (let row = 0; row < M; row++) sum += x[row] * Pmat[row][col];
      xTP[col] = sum;
    }
    const newP = Array.from({ length: M }, () => new Array(M).fill(0));
    for (let row = 0; row < M; row++)
      for (let col = 0; col < M; col++)
        newP[row][col] =
          (Pmat[row][col] - K[row] * xTP[col]) / Math.max(lambda, 1e-12);
    Pmat = newP;
    w.forEach((wi, j) => w_history[j].push(wi));
  }
  return {
    mse,
    weights: w_history,
    iterations: Array.from({ length: mse.length }, (_, i) => i + 1),
    finalWeights: w,
  };
}

export function runRLS_Prediction(N, Porder, lambda, delta, seed = Date.now()) {
  const random = createRng(seed);
  const v = Array.from({ length: N }, () => (random() - 0.5) * 0.5);
  const u = new Array(N).fill(0);
  u[0] = 0.5;
  u[1] = 1.0;
  for (let i = 2; i < N; i++)
    u[i] = 0.75 * u[i - 1] - 0.5 * u[i - 2] + v[i];
  let w = new Array(Porder).fill(0);
  let Pmat = Array.from({ length: Porder }, (_, i) =>
    Array.from({ length: Porder }, (_, j) =>
      i === j ? 1 / Math.max(delta, 1e-9) : 0
    )
  );
  const mse = [];
  const w_history = Array.from({ length: Porder }, () => []);
  for (let i = Porder; i < N; i++) {
    const x = u.slice(i - Porder, i).reverse();
    const d = u[i];
    const Px = new Array(Porder).fill(0);
    for (let row = 0; row < Porder; row++) {
      let sum = 0;
      for (let col = 0; col < Porder; col++) sum += Pmat[row][col] * x[col];
      Px[row] = sum;
    }
    let xTPx = 0;
    for (let k = 0; k < Porder; k++) xTPx += x[k] * Px[k];
    const dn = Math.max(lambda + xTPx, 1e-12);
    const K = Px.map((v) => v / dn);
    let y = 0;
    for (let k = 0; k < Porder; k++) y += w[k] * x[k];
    const e = d - y;
    mse.push(e * e);
    for (let k = 0; k < Porder; k++) w[k] += K[k] * e;
    const xTP = new Array(Porder).fill(0);
    for (let col = 0; col < Porder; col++) {
      let sum = 0;
      for (let row = 0; row < Porder; row++) sum += x[row] * Pmat[row][col];
      xTP[col] = sum;
    }
    const newP = Array.from({ length: Porder }, () => new Array(Porder).fill(0));
    for (let row = 0; row < Porder; row++)
      for (let col = 0; col < Porder; col++)
        newP[row][col] =
          (Pmat[row][col] - K[row] * xTP[col]) / Math.max(lambda, 1e-12);
    Pmat = newP;
    w.forEach((wi, j) => w_history[j].push(wi));
  }
  return {
    mse,
    weights: w_history,
    iterations: Array.from({ length: mse.length }, (_, i) => i + 1),
    signal: u.slice(0, 300),
    finalWeights: w,
  };
}
