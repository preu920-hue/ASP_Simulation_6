import { createContext, useState, useRef, useEffect, useCallback, useMemo } from "react";
import Papa from "papaparse";
import { guideSteps } from "../guideSteps.js";
import { pathForDatasetId } from "../utils/ecgDatasets.js";

const DEFAULT_DATASET_ID = "ecg100";
const DEFAULT_CSV_PATH = pathForDatasetId(DEFAULT_DATASET_ID);

export const SimulationContext = createContext();
export const LOBE_CHANNEL_MAP = {
  Prefrontal: ["Fp1","Fp2"], Frontal: ["F3","F4","F7","F8","Fz"],
  Central: ["C3","C4","Cz"], Temporal: ["T3","T4","T5","T6"],
  Parietal: ["P3","P4","Pz"], Occipital: ["O1","O2"],
  Reference: ["A1","A2"],
  All: ["Fp1","Fp2","F3","Fz","F4","F7","F8","C3","Cz","C4","T3","T4","T5","T6","P3","Pz","P4","O1","O2","A1","A2"],
};

export const SimulationProvider = ({ children }) => {
  const [showInstruction, setShowInstruction] = useState(false);
  const buttonRef = useRef(null);
  const instructionPanelRef = useRef(null);
  const [csvFilePath, setCsvFilePath] = useState(DEFAULT_CSV_PATH);
  const prevPathRef = useRef(DEFAULT_CSV_PATH);
  const [time, setTime] = useState(5);
  const [noise, setNoise] = useState({ baseline: false, powerline: false, emg: false });
  const [generateECG, setGenerateECG] = useState(false);
  const [applyNoiseTrigger, setApplyNoiseTrigger] = useState(false);
  const [filteredECG, setFilteredECG] = useState(false);
  const [algoResults, setAlgoResults] = useState(null);
  const [algorithmType, setAlgorithmType] = useState("AR Process");
  const [noisyECG, setNoisyECG] = useState([]);
  const [config, setConfig] = useState({ order:5, characteristic:"IIR", filterType:"bandpass", windowMode:"windowSync", preGain:false, Fs:500, Fc:10, F1:null, F2:null, Fa:null, Fb:null, Att:100 });
  const [rawSamples, setRawSamples] = useState([]);
  const [originalFs, setOriginalFs] = useState(500);
  const [filteredSamples, setFilteredSamples] = useState([]);
  const [freqResponse, setFreqResponse] = useState(null);
  const [applyFreqTrigger, setApplyFreqTrigger] = useState(false);
  const [colors, setColors] = useState([]);
  const [selectedLobe, setSelectedLobe] = useState("Frontal");
  const [selectedChannels, setSelectedChannels] = useState(["ECG_I"]);
  const [noisySamples, setNoisySamples] = useState([]);

  // Upload state
  const [signalType, setSignalType] = useState("ecg100");
  const [uploadedSignalData, setUploadedSignalData] = useState(null);
  const [uploadedSignalName, setUploadedSignalName] = useState("");

  // Guide state
  const [guideActive, setGuideActive] = useState(false);
  const [step, setStep] = useState(0);
  const [actions, setActions] = useState({});
  const [algorithmMeta, setAlgorithmMeta] = useState(null);

  const steps = guideSteps;

  const currentStep = useMemo(() => steps[step] ?? null, [steps, step]);

  const markAction = useCallback((action) => {
    setActions((prev) => (prev[action] ? prev : { ...prev, [action]: true }));
  }, []);

  const canProceed =
    !guideActive ||
    !currentStep?.requiredAction ||
    Boolean(actions[currentStep.requiredAction]);

  const resetGuide = useCallback(() => {
    setStep(0);
    setActions({});
  }, []);

  const startGuide = useCallback(() => {
    setActions({});
    setStep(0);
    setGuideActive(true);
  }, []);

  const endGuide = useCallback(() => {
    setGuideActive(false);
    setShowInstruction(false);
    setStep(0);
    setActions({});
  }, []);

  // Parse uploaded CSV/TXT
  const parseUploadedText = (text) => {
    try {
      const result = Papa.parse(text, { skipEmptyLines: true });
      const rows = result.data;
      if (!rows.length) return null;
      const headers = rows[0].map(h => String(h).trim());
      const timeIdx = headers.indexOf("time_sec") !== -1 ? headers.indexOf("time_sec") : headers.indexOf("Time") !== -1 ? headers.indexOf("Time") : 0;
      let sigIdx = headers.indexOf("ECG_I");
      if (sigIdx === -1) {
        for (let i = 0; i < headers.length; i++) {
          if (i === timeIdx) continue;
          if (!isNaN(parseFloat(rows[1]?.[i]))) { sigIdx = i; break; }
        }
      }
      if (sigIdx === -1) return null;
      const sigName = headers[sigIdx] || "ECG_I";
      const t0 = parseFloat(rows[1]?.[timeIdx]) || 0;
      const parsed = rows.slice(1).map(row => ({
        x: (parseFloat(row[timeIdx]) || 0) - t0,
        [sigName]: parseFloat(row[sigIdx]) || 0,
        ECG_I: parseFloat(row[sigIdx]) || 0,
      }));
      return parsed;
    } catch { return null; }
  };

  const commitParsedSignal = (parsed) => {
    if (!parsed || !parsed.length) return false;
    setRawSamples(parsed);
    setSelectedChannels(["ECG_I"]);
    const dt = parsed.length > 1 ? parsed[1].x - parsed[0].x : 0.002;
    setOriginalFs(Number(dt > 0 ? 1 / dt : 500).toFixed(2));
    setGenerateECG(false);
    return true;
  };

  // Parse CSV from path and show ECG as soon as data is ready
  useEffect(() => {
    if (signalType === "upload") return;

    let cancelled = false;

    Papa.parse(csvFilePath, {
      download: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (cancelled) return;
        const rows = result.data;
        if (!rows.length) return;
        const headers = (rows[0] || []).map((h) =>
          typeof h === "string" ? h.trim() : h
        );
        const timeIdx =
          headers.indexOf("time_sec") !== -1
            ? headers.indexOf("time_sec")
            : headers.indexOf("Time");
        if (timeIdx === -1) return;
        const colorsName = [
          "#4da6ff", "#ff4d4d", "#66ff66", "#ffcc00", "#cc66ff", "#00cccc",
          "#ff9966", "#9999ff", "#ff6666", "#66ccff", "#99ff99", "#ffd966",
          "#d699ff", "#00ffcc", "#ffb366", "#b3b3ff", "#ff8080", "#80bfff",
          "#80ffbf", "#ff80ff", "#a6a6ff", "#ffcc99", "#66ffcc", "#cccccc",
        ];
        setColors(colorsName);
        const hasECG = headers.includes("ECG_I");
        const channelNames = hasECG ? ["ECG_I"] : [];
        const channelIndices = channelNames.map((ch) => headers.indexOf(ch));
        if (!channelNames.length) {
          for (let i = 0; i < headers.length; i++) {
            if (i === timeIdx) continue;
            const v = parseFloat(rows?.[1]?.[i]);
            if (!Number.isNaN(v)) {
              channelNames.push(String(headers[i]));
              channelIndices.push(i);
              break;
            }
          }
        }
        if (!channelNames.length) return;
        setSelectedChannels(channelNames);
        const t0 = parseFloat(rows?.[1]?.[timeIdx]) || 0;
        const parsed = rows.slice(1).map((row) => {
          const point = { x: (parseFloat(row?.[timeIdx]) || 0) - t0 };
          channelNames.forEach((ch, i) => {
            point[ch] = parseFloat(row?.[channelIndices[i]]) || 0;
          });
          return point;
        });
        setRawSamples(parsed);
        const dt = parsed.length > 1 ? parsed[1].x - parsed[0].x : 0.002;
        setOriginalFs(Number(dt > 0 ? 1 / dt : 500).toFixed(2));
        setGenerateECG(false);
      },
      error: (err) => {
        if (!cancelled) console.error("CSV parse error", err);
      },
    });

    return () => {
      cancelled = true;
    };
  }, [csvFilePath, signalType]);

  return (
    <SimulationContext.Provider value={{
      showInstruction, setShowInstruction, buttonRef, instructionPanelRef,
      generateECG, setGenerateECG,
      noisyECG, setNoisyECG,
      filteredECG, setFilteredECG,
      config, setConfig,
      time, setTime,
      csvFilePath, prevPathRef, setCsvFilePath,
      rawSamples, setRawSamples,
      originalFs,
      noise, setNoise,
      applyNoiseTrigger, setApplyNoiseTrigger,
      freqResponse, setFreqResponse,
      applyFreqTrigger, setApplyFreqTrigger,
      colors, setColors,
      selectedLobe, setSelectedLobe,
      selectedChannels, setSelectedChannels,
      filteredSamples, setFilteredSamples,
      algoResults, setAlgoResults,
      algorithmType, setAlgorithmType,
      noisySamples, setNoisySamples,
      signalType, setSignalType,
      uploadedSignalData, setUploadedSignalData,
      uploadedSignalName, setUploadedSignalName,
      parseUploadedText, commitParsedSignal,
      guideActive, setGuideActive,
      step, setStep,
      steps, currentStep, canProceed,
      markAction, resetGuide, startGuide, endGuide,
      algorithmMeta, setAlgorithmMeta,
      actions,
    }}>
      {children}
    </SimulationContext.Provider>
  );
};
