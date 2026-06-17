import { useContext } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import { useCompareRuns } from "../../context/CompareRunsContext";
import { InteractiveTutorChart } from "./InteractiveTutorChart.jsx";
import { CompareRunsChart } from "./CompareRunsChart.jsx";
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

const CovarianceHeatmap = ({ matrix }) => {
  if (!matrix?.length) return null;
  const flat = matrix.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const span = max - min || 1;
  const colorFor = (v) => {
    const t = (v - min) / span;
    const r = Math.round(29 + t * 100);
    const g = Math.round(116 + t * 60);
    const b = Math.round(128 - t * 40);
    return `rgb(${r},${g},${b})`;
  };
  return (
    <div className={graphStyles.heatmapWrap}>
      <table className={graphStyles.heatmapTable}>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              {row.map((val, j) => (
                <td
                  key={j}
                  className={graphStyles.heatmapCell}
                  style={{ background: colorFor(val) }}
                  title={`R̂[${i},${j}]=${val.toFixed(4)}`}
                >
                  {val.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const buildMseChartWithCi = (d, activeLabel, activeColor, activeBackgroundColor) => {
  const labels = d.iterations ?? d.mse.map((_, i) => i + 1);
  const datasets = [];
  if (d.mseCiUpper?.length) {
    datasets.push({
      label: "95% CI upper",
      data: d.mseCiUpper,
      borderColor: "rgba(45,198,83,0.35)",
      backgroundColor: "rgba(45,198,83,0.12)",
      borderWidth: 1,
      pointRadius: 0,
      borderDash: [4, 4],
      fill: "+1",
    });
  }
  if (d.mseCiLower?.length) {
    datasets.push({
      label: "95% CI lower",
      data: d.mseCiLower,
      borderColor: "rgba(45,198,83,0.35)",
      backgroundColor: "transparent",
      borderWidth: 1,
      pointRadius: 0,
      borderDash: [4, 4],
      fill: false,
    });
  }
  datasets.push({
    label: activeLabel,
    data: d.mse,
    borderColor: activeColor,
    backgroundColor: activeBackgroundColor,
    fill: true,
    borderWidth: 2,
    pointRadius: 0,
  });
  return { labels, datasets };
};

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
          label: "Original ECG",
          data: d.original.map((p) => p.y),
          borderColor: "#0078d4",
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
          borderColor: "#e63946",
          borderWidth: 1.2,
          pointRadius: 0,
          borderDash: [4, 2],
        },
      ],
    };

    const coefLabels = d.w_hist ? d.w_hist[0].map((_, i) => i + 1) : [];
    const coefColors = ["#0078d4", "#e63946", "#2dc653", "#f4a261"];
    const coefDatasets = d.w_hist
      ? [
          ...d.w_hist.slice(0, Math.min(4, d.P)).map((wArr, k) => ({
            label: `w${k + 1} estimated`,
            data: wArr,
            borderWidth: 1.2,
            pointRadius: 0,
            borderColor: coefColors[k % 4],
          })),
          ...(d.a_yw ?? d.w_opt?.map((w) => -w) ?? [])
            .slice(0, Math.min(4, d.P))
            .map((aVal, k) => ({
              label: `a${k + 1} Yule-Walker (${aVal?.toFixed(4)})`,
              data: new Array(coefLabels.length).fill(aVal),
              borderColor: coefColors[k % 4],
              borderWidth: 1,
              borderDash: [6, 3],
              pointRadius: 0,
            })),
        ]
      : [];

    return (
      <div id="algoOutputSection" className={graphStyles.panel}>
        <h3 className={graphStyles.panelTitle}>LMS – AR Process Output on ECG</h3>
        <div className={graphStyles.badgeRow}>
          <Badge label="AR Order (P)" value={d.P} />
          <Badge label="μ" value={d.mu?.toFixed(5)} />
          <Badge label="MC Runs" value={d.monteCarloRuns} />
          <Badge label="Samples" value={d.N} />
          {d.misadjustment != null && (
            <Badge label="Misadjustment M" value={d.misadjustment.toExponential(3)} />
          )}
          {d.jSs != null && <Badge label="J_ss" value={d.jSs.toExponential(3)} />}
          {d.snrIn != null && (
            <Badge label="SNR in" value={`${d.snrIn.toFixed(1)} dB`} />
          )}
          {d.snrOut != null && (
            <Badge label="SNR out" value={`${d.snrOut.toFixed(1)} dB`} />
          )}
          {d.usedNoisyInput && <Badge label="Input" value="Noisy ECG" />}
        </div>

        <div className={graphStyles.guideBox}>
          <p>
            <b>How to read these plots:</b> MSE vs iterations should decrease and plateau when LMS-AR
            converges (theory §4.3–4.4). The shaded band is the 95% Monte Carlo confidence interval —
            it narrows as N_MC increases (§6.4).
          </p>
          <ul>
            <li>Update rule: w[n+1] = w[n] + 2μ·e[n]·x[n]</li>
            <li>Try smaller μ if MSE oscillates; stability requires 0 &lt; μ &lt; 1/(P·P_x).</li>
            <li>Weights converge to Yule-Walker solution w_opt = R⁻¹p (AR coeffs a = −w_opt).</li>
          </ul>
        </div>

        <InteractiveTutorChart
          title="Original ECG"
          graphKind="filtering"
          params={params}
          height={280}
          chartData={originalEcgChart}
          options={lineOpts("Original ECG", "Sample Index", "Amplitude (mV)")}
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
          LMS adaptively estimates AR coefficients from ECG data; d[n] is clean ECG and x[n] uses the
          noisy observation when noise was added (unified pipeline §7.2).
        </p>

        <CompareRunsChart
          title={`MC Averaged MSE Learning Curve (${d.monteCarloRuns} runs, 95% CI)`}
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
          chartDataOverride={buildMseChartWithCi(
            d,
            `Current: MSE (MC avg, ${d.monteCarloRuns} runs)`,
            "#e63946",
            "rgba(230,57,70,0.08)"
          )}
          options={lineOpts(`MSE Learning Curve (${d.monteCarloRuns} MC runs)`, "Iteration", "MSE")}
        />
        <p className={graphStyles.describeBox}>
          J_MC[n] = (1/N_MC)Σe²_k[n] → expected MSE by the Law of Large Numbers. Pin runs to overlay
          learning curves from different μ and P settings.
        </p>

        {d.w_hist && coefDatasets.length > 0 && (
          <>
            <InteractiveTutorChart
              title="AR Coefficients Convergence vs Wiener Optimal"
              graphKind="weights"
              params={params}
              height={260}
              chartData={{ labels: coefLabels, datasets: coefDatasets }}
              options={lineOpts(
                "AR Coefficients Convergence vs Wiener Optimal",
                "Iteration",
                "Coefficient Value"
              )}
            />
            <p className={graphStyles.describeBox}>
              Estimated weights (solid) approach Wiener-Hopf w_opt; dashed lines show Yule-Walker AR
              coefficients a = −R⁻¹r.
            </p>
          </>
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
          label: "Original ECG",
          data: originalShown.map((p) => p.y),
          borderColor: "#0078d4",
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
          <Badge label="δ" value={d.diagLoad?.toFixed(3) ?? "0.01"} />
          {d.snrIn != null && (
            <Badge label="SNR in" value={`${d.snrIn.toFixed(1)} dB`} />
          )}
          {d.snrOut != null && (
            <Badge label="SNR out" value={`${d.snrOut.toFixed(1)} dB`} />
          )}
        </div>

        <div className={graphStyles.guideBox}>
          <p>
            <b>How to read these plots:</b> MVDR solves w = R⁻¹d / (dᴴR⁻¹d) with distortionless
            constraint wᴴd = 1 (§5.4). Block-based denoising uses R̂_DL = R̂ + δI from the noisy ECG.
          </p>
        </div>

        {d.covarianceHeatmap && (
          <>
            <h4 className={graphStyles.panelTitle} style={{ fontSize: "0.95rem" }}>
              Covariance Matrix R̂ (from noisy ECG)
            </h4>
            <CovarianceHeatmap matrix={d.covarianceHeatmap} />
            <p className={graphStyles.describeBox}>
              Brighter cells indicate stronger correlation between temporal snapshots. Diagonal loading
              δ stabilises R̂ when N &lt; 2M snapshots.
            </p>
          </>
        )}

        <InteractiveTutorChart
          title="Original ECG"
          graphKind="filtering"
          params={params}
          height={280}
          chartData={originalEcgChart}
          options={lineOpts("Original ECG", "Sample Index", "Amplitude (mV)")}
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
          MVDR applies optimal weights to suppress interference while preserving the desired signal.
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
