import { useMemo, useContext, useEffect } from "react";
import { SimulationContext } from "../../context/SimulationContext";
import styles from "./ecgNoisy.module.css";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import { buildNoisySamples } from "../../utils/buildNoisySamples";
import { hoverAlongLineInteraction } from "../../utils/chartInteraction";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend
);

export const EcgNoisy = () => {
  const {
    time,
    originalFs,
    applyNoiseTrigger,
    setApplyNoiseTrigger,
    noise,
    rawSamples,
    selectedChannels,
    setNoisySamples,
  } = useContext(SimulationContext);

  // toggle when all noise is false
  useEffect(() => {
    if (!noise.baseline && !noise.powerline && !noise.emg) {
      setApplyNoiseTrigger(false);
    }
  }, [noise, setApplyNoiseTrigger]);

  const data = useMemo(() => {
    if (!rawSamples.length || !applyNoiseTrigger) return [];
    return buildNoisySamples({
      rawSamples,
      selectedChannels,
      noise,
      time,
      originalFs,
    });
  }, [applyNoiseTrigger, noise, time, originalFs, rawSamples, selectedChannels]);

  useEffect(() => {
    if (!applyNoiseTrigger || !data.length) {
      setNoisySamples([]);
      return;
    }
    setNoisySamples(data);
  }, [data, applyNoiseTrigger, setNoisySamples]);

  const datasets = selectedChannels.map((ch) => ({
    label: ch,
    data: data.map((p) => ({ x: p.x, y: p[ch] })),
    borderColor: "red",
    borderWidth: 1,
    pointRadius: 0,
    tension: 0,
  }));

  const chartData = { datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: true,
    parsing: false,
    interaction: hoverAlongLineInteraction,
    plugins: {
      legend: {
        display: true,
      },
    },
    scales: {
      x: {
        type: "linear",
        title: {
          display: true,
          text: "Time (s)",
          font: {
            size: 13, // ← X-axis label font size
            weight: "bold",
          },
        },
        ticks: {
          font: {
            size: 13,
          },
        },
      },
      y: {
        title: {
          display: true,
          text: "Amplitude (mV)",
          font: {
            size: 13,
            weight: "bold",
          },
        },
        ticks: {
          font: {
            size: 12,
          },
        },
      },
    },
  };

  return (
    <div className={styles.signalContainer}>
      <h3>
        ECG Signal{" "}
        <span>
          {" "}
          (Contiminated with{" "}
          {noise.baseline
            ? `Baseline Wander ${
                (noise.baseline && noise.powerline) ||
                (noise.baseline && noise.emg)
                  ? ","
                  : ""
              }`
            : ""}{" "}
          {noise.powerline ? `Powerline Noise${noise.emg ? "," : ""}` : ""}{" "}
          {noise.emg ? "Muscle Noise" : ""})
        </span>
      </h3>

      <div className="dashboard-chart-shell">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};
