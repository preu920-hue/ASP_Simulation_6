export const guideSteps = [
  {
    title: "Welcome to ASP Simulation",
    content:
      "Would you like a guided tour of the Autoregressive Stochastic Process & MVDR Beamformer Lab?",
    type: "choice",
    targetId: "guideButton",
  },
  {
    title: "Instructions",
    content: "Review the lab objectives and theoretical background here before starting.",
    highlight: "instructionPanel",
    preferredPlacement: "right",
  },
  {
    title: "1. Signal Setup",
    content: "Select one of the 3 ECG datasets or upload your own CSV/TXT file.",
    highlight: "signalSetup",
    preferredPlacement: "left",
  },
  {
    title: "2. Upload Your Own CSV",
    content:
      "You can upload your own signal CSV/TXT file. Auto-detects time and ECG columns.",
    highlight: "uploadOption",
    preferredPlacement: "left",
  },
  {
    title: "3. Generate ECG Signal",
    content: "Click 'Generate ECG Signal' to load the selected dataset into the simulation.",
    highlight: "generateButton",
    requiredAction: "GENERATE_SIGNAL",
    preferredPlacement: "left",
  },
  {
    title: "4. Add Noise",
    content:
      "Select noise types (Baseline Wander, Powerline 50 Hz, EMG) and click 'Add Noise to Signal'.",
    highlight: "noisePanel",
    requiredAction: "ADD_NOISE",
    preferredPlacement: "left",
  },
  {
    title: "5. Select Algorithm",
    content:
      "Choose LMS-AR Process (ECG prediction) or MVDR Beamformer (ECG denoising).",
    highlight: "algorithmSelector",
    requiredAction: "SELECT_ALGO",
    preferredPlacement: "left",
    isDropdown: true,
  },
  {
    title: "6. Tune Parameters",
    content:
      "Adjust algorithm parameters using the sliders. Each slider has a hint explaining its effect.",
    highlight: "algoSetup",
    preferredPlacement: "left",
  },
  {
    title: "7. Apply Algorithm",
    content:
      "Click 'Apply Algorithm' (after adding noise). Results include a before/after PSD chart showing frequency reduction.",
    highlight: "applyAlgoBtn",
    requiredAction: "RUN_ALGORITHM",
    preferredPlacement: "left",
  },
  {
    title: "8. Output Graphs",
    content:
      "Start with the PSD comparison (red = noisy, green = after algorithm). Then review time-domain ECG, MSE, and beampattern plots.",
    highlight: "psdComparisonSection",
    preferredPlacement: "right",
  },
  {
    title: "Lab Completed",
    content:
      "Excellent! You've explored AR prediction and MVDR beamforming on ECG. Experiment with different parameters and datasets.",
    preferredPlacement: "center",
  },
];
