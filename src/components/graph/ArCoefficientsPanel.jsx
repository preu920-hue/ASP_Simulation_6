import { useMemo } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import graphStyles from "./exp3aGraph.module.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const COEF_COLORS = ["#0078d4", "#e63946", "#2dc653", "#f4a261"];

const fmt = (v, digits = 4) => (Number.isFinite(v) ? v.toFixed(digits) : "—");

/** RMS distance from Wiener optimum across all coefficients at each iteration. */
function buildRmsErrorSeries(wHist, wOpt) {
  const nIter = wHist[0]?.length ?? 0;
  const p = Math.min(wHist.length, wOpt.length);
  return Array.from({ length: nIter }, (_, i) => {
    let sumSq = 0;
    for (let k = 0; k < p; k++) {
      const d = wHist[k][i] - wOpt[k];
      sumSq += d * d;
    }
    return Math.sqrt(sumSq / p);
  });
}

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  layout: {
    padding: { top: 4, right: 8, bottom: 20, left: 4 },
  },
};

const scaleTitle = (text) => ({
  display: true,
  text,
  font: { size: 11, weight: "bold" },
  padding: { top: 10 },
});

export const ArCoefficientsPanel = ({ wHist, wOpt, orderP }) => {
  const p = Math.min(orderP ?? wHist.length, wHist.length, wOpt.length, 4);

  const { errorLabels, errorData, finalEst, finalOpt, rmsFinal } = useMemo(() => {
    const rms = buildRmsErrorSeries(wHist, wOpt);
    const n = rms.length;
    const labels = Array.from({ length: n }, (_, i) => i + 1);
    const est = wHist.slice(0, p).map((arr) => arr[arr.length - 1]);
    const opt = wOpt.slice(0, p);
    return {
      errorLabels: labels,
      errorData: rms,
      finalEst: est,
      finalOpt: opt,
      rmsFinal: n ? rms[n - 1] : 0,
    };
  }, [wHist, wOpt, p]);

  const coefLabels = Array.from({ length: p }, (_, i) => `w${i + 1}`);

  const errorChart = {
    labels: errorLabels,
    datasets: [
      {
        label: "RMS error vs Wiener optimum",
        data: errorData,
        borderColor: "#1d7480",
        backgroundColor: "rgba(29, 116, 128, 0.12)",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.15,
      },
    ],
  };

  const compareChart = {
    labels: coefLabels,
    datasets: [
      {
        label: "LMS (final)",
        data: finalEst,
        backgroundColor: COEF_COLORS.slice(0, p).map((c) => c + "cc"),
        borderColor: COEF_COLORS.slice(0, p),
        borderWidth: 1.5,
      },
      {
        label: "Wiener optimal",
        data: finalOpt,
        backgroundColor: "rgba(148, 163, 184, 0.35)",
        borderColor: "#64748b",
        borderWidth: 1.5,
        borderDash: [4, 2],
      },
    ],
  };

  const errorOptions = {
    ...baseOpts,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Learning: distance from Wiener optimum",
        font: { size: 13, weight: "bold" },
        color: "#1d7480",
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `RMS error: ${fmt(ctx.parsed.y, 6)}`,
        },
      },
    },
    scales: {
      x: {
        title: scaleTitle("Iteration"),
        ticks: { maxTicksLimit: 8, maxRotation: 0 },
      },
      y: {
        title: scaleTitle("RMS coefficient error"),
        beginAtZero: true,
      },
    },
  };

  const compareOptions = {
    ...baseOpts,
    plugins: {
      legend: { display: true, position: "top", labels: { font: { size: 11 } } },
      title: {
        display: true,
        text: "Final coefficients: LMS vs Wiener-Hopf",
        font: { size: 13, weight: "bold" },
        color: "#1d7480",
      },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            if (!items.length) return [];
            const idx = items[0].dataIndex;
            const est = finalEst[idx];
            const opt = finalOpt[idx];
            const diff = est - opt;
            return [`Difference: ${fmt(diff, 5)}`, `Wiener target: ${fmt(opt, 4)}`];
          },
        },
      },
    },
    scales: {
      x: {
        title: scaleTitle("AR coefficient"),
        ticks: { maxRotation: 0 },
      },
      y: {
        title: scaleTitle("Coefficient value"),
      },
    },
  };

  return (
    <div className={graphStyles.coefPanel}>
      <h4 className={graphStyles.chartBlockTitle}>AR coefficient learning (vs Wiener-Hopf)</h4>

      <div className={graphStyles.coefMetricRow}>
        <span className={graphStyles.metricChip}>
          Final RMS error: <strong>{fmt(rmsFinal, 6)}</strong>
        </span>
        {finalEst.map((est, k) => (
          <span
            key={coefLabels[k]}
            className={
              Math.abs(est - finalOpt[k]) < 0.01
                ? `${graphStyles.metricChip} ${graphStyles.metricHighlight}`
                : graphStyles.metricChip
            }
          >
            {coefLabels[k]}: LMS {fmt(est)} → Wiener {fmt(finalOpt[k])}
          </span>
        ))}
      </div>

      <div className={graphStyles.coefChartRow}>
        <div className={`${graphStyles.coefChartBox} ${graphStyles.coefChartBoxError}`}>
          <div className={graphStyles.coefChartInner}>
            <Line data={errorChart} options={errorOptions} />
          </div>
        </div>
        <div className={`${graphStyles.coefChartBox} ${graphStyles.coefChartBoxCompare}`}>
          <div className={graphStyles.coefChartInner}>
            <Bar data={compareChart} options={compareOptions} />
          </div>
        </div>
      </div>

      <p className={graphStyles.coefDescribe}>
        Left: one curve shows how far all coefficients are from the Wiener-Hopf solution (should fall toward
        zero). Right: bars compare each final LMS weight to its theoretical optimum — they should match when
        learning has finished.
      </p>
    </div>
  );
};
