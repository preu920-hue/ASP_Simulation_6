import { useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import styles from "./interactiveTutorChart.module.css";
import { hoverAlongLineInteraction } from "../../utils/chartInteraction";

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const getY = (point) => {
  if (typeof point === "number") return point;
  if (point && typeof point === "object") {
    if (Number.isFinite(point.y)) return point.y;
    if (Number.isFinite(point)) return point;
  }
  return 0;
};

const getX = (point, fallback) => {
  if (point && typeof point === "object" && Number.isFinite(point.x)) return point.x;
  return fallback;
};

const inferRegion = (index, total) => {
  if (total <= 0) return "transient";
  const ratio = index / Math.max(total - 1, 1);
  if (ratio < 0.33) return "transient";
  if (ratio < 0.7) return "convergence";
  return "steady";
};

const formatMaybe = (value, digits = 4) =>
  Number.isFinite(value) ? value.toFixed(digits) : "-";

export const getBubbleContent = ({ graphKind, region, yValue, slope, xValue, params }) => {
  const algoText = params.algorithm || "adaptive filter";
  const muText = Number.isFinite(params.mu) ? `mu=${params.mu}` : null;
  const orderText = Number.isFinite(params.order) ? `P=${params.order}` : null;

  if (graphKind === "mse") {
    if (region === "transient") {
      return `Learning phase: MSE=${formatMaybe(yValue)} near iteration ${Math.round(xValue)}. ${muText ? `Smaller ${muText} improves stability.` : ""}`;
    }
    if (region === "convergence") {
      return `MSE is decreasing (slope ${formatMaybe(slope, 5)}). ${orderText ? `AR order ${orderText} affects convergence speed.` : ""}`;
    }
    return `Steady-state MSE=${formatMaybe(yValue)} after convergence using ${algoText}.`;
  }

  if (graphKind === "weights") {
    if (region === "transient") return "Coefficient adaptation is rapid in this phase.";
    if (region === "convergence") return "Weights are stabilizing toward the Wiener optimum.";
    return "Weights are mostly steady; small ripples are normal tracking noise.";
  }

  if (graphKind === "beampattern") {
    return `At θ=${formatMaybe(xValue, 1)}°, gain=${formatMaybe(yValue, 2)} dB. Peak should align with signal DOA; null suppresses interference.`;
  }

  if (graphKind === "filtering") {
    return `Amplitude ${formatMaybe(yValue)} at sample ${Math.round(xValue)}. ${region === "steady" ? "Waveforms are aligned — low prediction error." : "Model is still adapting."}`;
  }

  return `Value ${formatMaybe(yValue)} at index ${Math.round(xValue)}.`;
};

export const InteractiveTutorChart = ({
  title,
  graphKind,
  chartData,
  options,
  params,
  height = 260,
}) => {
  const containerRef = useRef(null);
  const [hoverState, setHoverState] = useState(null);

  const dataLength = chartData?.datasets?.[0]?.data?.length || 0;

  const updateHover = (chart, element, nativeEvent) => {
    if (!chart || !element) return;
    const datasetIndex = element.datasetIndex || 0;
    const index = element.index || 0;
    const dataset = chart.data.datasets?.[datasetIndex];
    if (!dataset?.data?.length) return;

    const current = dataset.data[index];
    const prev = dataset.data[Math.max(0, index - 1)];
    const yCurrent = getY(current);
    const yPrev = getY(prev);
    const xCurrent = getX(current, index);
    const region = inferRegion(index, dataset.data.length);
    const slope = yCurrent - yPrev;
    const bubbleText = getBubbleContent({
      graphKind,
      region,
      yValue: yCurrent,
      slope,
      xValue: xCurrent,
      params: params || {},
    });

    const rect = containerRef.current?.getBoundingClientRect();
    const offsetX = nativeEvent?.offsetX ?? 0;
    const offsetY = nativeEvent?.offsetY ?? 0;
    const left = clamp(offsetX + 18, 10, (rect?.width || 420) - 270);
    const top = clamp(offsetY - 14, 10, (rect?.height || 260) - 110);

    setHoverState({ index, region, left, top, bubbleText });
  };

  const mergedOptions = useMemo(() => {
    const base = options || {};
    const existingPlugins = base.plugins || {};
    const existingTooltip = existingPlugins.tooltip || {};
    return {
      ...base,
      interaction: {
        ...hoverAlongLineInteraction,
        ...(base.interaction || {}),
      },
      onHover: (event, elements, chart) => {
        if (elements?.length) {
          updateHover(chart, elements[0], event?.native);
        } else {
          setHoverState(null);
        }
        if (typeof base.onHover === "function") {
          base.onHover(event, elements, chart);
        }
      },
      plugins: {
        ...existingPlugins,
        tooltip: {
          ...existingTooltip,
          enabled: false,
          external: (ctx) => {
            const tooltip = ctx.tooltip;
            if (!tooltip || tooltip.opacity === 0) {
              setHoverState(null);
              return;
            }
            if (!tooltip.dataPoints?.length) return;
            updateHover(ctx.chart, tooltip.dataPoints[0], {
              offsetX: tooltip.caretX,
              offsetY: tooltip.caretY,
            });
          },
        },
      },
    };
  }, [options, graphKind, params]);

  return (
    <div className={styles.chartCard}>
      {title && <h4 className={styles.chartTitle}>{title}</h4>}
      <div className={styles.chartWrap} ref={containerRef} style={{ height }}>
        <div className="dashboard-chart-shell">
          <Line data={chartData} options={mergedOptions} />
        </div>
        {hoverState && (
          <div className={styles.bubble} style={{ left: hoverState.left, top: hoverState.top }}>
            {hoverState.bubbleText}
          </div>
        )}
      </div>
      {dataLength <= 1 && (
        <p className={styles.hoverHint}>Hover guidance appears when enough samples exist.</p>
      )}
    </div>
  );
};
