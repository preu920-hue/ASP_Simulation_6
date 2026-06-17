import React, { useContext } from "react";
import styles from "./instruction.module.css";
import { SimulationContext } from "../../context/SimulationContext.jsx";

export const Instruction = () => {
  const { algorithmType } = useContext(SimulationContext);
  const isAR = algorithmType === "AR Process";

  return (
    <div className={styles.box}>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>INSTRUCTIONS</h1>
          <p style={{ fontSize: "13px", color: "#555" }}>
            Adaptive Signal Processing Lab — Mode: <strong>{algorithmType}</strong>
          </p>
          <p style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>
            AR modelling · LMS adaptive filtering · MVDR beamforming · Monte Carlo validation
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 1: Signal Setup</span>
            <br />
            Select an <b>ECG Dataset</b> or upload CSV/TXT. ECG has P-QRS-T structure modelled as an
            AR(p) process (theory §3). Click <b>&quot;Generate ECG Signal&quot;</b> to load the trace.
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 2: Add Noise</span>
            <br />
            Enable <b>Baseline Wander</b>, <b>Powerline (50 Hz)</b>, and/or <b>EMG</b> to corrupt the
            signal: d[n] = x[n] + noise[n] (§7.2). Add noise before running algorithms for the full
            denoising pipeline.
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 3: Select Algorithm</span>
            <br />
            <b>LMS – AR Process</b> — adaptive one-step prediction; weights follow{" "}
            <b>w[n+1] = w[n] + 2μ·e[n]·x[n]</b> (§4.3).
            <br />
            <b>MVDR Beamformer</b> — optimal filter w = R⁻¹d / (dᴴR⁻¹d) with distortionless
            constraint (§5.4).
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 4: Configure Parameters</span>
            <br />
            {isAR ? (
              <>
                <b>AR Order (P)</b>, <b>Step Size (μ)</b> — keep 0 &lt; μ &lt; 1/(P·P_x) for stability
                (§4.4.1). <b>Monte Carlo Runs</b> — use 50–100 for smooth MSE averages and narrow 95%
                confidence bands (§6.2–6.4).
              </>
            ) : (
              <>
                <b>Array Elements (M)</b>, <b>Snapshots (K ≥ 2M)</b>, <b>DOA angles</b>,{" "}
                <b>Diagonal Loading δ</b> (R̂_DL = R̂ + δI, §5.6), and <b>Monte Carlo Runs</b>.
              </>
            )}
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 5: Run and Observe</span>
            <br />
            Click <b>&quot;Apply Algorithm&quot;</b>. For LMS-AR: MSE learning curve, misadjustment
            M ≈ μ·tr(R), and coefficient convergence toward Yule-Walker solution. For MVDR: covariance
            heatmap, denoised ECG, and beampattern. Use <b>Compute PSD</b> to compare spectra.
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>Troubleshooting</span>
            <br />
            LMS MSE not decreasing → reduce μ. MVDR output unchanged → increase snapshots or δ.
            Wide MC confidence band → increase Monte Carlo runs to 50–100.
          </p>
        </div>
      </div>
    </div>
  );
};
