import { useContext } from "react";
import styles from "./leftPanel.module.css";
import { EcgUnfilter } from "../graph/EcgUnfilter.jsx";
import { EcgNoisy } from "../graph/EcgNoisy.jsx";
import { Exp3aGraph } from "../graph/Exp3aGraph.jsx";
import { SimulationContext } from "../../context/SimulationContext.jsx";

export const LeftPanel = () => {
  const { generateECG, applyNoiseTrigger } = useContext(SimulationContext);

  return (
    <div className={styles.leftPanelContainer}>
      <div className={styles.mainStack}>
        {generateECG && (
          <div className={styles.chartSection}>
            <EcgUnfilter />
          </div>
        )}
        {applyNoiseTrigger && (
          <div className={styles.chartSection}>
            <EcgNoisy />
          </div>
        )}
        <div className={styles.chartSection}>
          <Exp3aGraph />
        </div>
      </div>
    </div>
  );
};
