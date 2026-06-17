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
    content: "Click 'Apply Algorithm' to run the selected algorithm on the real ECG data.",
    highlight: "applyAlgoBtn",
    requiredAction: "RUN_ALGORITHM",
    preferredPlacement: "left",
  },
  {
    title: "8. Compute PSD",
    content:
      "Click 'Compute PSD' to view the Power Spectral Density. AR processes have all-pole PSD S_x = σ²_w / |A(e^jω)|² (theory §3.2.2).",
    highlight: "psdPanel",
    preferredPlacement: "left",
  },
  {
    title: "9. Output Graphs",
    content:
      "Observe MSE learning curve with 95% Monte Carlo CI, AR coefficient convergence, MVDR covariance heatmap, and beampattern.",
    highlight: "algoOutputSection",
    preferredPlacement: "right",
  },
  {
    title: "Lab Completed",
    content:
      "You have explored the unified ASP pipeline: AR modelling → noise → LMS → MVDR → Monte Carlo validation on ECG.",
    preferredPlacement: "center",
  },
];
