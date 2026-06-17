import { useContext } from "react";
import styles from "./topPanel.module.css";
import { SimulationContext } from "../../context/SimulationContext.jsx";

export const TopPanel = () => {
  const {
    showInstruction,
    setShowInstruction,
    buttonRef,
    guideActive,
    startGuide,
    endGuide,
  } = useContext(SimulationContext);

  const toggleInstruction = () => setShowInstruction(!showInstruction);

  const toggleGuide = () => {
    if (!guideActive) {
      startGuide();
    } else {
      endGuide();
    }
  };

  return (
    <div className={styles.Container}>
      <div className={styles.panelContainer}>
        <h1>Autoregressive Stochastic Processes &amp; MVDR Beamformer Lab</h1>
        <div className={styles.buttonContainer}>
          <button ref={buttonRef} className={styles.panelButton} onClick={toggleInstruction}>
            <span className={styles.buttonIcon}>ℹ️</span> Instructions
          </button>
          <button
            id="guideButton"
            className={styles.panelButton}
            onClick={toggleGuide}
            style={{
              backgroundColor: guideActive ? "#2ecc71" : "#e8f4f8",
              color: "#1D7480",
              border: "1px solid #1D7480",
            }}
          >
            <span className={styles.buttonIcon}>🚀</span> Guided Tutor
          </button>
        </div>
      </div>
    </div>
  );
};
