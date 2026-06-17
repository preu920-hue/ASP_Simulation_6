import { useState } from "react";
import styles from "./learningPanels.module.css";

const mistakes = [
  { id:1, title:"μ Too Large (LMS-AR)", mistake:"Setting μ above stability bound 1/(P·P_x)", effect:"LMS weights diverge — MSE explodes (§4.4.1)", fix:"Use w[n+1]=w[n]+2μ·e[n]·x[n] with small μ; for ECG try μ ≈ 0.001" },
  { id:2, title:"AR Order Too High", mistake:"Setting P > 10 for short ECG segments", effect:"Overfitting to noise, slow convergence", fix:"Use P = 4–6; select order via AIC/BIC for longer records (§3.4)" },
  { id:3, title:"Too Few Monte Carlo Runs", mistake:"Using N_MC < 20", effect:"Wide 95% CI — unreliable MSE average (§6.4)", fix:"Use 50–100 runs; CI narrows as N_MC increases" },
  { id:4, title:"MVDR: Too Few Snapshots", mistake:"Using K < 2M snapshots", effect:"Poor R̂ estimate — weak null and unstable weights (§5.6)", fix:"Use K ≥ 256 and diagonal loading δ = 0.01–0.1" },
];

const Card = ({ item }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.mistakeCard}>
      <button className={styles.cardHeader} onClick={() => setOpen(o=>!o)}>
        <span>⚠️ {item.title}</span>
        <span className={styles.chevron}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className={styles.cardBody}>
          <div className={styles.mistakeRow}><span className={styles.redBadge}>❌ Mistake</span> {item.mistake}</div>
          <div className={styles.effectRow}><span className={styles.orangeBadge}>💥 Effect</span> {item.effect}</div>
          <div className={styles.fixRow}><span className={styles.greenBadge}>✅ Fix</span> {item.fix}</div>
        </div>
      )}
    </div>
  );
};

export const CommonMistakesPanel = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.panelWrapper}>
      <button className={styles.panelToggle} onClick={() => setOpen(o=>!o)}>
        ⚠️ Common Mistakes &amp; Fixes {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className={styles.panelContent}>
          <p className={styles.panelSubtitle}>Avoid these common parameter mistakes when running LMS-AR and MVDR on ECG data.</p>
          {mistakes.map(m => <Card key={m.id} item={m} />)}
        </div>
      )}
    </div>
  );
};
