import { useContext } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import { useCompareRuns } from "../../context/CompareRunsContext";
import { InteractiveTutorChart } from "./InteractiveTutorChart.jsx";
import { ArCoefficientsPanel } from "./ArCoefficientsPanel.jsx";
import { CompareRunsChart } from "./CompareRunsChart.jsx";
import { EcgPSDComparison } from "./EcgPSDComparison.jsx";
import graphStyles from "./exp3aGraph.module.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const lineOpts = (titleText, xLabel, yLabel, extra = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: true, position: "top", labels: { font: { size: 11 } } },
    title: { display: true, text: titleText, font: { size: 13, weight: "bold" }, color: "#1d7480" },
  },
  scales: {
    x: {
      title: { display: true, text: xLabel, font: { size: 12, weight: "bold" } },
      ticks: { maxTicksLimit: 10 },
    },
    y: {
      title: { display: true, text: yLabel, font: { size: 12, weight: "bold" } },
    },
    ...extra,
  },
});

/** Max samples shown on ECG comparison charts (keeps x-axis readable). */
const ECG_CHART_MAX_SAMPLES = 500;

const Badge = ({ label, value }) => (
  <span className={graphStyles.badge}>
    <strong>{label}:</strong> {value}
  </span>
);

export const Exp3aGraph = () => {
  const { algoResults } = useContext(SimulationContext);
  const {
    lmsArCompare,
    mvdrCompare,
    pinLmsRun,
    clearLmsRuns,
    pinMvdrRun,
    clearMvdrRuns,
  } = useCompareRuns();
  if (!algoResults) return null;

  if (algoResults.type === "AR Process") {
    const d = algoResults.data;
    const params = { algorithm: "LMS-AR", mu: d.mu, order: d.P };

    const originalEcgChart = {
      labels: d.original.map((p) => p.x),
      datasets: [
        {
          label: "Noisy ECG (input)",
          data: d.original.map((p) => p.y),
          borderColor: "#e63946",
          borderWidth: 1.2,
          pointRadius: 0,
        },
      ],
    };

    const lmsArPredictedChart = {
      labels: d.original.map((p) => p.x),
      datasets: [
        {
          label: "LMS-AR Predicted",
          data: d.predicted.map((p) => p.y),
          borderColor: "#2dc653",
          borderWidth: 1.2,
          pointRadius: 0,
          borderDash: [4, 2],
        },
      ],
    };

    return (
      <div id="algoOutputSection" className={graphStyles.panel}>
        <h3 className={graphStyles.panelTitle}>LMS – AR Process Output on ECG</h3>
        <div className={graphStyles.badgeRow}>
          <Badge label="AR Order (P)" value={d.P} />
          <Badge label="μ" value={d.mu?.toFixed(5)} />
          <Badge label="MC Runs" value={d.monteCarloRuns} />
          <Badge label="Samples" value={d.N} />
        </div>

        <EcgPSDComparison />

        <div className={graphStyles.guideBox}>
          <p>
            <b>Workflow:</b> First check the PSD chart above (frequency domain), then the time-domain
            and learning plots below. MSE should decrease and plateau when LMS-AR converges.
          </p>
          <ul>
            <li>Try smaller μ if MSE oscillates.</li>
            <li>Increase P if error stays high after convergence.</li>
          </ul>
        </div>

        <h4 className={graphStyles.sectionHeading}>Step 2 — Time domain &amp; learning curves</h4>

        <InteractiveTutorChart
          title="Noisy ECG (algorithm input)"
          graphKind="filtering"
          params={params}
          height={280}
          chartData={originalEcgChart}
          options={lineOpts("Noisy ECG (input)", "Sample Index", "Amplitude (mV)")}
        />
        <InteractiveTutorChart
          title="LMS-AR Predicted"
          graphKind="filtering"
          params={params}
          height={280}
          chartData={lmsArPredictedChart}
          options={lineOpts("LMS-AR Predicted", "Sample Index", "Amplitude (mV)")}
        />
        <p className={graphStyles.describeBox}>
          LMS learns AR coefficients from the noisy ECG and predicts the next sample (denoised estimate).
        </p>

        <CompareRunsChart
          title={`MC Averaged MSE Learning Curve (${d.monteCarloRuns} runs)`}
          graphKind="mse"
          params={params}
          height={280}
          compareState={lmsArCompare}
          onPin={pinLmsRun}
          onClear={clearLmsRuns}
          activeLabel={`Current: MSE (MC avg, ${d.monteCarloRuns} runs)`}
          activeColor="#e63946"
          activeBackgroundColor="rgba(230,57,70,0.08)"
          activeFill
          options={lineOpts(`MSE Learning Curve (${d.monteCarloRuns} MC runs)`, "Iteration", "MSE")}
        />
        <p className={graphStyles.describeBox}>
          MSE decreases as weights converge toward the Wiener optimum. Pin runs to overlay
          learning curves from different μ and P settings.
        </p>

        {d.w_hist && d.w_opt && (
          <ArCoefficientsPanel wHist={d.w_hist} wOpt={d.w_opt} orderP={d.P} />
        )}
      </div>
    );
  }

  if (algoResults.type === "MVDR Beamformer") {
    const d = algoResults.data;
    const params = { algorithm: "MVDR", order: d.M };

    const originalShown = d.original.slice(0, ECG_CHART_MAX_SAMPLES);
    const denoisedShown = d.denoised.slice(0, ECG_CHART_MAX_SAMPLES);

    const originalEcgChart = {
      labels: originalShown.map((p) => p.x),
      datasets: [
        {
          label: "Noisy ECG (input)",
          data: originalShown.map((p) => p.y),
          borderColor: "#e63946",
          borderWidth: 1.2,
          pointRadius: 0,
        },
      ],
    };

    const mvdrDenoisedChart = {
      labels: originalShown.map((p) => p.x),
      datasets: [
        {
          label: "MVDR Denoised",
          data: denoisedShown.map((p) => p.y),
          borderColor: "#2dc653",
          borderWidth: 1.2,
          pointRadius: 0,
          borderDash: [4, 2],
        },
      ],
    };

    return (
      <div id="algoOutputSection" className={graphStyles.panel}>
        <h3 className={graphStyles.panelTitle}>MVDR Beamformer Output on ECG</h3>
        <div className={graphStyles.badgeRow}>
          <Badge label="M" value={d.M} />
          <Badge label="K" value={d.snapshots} />
          <Badge label="θ_s" value={`${d.theta_s}°`} />
          <Badge label="θ_i" value={`${d.theta_i}°`} />
          <Badge label="SNR" value={`${d.snr_dB}dB`} />
          <Badge label="INR" value={`${d.inr_dB}dB`} />
          <Badge label="MC" value={d.monteCarloRuns} />
        </div>

        <EcgPSDComparison />

        <div className={graphStyles.guideBox}>
          <p>
            <b>Workflow:</b> Use the PSD chart above to see which frequencies were suppressed, then
            review denoised ECG and beampattern below. Peak at θ_s, null near θ_i.
          </p>
        </div>

        <h4 className={graphStyles.sectionHeading}>Step 2 — Time domain &amp; beampattern</h4>

        <InteractiveTutorChart
          title="Noisy ECG (algorithm input)"
          graphKind="filtering"
          params={params}
          height={280}
          chartData={originalEcgChart}
          options={lineOpts("Noisy ECG (input)", "Sample Index", "Amplitude (mV)")}
        />
        <InteractiveTutorChart
          title="MVDR Denoised ECG"
          graphKind="filtering"
          params={params}
          height={280}
          chartData={mvdrDenoisedChart}
          options={lineOpts("MVDR Denoised ECG", "Sample Index", "Amplitude (mV)")}
        />
        <p className={graphStyles.describeBox}>
          MVDR applies optimal weights to the noisy ECG to suppress interference while preserving morphology.
        </p>

        <CompareRunsChart
          title={`MVDR Beampattern — MC Averaged (${d.monteCarloRuns} runs)`}
          graphKind="beampattern"
          params={params}
          height={280}
          compareState={mvdrCompare}
          onPin={pinMvdrRun}
          onClear={clearMvdrRuns}
          activeLabel={`Current: Beampattern (MC avg, ${d.monteCarloRuns} runs)`}
          activeColor="#1D7480"
          activeBackgroundColor="rgba(29,116,128,0.07)"
          activeFill
          options={lineOpts(
            `MVDR Beampattern (${d.monteCarloRuns} MC runs)`,
            "Angle θ (degrees)",
            "Gain (dB)",
            {
              y: {
                min: -50,
                title: { display: true, text: "Normalized Gain (dB)", font: { size: 12, weight: "bold" } },
              },
            }
          )}
        />
        <p className={graphStyles.describeBox}>
          Peak at θ={d.theta_s}° (desired). Null at θ={d.theta_i}° (interference). Pin runs to
          compare beampatterns across array and DOA settings.
        </p>
      </div>
    );
  }

  return null;
};
