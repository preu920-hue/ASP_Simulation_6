import { useContext, useMemo } from "react";
import { Line } from "react-chartjs-2";
import { SimulationContext } from "../../context/SimulationContext";
import { computePSD, psdPowerNearFreq } from "../../utils/psd";
import { hoverAlongLineInteraction } from "../../utils/chartInteraction";
import graphStyles from "./exp3aGraph.module.css";
import styles from "./psdCard.module.css";

const POWERLINE_HZ = 50;

function getProcessedSignal(algoResults, filteredSamples) {
  if (filteredSamples?.length > 0) {
    return filteredSamples.map((p) => p.y);
  }
  if (algoResults?.type === "AR Process") {
    return algoResults.data.predicted.map((p) => p.y);
  }
  if (algoResults?.type === "MVDR Beamformer") {
    return algoResults.data.denoised.map((p) => p.y);
  }
  return [];
}

function getNoisySignal(noisySamples, rawSamples, time, channel) {
  const source = noisySamples?.length > 0 ? noisySamples : rawSamples;
  const windowed = source.filter((p) => p.x <= time);
  if (windowed.length < 2) return [];
  return windowed.map((p) => p[channel]);
}

export const EcgPSDComparison = () => {
  const {
    algoResults,
    filteredSamples,
    noisySamples,
    rawSamples,
    generateECG,
    originalFs,
    time,
    selectedChannels,
    applyNoiseTrigger,
    noise,
    algorithmType,
  } = useContext(SimulationContext);

  const comparison = useMemo(() => {
    if (!algoResults || !generateECG) return null;

    const channel = selectedChannels[0];
    if (!channel) return null;

    const noisySignal = getNoisySignal(noisySamples, rawSamples, time, channel);
    const processedSignal = getProcessedSignal(algoResults, filteredSamples);

    if (noisySignal.length < 2 || processedSignal.length < 2) return null;

    const fs = Number(originalFs);
    const before = computePSD(noisySignal, fs);
    const after = computePSD(processedSignal, fs);

    const before50 = psdPowerNearFreq(before.freqs, before.psd, POWERLINE_HZ);
    const after50 = psdPowerNearFreq(after.freqs, after.psd, POWERLINE_HZ);
    const reductionPct =
      before50 > 0 ? Math.max(0, ((before50 - after50) / before50) * 100) : 0;

    return { before, after, before50, after50, reductionPct, channel };
  }, [
    algoResults,
    filteredSamples,
    noisySamples,
    rawSamples,
    generateECG,
    originalFs,
    time,
    selectedChannels,
  ]);

  if (!comparison) return null;

  const fs = Number(originalFs);
  const algoLabel =
    algorithmType === "AR Process" ? "LMS-AR processed" : "MVDR denoised";

  const chartData = {
    datasets: [
      {
        label: "Before algorithm (noisy ECG)",
        data: comparison.before.psd.map((p, i) => ({
          x: comparison.before.freqs[i],
          y: p,
        })),
        borderColor: "#e63946",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0,
      },
      {
        label: `After algorithm (${algoLabel})`,
        data: comparison.after.psd.map((p, i) => ({
          x: comparison.after.freqs[i],
          y: p,
        })),
        borderColor: "#2dc653",
        borderWidth: 1.5,
        pointRadius: 0,
        borderDash: [6, 3],
        tension: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: true,
    parsing: false,
    interaction: hoverAlongLineInteraction,
    plugins: {
      legend: {
        display: true,
        position: "top",
        labels: { font: { size: 11 } },
      },
      title: {
        display: true,
        text: "Power Spectral Density — Before vs After Algorithm",
        font: { size: 13, weight: "bold" },
        color: "#1d7480",
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const x = items[0]?.parsed?.x;
            return x != null ? `${x.toFixed(1)} Hz` : "";
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        min: 0,
        max: fs / 2,
        title: {
          display: true,
          text: "Frequency (Hz)",
          font: { size: 12, weight: "bold" },
        },
        ticks: { maxTicksLimit: 12 },
      },
      y: {
        min: 0,
        title: {
          display: true,
          text: "PSD (V²/Hz)",
          font: { size: 12, weight: "bold" },
        },
      },
    },
  };

  return (
    <div id="psdComparisonSection" className={styles.card}>
      <h4 className={graphStyles.sectionHeading}>Step 1 — Did the algorithm reduce noise in frequency?</h4>

      {!applyNoiseTrigger && (
        <p className={styles.hint}>
          Add noise to the ECG first (e.g. Powerline 50 Hz) so the before/after comparison is meaningful.
        </p>
      )}

      {applyNoiseTrigger && noise.powerline && (
        <div className={graphStyles.metricRow}>
          <span className={graphStyles.metricChip}>
            Power near {POWERLINE_HZ} Hz (before): {comparison.before50.toExponential(2)}
          </span>
          <span className={graphStyles.metricChip}>
            Power near {POWERLINE_HZ} Hz (after): {comparison.after50.toExponential(2)}
          </span>
          <span className={`${graphStyles.metricChip} ${graphStyles.metricHighlight}`}>
            ≈ {comparison.reductionPct.toFixed(0)}% lower at {POWERLINE_HZ} Hz
          </span>
        </div>
      )}

      <div className={styles.chartShell} style={{ height: 300 }}>
        <Line data={chartData} options={options} />
      </div>

      <p className={graphStyles.describeBox}>
        <b>How to read:</b> The red curve is the contaminated ECG spectrum; the green dashed curve is
        after running your algorithm with the current parameters. A peak near <b>50 Hz</b> comes from
        powerline interference — it should drop after a successful run. Tune μ, P (LMS-AR) or array/DOA
        (MVDR) and click <b>Apply Algorithm</b> again to see the green curve change.
      </p>
    </div>
  );
};
