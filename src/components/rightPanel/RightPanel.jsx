import { useContext, useState, useEffect, useRef } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import styles from "./rightPanel.module.css";
import Swal from "sweetalert2";
import { runLMS_AR, runMVDR, buildDeterministicSeed } from "../../utils/algorithms";
import { buildNoisySamples, noisySamplesToChannelSignal } from "../../utils/buildNoisySamples";
import { ECG_DATASET_OPTIONS, pathForDatasetId, publicAssetPath } from "../../utils/ecgDatasets.js";

// ── Formula display components ──────────────────────────────────────────────
const LmsFormula = ({ P, mu }) => (
  <div className={styles.formulaBox}>
    <div className={styles.formulaTitle}>LMS-AR Algorithm Formulae</div>
    <div className={styles.formulaGrid}>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>AR Prediction</span>
        <span className={styles.formulaEq}>ŷ(n) = Σₖ₌₁ᴾ wₖ(n)·u(n−k)</span>
      </div>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>Error</span>
        <span className={styles.formulaEq}>e(n) = u(n) − ŷ(n)</span>
      </div>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>Weight Update</span>
        <span className={styles.formulaEq}>w(n+1) = w(n) + μ·e(n)·x(n)</span>
      </div>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>Wiener Optimal</span>
        <span className={styles.formulaEq}>w_opt = R⁻¹·p, &nbsp; Rᵢⱼ = r(|i−j|)</span>
      </div>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>Stability</span>
        <span className={styles.formulaEq}>μ &lt; 1/(P·σ²ₓ) &nbsp;[P={P}, μ={mu.toFixed(5)}]</span>
      </div>
    </div>
  </div>
);

const MvdrFormula = ({ M, thetaS, thetaI }) => (
  <div className={styles.formulaBox}>
    <div className={styles.formulaTitle}>MVDR Beamformer Formulae</div>
    <div className={styles.formulaGrid}>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>Steering Vector</span>
        <span className={styles.formulaEq}>[a(θ)]ₘ = e^(jmπsinθ), m=0…{M-1}</span>
      </div>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>Covariance Est.</span>
        <span className={styles.formulaEq}>R̂ = (1/K) Σₖ x(k)·xᴴ(k)</span>
      </div>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>MVDR Weights</span>
        <span className={styles.formulaEq}>w = R̂⁻¹a(θₛ) / (aᴴ(θₛ)·R̂⁻¹·a(θₛ))</span>
      </div>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>Constraint</span>
        <span className={styles.formulaEq}>wᴴ·a(θₛ) = 1 &nbsp;[θₛ={thetaS}°]</span>
      </div>
      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>Null at θᵢ</span>
        <span className={styles.formulaEq}>via R̂ estimation &nbsp;[θᵢ={thetaI}°]</span>
      </div>
    </div>
  </div>
);
// ────────────────────────────────────────────────────────────────────────────

export const RightPanel = () => {
  const {
    time, setTime, setGenerateECG, originalFs,
    csvFilePath, prevPathRef, setCsvFilePath,
    generateECG, algorithmType, setAlgorithmType,
    setAlgoResults, setAlgorithmMeta, rawSamples,
    noise, setNoise, setApplyNoiseTrigger, applyNoiseTrigger,
    setNoisySamples, setFilteredSamples,
    selectedChannels,
    signalType, setSignalType,
    uploadedSignalName, setUploadedSignalName,
    setUploadedSignalData,
    parseUploadedText, commitParsedSignal,
    markAction,
  } = useContext(SimulationContext);

  // LMS-AR params
  const [arP, setArP] = useState(4);
  const [arMu, setArMu] = useState(0.001);
  const [arMC, setArMC] = useState(50);
  // MVDR params
  const [mvdrM, setMvdrM] = useState(8);
  const [mvdrSnap, setMvdrSnap] = useState(256);
  const [mvdrThetaS, setMvdrThetaS] = useState(30);
  const [mvdrThetaI, setMvdrThetaI] = useState(-45);
  const [mvdrSnr, setMvdrSnr] = useState(20);
  const [mvdrInr, setMvdrInr] = useState(25);
  const [mvdrMC, setMvdrMC] = useState(50);

  const lastRunRef = useRef({ key: "", payload: null });

  const signalOptions = [
    ...ECG_DATASET_OPTIONS.map((o) => ({
      id: o.id,
      label: o.label,
      path: publicAssetPath(o.file),
    })),
    { id: "upload", label: "Upload your own (CSV/TXT)", path: "" },
  ];

  const onSignalTypeChange = (type) => {
    setSignalType(type);
    if (type !== "upload") {
      setCsvFilePath(pathForDatasetId(type));
    }
    setGenerateECG(false);
    setApplyNoiseTrigger(false);
    setNoisySamples([]);
    setFilteredSamples([]);
    setAlgoResults(null);
    lastRunRef.current = { key: "", payload: null };
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseUploadedText(text);
    if (!parsed) {
      Swal.fire({ icon: "error", title: "Invalid file", text: "Upload CSV/TXT with time and signal columns." });
      return;
    }
    setUploadedSignalName(file.name);
    setUploadedSignalData(parsed);
    setSignalType("upload");
    commitParsedSignal(parsed);
  };

  const noiseTrigger = () => {
    if (!generateECG) { Swal.fire({ icon: "info", title: "Oops...", text: "Please generate ECG signal first!" }); return; }
    if (!noise.baseline && !noise.powerline && !noise.emg) { Swal.fire({ icon: "info", title: "Oops...", text: "Please select at least one noise type!" }); return; }
    setApplyNoiseTrigger(true);
    markAction("ADD_NOISE");
  };

  const runFilter = () => {
    if (!generateECG || !rawSamples || rawSamples.length === 0) {
      Swal.fire({ icon: "info", title: "Oops...", text: "Please generate ECG signal first!" });
      return;
    }
    if (!applyNoiseTrigger) {
      Swal.fire({
        icon: "info",
        title: "Add noise first",
        text: "Apply at least one noise type so the frequency comparison (before vs after) is meaningful.",
      });
      return;
    }

    const channel = selectedChannels[0] || "ECG_I";
    const samplesForAlgo = buildNoisySamples({
      rawSamples,
      selectedChannels,
      noise,
      time,
      originalFs,
    });
    if (samplesForAlgo.length) setNoisySamples(samplesForAlgo);
    const ecgSignal = noisySamplesToChannelSignal(samplesForAlgo, channel);
    if (ecgSignal.length < 2) {
      Swal.fire({
        icon: "info",
        title: "No noisy signal",
        text: "Click 'Add Noise to Signal' first, then apply the algorithm.",
      });
      return;
    }

    const noiseKey = { baseline: noise.baseline, powerline: noise.powerline, emg: noise.emg };
    const runConfig =
      algorithmType === "AR Process"
        ? { algorithmType, arP, arMu, arMC, csvFilePath, time, noise: noiseKey }
        : {
            algorithmType,
            mvdrM,
            mvdrSnap,
            mvdrThetaS,
            mvdrThetaI,
            mvdrSnr,
            mvdrInr,
            mvdrMC,
            csvFilePath,
            time,
            noise: noiseKey,
          };
    setAlgorithmMeta(runConfig);
    const runKey = JSON.stringify(runConfig);
    if (lastRunRef.current.key === runKey && lastRunRef.current.payload) {
      const cached = lastRunRef.current.payload;
      setAlgoResults(cached);
      if (cached.type === "AR Process") {
        setFilteredSamples(cached.data.predicted.map((p) => ({ y: p.y })));
      } else {
        setFilteredSamples(cached.data.denoised.map((p) => ({ y: p.y })));
      }
      markAction("RUN_ALGORITHM");
      return;
    }
    let payload = null;
    if (algorithmType === "AR Process") {
      const sigma2 = ecgSignal.reduce((s, v) => s + v * v, 0) / ecgSignal.length;
      const muMax = 1 / (arP * sigma2 + 1e-6);
      if (arMu > muMax * 0.8) {
        Swal.fire({ icon: "warning", title: "Stability Warning", text: `μ = ${arMu.toFixed(5)} may be too large. Recommended μ < ${(muMax * 0.5).toExponential(3)}` });
      }
      const seed = buildDeterministicSeed(runConfig);
      const results = runLMS_AR(ecgSignal, arP, arMu, arMC, seed);
      if (!results) { Swal.fire({ icon: "error", title: "Error", text: "Insufficient ECG data." }); return; }
      payload = { type: "AR Process", data: results };
      setFilteredSamples(results.predicted.map((p) => ({ y: p.y })));
    } else {
      const results = runMVDR(ecgSignal, mvdrM, mvdrSnap, mvdrThetaS, mvdrThetaI, mvdrSnr, mvdrInr, mvdrMC);
      payload = { type: "MVDR Beamformer", data: results };
      setFilteredSamples(results.denoised.map((p) => ({ y: p.y })));
    }
    lastRunRef.current = { key: runKey, payload };
    setAlgoResults(payload);
    markAction("RUN_ALGORITHM");
  };

  useEffect(() => {
    if (prevPathRef.current !== csvFilePath) {
      setAlgoResults(null);
      lastRunRef.current = { key: "", payload: null };
      setApplyNoiseTrigger(false);
      setNoisySamples([]);
      setFilteredSamples([]);
      prevPathRef.current = csvFilePath;
    }
  }, [
    csvFilePath,
    prevPathRef,
    setAlgoResults,
    setApplyNoiseTrigger,
    setNoisySamples,
    setFilteredSamples,
  ]);

  return (
    <div className={styles.rightPanelContainer}>
      <div className={styles.right}>
        <h2>ECG Signal &amp; Algorithm Controls</h2>

        {/* SIGNAL SETUP */}
        <div id="signalSetup" className={styles.box}>
          <h3>Signal Setup</h3>
          <label>Select ECG Dataset</label>
          <select value={signalType} onChange={e => onSignalTypeChange(e.target.value)}>
            {signalOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>

          {signalType === "upload" && (
            <div id="uploadOption" style={{ marginTop: "8px" }}>
              <input type="file" accept=".csv,.txt" onChange={handleUpload} style={{ fontSize: "12px" }} />
              {uploadedSignalName && <p style={{ fontSize: "11px", color: "#1D7480", marginTop: "4px" }}>📄 {uploadedSignalName}</p>}
            </div>
          )}
          {signalType !== "upload" && <div id="uploadOption" style={{ display: "none" }} />}

          <label>Duration: <span>{time} seconds</span></label>
          <input type="range" min="1" max="70" value={time} onChange={e => setTime(Number(e.target.value))} />
          <label>Sampling Rate: <span>{originalFs} Hz</span></label>
          <button id="generateButton" onClick={() => { setGenerateECG(true); markAction("GENERATE_SIGNAL"); }}>
            Generate ECG Signal
          </button>
        </div>

        {/* NOISE */}
        <div id="noisePanel" className={styles.box}>
          <h3>Add Noise</h3>
          <label><input type="checkbox" checked={noise.baseline} onChange={e => setNoise({ ...noise, baseline: e.target.checked })} /> Baseline Wander</label>
          <label><input type="checkbox" checked={noise.powerline} onChange={e => setNoise({ ...noise, powerline: e.target.checked })} /> Powerline (50 Hz)</label>
          <label><input type="checkbox" checked={noise.emg} onChange={e => setNoise({ ...noise, emg: e.target.checked })} /> EMG Noise</label>
          <div className={styles.buttonContainer}>
            <button onClick={noiseTrigger}>Add Noise to Signal</button>
          </div>
        </div>

        {/* ALGORITHM SETUP */}
        <div id="algoSetup" className={styles.box}>
          <h3>Algorithm Setup</h3>
          <label>Algorithm</label>
          <select id="algorithmSelector" value={algorithmType} onChange={e => { setAlgorithmType(e.target.value); markAction("SELECT_ALGO"); }}>
            <option value="AR Process">LMS – AR Process</option>
            <option value="MVDR Beamformer">MVDR Beamformer</option>
          </select>

          {algorithmType === "AR Process" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              <LmsFormula P={arP} mu={arMu} />
              <label>AR Order (P): <strong>{arP}</strong></label>
              <input type="range" min="2" max="16" step="1" value={arP} onChange={e => setArP(Number(e.target.value))} />
              <span className={styles.hint}>Range: 2–16 · Controls prediction depth</span>
              <label>Step Size μ: <strong>{arMu.toFixed(5)}</strong></label>
              <input type="range" min="0.00001" max="0.005" step="0.00001" value={arMu} onChange={e => setArMu(Number(e.target.value))} />
              <span className={styles.hint}>Range: 0.00001–0.005 · Smaller = more stable</span>
              <label>Monte Carlo Runs: <strong>{arMC}</strong></label>
              <input type="range" min="10" max="200" step="10" value={arMC} onChange={e => setArMC(Number(e.target.value))} />
              <span className={styles.hint}>Range: 10–200 · More = smoother MSE</span>
            </div>
          )}

          {algorithmType === "MVDR Beamformer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
              <MvdrFormula M={mvdrM} thetaS={mvdrThetaS} thetaI={mvdrThetaI} />
              <label>Array Elements (M): <strong>{mvdrM}</strong></label>
              <input type="range" min="4" max="16" step="1" value={mvdrM} onChange={e => setMvdrM(Number(e.target.value))} />
              <span className={styles.hint}>Range: 4–16 · More = sharper beam</span>
              <label>Snapshots (K): <strong>{mvdrSnap}</strong></label>
              <input type="range" min="100" max="1000" step="50" value={mvdrSnap} onChange={e => setMvdrSnap(Number(e.target.value))} />
              <span className={styles.hint}>Range: 100–1000 · More = better covariance estimate</span>
              <label>Signal DOA θₛ: <strong>{mvdrThetaS}°</strong></label>
              <input type="range" min="0" max="90" step="1" value={mvdrThetaS} onChange={e => setMvdrThetaS(Number(e.target.value))} />
              <span className={styles.hint}>Range: 0–90° · Desired signal direction</span>
              <label>Interference DOA θᵢ: <strong>{mvdrThetaI}°</strong></label>
              <input type="range" min="-90" max="0" step="1" value={mvdrThetaI} onChange={e => setMvdrThetaI(Number(e.target.value))} />
              <span className={styles.hint}>Range: −90–0° · Null placed here</span>
              <label>SNR: <strong>{mvdrSnr} dB</strong></label>
              <input type="range" min="0" max="30" step="1" value={mvdrSnr} onChange={e => setMvdrSnr(Number(e.target.value))} />
              <label>INR: <strong>{mvdrInr} dB</strong></label>
              <input type="range" min="10" max="40" step="1" value={mvdrInr} onChange={e => setMvdrInr(Number(e.target.value))} />
              <label>Monte Carlo Runs: <strong>{mvdrMC}</strong></label>
              <input type="range" min="10" max="100" step="10" value={mvdrMC} onChange={e => setMvdrMC(Number(e.target.value))} />
              <span className={styles.hint}>Range: 10–100 · Averaged beampattern</span>
            </div>
          )}

          <p className={styles.hint} style={{ marginTop: "10px" }}>
            After you add noise, click Apply Algorithm — the output panel will show a before/after PSD
            chart so you can see which frequencies were reduced.
          </p>
          <div className={styles.psdContainer} style={{ marginTop: "12px", display: "flex", gap: "8px", flexDirection: "column" }}>
            <button id="applyAlgoBtn" onClick={runFilter}>Apply Algorithm</button>
          </div>
        </div>
      </div>
    </div>
  );
};
