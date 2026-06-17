import { useMemo } from "react";
import { InteractiveTutorChart } from "./InteractiveTutorChart.jsx";
import { buildComparisonChartData, MAX_PINNED_RUNS } from "../../utils/compareRuns.js";
import styles from "./compareRunsChart.module.css";

const COMPARE_HELPER =
  "Compare how parameter tuning affects convergence and stability.";

/**
 * Wraps InteractiveTutorChart with Compare Runs pin/clear controls and overlay datasets.
 */
export const CompareRunsChart = ({
  title,
  graphKind,
  params,
  height = 280,
  options,
  compareState,
  onPin,
  onClear,
  activeLabel,
  activeColor = "#e63946",
  activeBackgroundColor,
  activeFill = false,
  chartDataOverride = null,
}) => {
  const { activeRun, pinnedRuns } = compareState || {
    activeRun: null,
    pinnedRuns: [],
  };

  const chartData = useMemo(() => {
    if (chartDataOverride?.datasets?.length) {
      const pinnedDatasets = (pinnedRuns || []).map((run, index) => {
        const color = PINNED_COLORS[index % PINNED_COLORS.length];
        return {
          label: `📌 ${run.label}`,
          data: alignSeriesToLength(run.dataset, chartDataOverride.labels?.length ?? 0),
          borderColor: hexWithAlpha(color, 0.55),
          backgroundColor: "transparent",
          ...PINNED_LINE_STYLE,
        };
      });
      return {
        labels: chartDataOverride.labels,
        datasets: [...pinnedDatasets, ...chartDataOverride.datasets],
      };
    }
    if (!activeRun?.dataset?.length) {
      return { labels: [], datasets: [] };
    }
    return buildComparisonChartData({
      labels: activeRun.labels,
      activeLabel,
      activeData: activeRun.dataset,
      activeColor,
      activeBackgroundColor,
      activeFill,
      pinnedRuns,
    });
  }, [
    chartDataOverride,
    activeRun,
    activeLabel,
    activeColor,
    activeBackgroundColor,
    activeFill,
    pinnedRuns,
  ]);

  const canPin = Boolean(
    chartDataOverride?.datasets?.length || activeRun?.dataset?.length
  );
  const hasPinned = pinnedRuns.length > 0;
  const pinDisabled = !canPin || pinnedRuns.length >= MAX_PINNED_RUNS;

  return (
    <div className={styles.compareBlock}>
      <div className={styles.toolbar}>
        <p className={styles.helperText}>{COMPARE_HELPER}</p>
        <div className={styles.toolbarActions}>
          {hasPinned && (
            <span className={styles.compareBadge}>
              {pinnedRuns.length} pinned
            </span>
          )}
          <button
            type="button"
            className={styles.pinBtn}
            onClick={onPin}
            disabled={pinDisabled}
            title={
              pinDisabled && pinnedRuns.length >= MAX_PINNED_RUNS
                ? `Maximum ${MAX_PINNED_RUNS} pinned runs`
                : "Save current curve for comparison"
            }
          >
            📌 Pin Current Run
          </button>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClear}
            disabled={!hasPinned}
            title="Remove all pinned runs"
          >
            🗑 Clear Comparison
          </button>
        </div>
      </div>

      {hasPinned && (
        <ul className={styles.pinnedList} aria-label="Pinned run parameters">
          {pinnedRuns.map((run) => (
            <li key={run.id} className={styles.pinnedChip}>
              <strong>Pinned:</strong> {run.label}
            </li>
          ))}
        </ul>
      )}

      <InteractiveTutorChart
        title={title}
        graphKind={graphKind}
        params={params}
        height={height}
        chartData={chartData}
        options={options}
      />
    </div>
  );
};
