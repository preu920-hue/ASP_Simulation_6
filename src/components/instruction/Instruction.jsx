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
            Mode: <strong>{algorithmType}</strong>
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 1: Signal Setup</span>
            <br />
            Select an <b>ECG Dataset</b> from the dropdown menu or upload your own CSV/TXT file.
            Use the <b>Duration</b> slider to limit the length of the data being analyzed, then click{" "}
            <b>&quot;Generate ECG Signal&quot;</b> to plot the raw signal.
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 2: Add Noise (optional)</span>
            <br />
            In the <b>Add Noise</b> section, select <b>Baseline Wander</b>, <b>Powerline (50 Hz)</b>,
            and/or <b>EMG Noise</b>. You must generate the ECG first. Click{" "}
            <b>&quot;Add Noise to Signal&quot;</b> to plot the contaminated ECG in <b>red</b> below the
            clean trace. Unchecking all noise types removes the noisy plot.
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 3: Select Algorithm</span>
            <br />
            Under <b>Algorithm Setup</b>, choose <b>LMS – AR Process</b> (ECG prediction) or{" "}
            <b>MVDR Beamformer</b> (ECG denoising).
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 4: Configure Parameters</span>
            <br />
            {isAR ? (
              <>
                Adjust <b>AR Order (P)</b>, <b>Step Size (μ)</b>, and <b>Monte Carlo Runs</b> to control
                prediction depth, convergence speed, and MSE averaging.
              </>
            ) : (
              <>
                Adjust <b>Array Elements (M)</b>, <b>Snapshots (K)</b>, <b>Signal/Interference DOA</b>,
                <b> SNR/INR</b>, and <b>Monte Carlo Runs</b> to shape the beampattern and denoising
                performance.
              </>
            )}
          </p>
        </div>
        <div className={styles.card}>
          <p>
            <span>STEP 5: Run and Observe</span>
            <br />
            Click <b>&quot;Apply Algorithm&quot;</b> after adding noise. The output panel opens with a
            <b>before/after PSD chart</b> (frequency domain), then time-domain ECG plots, MSE learning
            curve, coefficient convergence (AR), or beampattern (MVDR). Look for the 50 Hz peak to drop
            when powerline noise was added.
          </p>
        </div>
      </div>
    </div>
  );
};
