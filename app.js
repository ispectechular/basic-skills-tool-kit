const TECHNIQUES = [
  {
    id: "box",
    label: "Box Breathing",
    instruction: "Follow the square path: inhale up, hold across, exhale down, hold across.",
    visualType: "box",
    phases: [
      { label: "Inhale", phaseType: "inhale", durationSeconds: 4 },
      { label: "Hold", phaseType: "hold", durationSeconds: 4 },
      { label: "Exhale", phaseType: "exhale", durationSeconds: 4 },
      { label: "Hold", phaseType: "hold", durationSeconds: 4 },
    ],
  },
  {
    id: "slow",
    label: "Slow Breathing",
    instruction: "Breathe in for four, then release slowly for six.",
    visualType: "circle",
    phases: [
      { label: "Inhale", phaseType: "inhale", durationSeconds: 4 },
      { label: "Exhale", phaseType: "exhale", durationSeconds: 6 },
    ],
  },
  {
    id: "four-seven-eight",
    label: "4-7-8 Breathing",
    instruction: "Inhale, hold with stillness, then let the breath go slowly and fully.",
    visualType: "circle",
    phases: [
      { label: "Inhale", phaseType: "inhale", durationSeconds: 4 },
      { label: "Hold", phaseType: "hold", durationSeconds: 7 },
      { label: "Exhale", phaseType: "exhale", durationSeconds: 8 },
    ],
  },
  {
    id: "equal",
    label: "Equal Breathing",
    instruction: "Keep the inhale and exhale matched to a steady, balanced pace.",
    visualType: "circle",
    phases: [
      { label: "Inhale", phaseType: "inhale", durationSeconds: 5 },
      { label: "Exhale", phaseType: "exhale", durationSeconds: 5 },
    ],
  },
  {
    id: "reset",
    label: "Reset Breath",
    instruction: "Take a quick inhale, add a small second inhale, then release into a long exhale.",
    visualType: "reset",
    phases: [
      { label: "Inhale", phaseType: "inhale", durationSeconds: 2 },
      { label: "Small Inhale", phaseType: "inhale", durationSeconds: 1 },
      { label: "Long Exhale", phaseType: "exhale", durationSeconds: 6 },
    ],
  },
];

const TIMER_PRESETS = [60, 90, 120, 180];
const DEFAULT_DURATION = 120;
const MIN_DURATION = 30;
const MAX_DURATION = 900;

const APP_STATE = {
  currentTechnique: TECHNIQUES[0].id,
  sessionDurationSeconds: DEFAULT_DURATION,
  remainingSessionSeconds: DEFAULT_DURATION,
  currentPhaseIndex: 0,
  currentPhaseElapsed: 0,
  sessionElapsedSeconds: 0,
  isRunning: false,
  isPaused: false,
  isComplete: false,
  soundEnabled: true,
  mode: "setup",
  activeMode: false,
  lastInteractionTime: performance.now(),
  customTimerDraft: {
    minutes: 2,
    seconds: 0,
  },
  lastFrameTime: null,
  rafId: null,
  modalOpen: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  audioUnlocked: false,
};

const DOM = {
  body: document.body,
  techniqueGrid: document.getElementById("technique-grid"),
  presetGrid: document.getElementById("preset-grid"),
  techniqueInstruction: document.getElementById("technique-instruction"),
  selectedTechniqueLabel: document.getElementById("selected-technique-label"),
  previewPhaseLabel: document.getElementById("preview-phase-label"),
  previewPhaseSeconds: document.getElementById("preview-phase-seconds"),
  timerDisplayValue: document.getElementById("timer-display-value"),
  soundToggle: document.getElementById("sound-toggle"),
  fullscreenToggle: document.getElementById("fullscreen-toggle"),
  startButton: document.getElementById("start-button"),
  resetButton: document.getElementById("reset-button"),
  customTimerTrigger: document.getElementById("custom-timer-trigger"),
  sessionTimeRemaining: document.getElementById("session-time-remaining"),
  activeStepLabel: document.getElementById("active-step-label"),
  activeStepCount: document.getElementById("active-step-count"),
  progressBar: document.getElementById("progress-bar"),
  activeControls: document.getElementById("active-controls"),
  pauseButton: document.getElementById("pause-button"),
  endButton: document.getElementById("end-button"),
  pausedOverlay: document.getElementById("paused-overlay"),
  resumeButton: document.getElementById("resume-button"),
  pausedResetButton: document.getElementById("paused-reset-button"),
  completeOverlay: document.getElementById("complete-overlay"),
  restartButton: document.getElementById("restart-button"),
  changeSettingsButton: document.getElementById("change-settings-button"),
  timerModal: document.getElementById("timer-modal"),
  customTimerForm: document.getElementById("custom-timer-form"),
  minutesInput: document.getElementById("minutes-input"),
  secondsInput: document.getElementById("seconds-input"),
  timerError: document.getElementById("timer-error"),
  closeModalButton: document.getElementById("close-modal-button"),
  cancelModalButton: document.getElementById("cancel-modal-button"),
  setupCanvas: document.getElementById("breathing-canvas"),
  activeCanvas: document.getElementById("active-canvas"),
};

const CANVAS_CONTEXT = {
  setup: DOM.setupCanvas.getContext("2d"),
  active: DOM.activeCanvas.getContext("2d"),
};

let audioContext;
let previewRafId = null;

function getTechniqueById(id) {
  return TECHNIQUES.find((technique) => technique.id === id) || TECHNIQUES[0];
}

function getCurrentTechnique() {
  return getTechniqueById(APP_STATE.currentTechnique);
}

function getCurrentPhase() {
  const technique = getCurrentTechnique();
  return technique.phases[APP_STATE.currentPhaseIndex] || technique.phases[0];
}

function formatDuration(totalSeconds) {
  const safeTotal = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeTotal / 60);
  const seconds = safeTotal % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function toMinutesSeconds(totalSeconds) {
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setMode(mode) {
  APP_STATE.mode = mode;
  APP_STATE.isRunning = mode === "running";
  APP_STATE.isPaused = mode === "paused";
  APP_STATE.isComplete = mode === "complete";
  APP_STATE.activeMode = mode === "running" || mode === "paused" || mode === "complete";

  DOM.body.classList.remove("setup-mode", "active-mode", "paused-mode", "complete-mode");

  if (mode === "setup") {
    DOM.body.classList.add("setup-mode");
  }

  if (APP_STATE.activeMode) {
    DOM.body.classList.add("active-mode");
  }

  if (mode === "paused") {
    DOM.body.classList.add("paused-mode");
  }

  if (mode === "complete") {
    DOM.body.classList.add("complete-mode");
  }

  DOM.pausedOverlay.setAttribute("aria-hidden", String(mode !== "paused"));
  DOM.completeOverlay.setAttribute("aria-hidden", String(mode !== "complete"));
}

function setTechnique(id) {
  APP_STATE.currentTechnique = id;
  APP_STATE.currentPhaseIndex = 0;
  APP_STATE.currentPhaseElapsed = 0;
  updatePhaseStyling();
  syncPreviewContent();
  render();
}

function setPreset(seconds) {
  APP_STATE.sessionDurationSeconds = seconds;
  APP_STATE.remainingSessionSeconds = seconds;
  APP_STATE.customTimerDraft = toMinutesSeconds(seconds);
  syncTimerDisplay();
  renderPresetButtons();
  render();
}

function setCustomDuration(seconds) {
  const bounded = clamp(seconds, MIN_DURATION, MAX_DURATION);
  APP_STATE.sessionDurationSeconds = bounded;
  APP_STATE.remainingSessionSeconds = bounded;
  APP_STATE.customTimerDraft = toMinutesSeconds(bounded);
  syncTimerDisplay();
  renderPresetButtons();
  render();
}

function resetProgressState() {
  APP_STATE.remainingSessionSeconds = APP_STATE.sessionDurationSeconds;
  APP_STATE.currentPhaseIndex = 0;
  APP_STATE.currentPhaseElapsed = 0;
  APP_STATE.sessionElapsedSeconds = 0;
  APP_STATE.lastFrameTime = null;
  updatePhaseStyling();
}

function startSession() {
  unlockAudio();
  resetProgressState();
  APP_STATE.lastInteractionTime = performance.now();
  DOM.body.classList.remove("controls-hidden");
  setMode("running");
  playStepTone();
  startAnimationLoop();
  render();
}

function pauseSession() {
  if (APP_STATE.mode !== "running") {
    return;
  }

  setMode("paused");
  stopAnimationLoop();
  render();
}

function resumeSession() {
  if (APP_STATE.mode !== "paused") {
    return;
  }

  APP_STATE.lastFrameTime = null;
  APP_STATE.lastInteractionTime = performance.now();
  DOM.body.classList.remove("controls-hidden");
  setMode("running");
  startAnimationLoop();
  render();
}

function resetSession(options = {}) {
  stopAnimationLoop();
  resetProgressState();
  DOM.body.classList.remove("controls-hidden");
  if (options.keepCurrentDuration !== true) {
    APP_STATE.customTimerDraft = toMinutesSeconds(APP_STATE.sessionDurationSeconds);
  }
  setMode("setup");
  render();
}

function completeSession() {
  stopAnimationLoop();
  APP_STATE.remainingSessionSeconds = 0;
  APP_STATE.sessionElapsedSeconds = APP_STATE.sessionDurationSeconds;
  DOM.body.dataset.phase = "complete";
  setMode("complete");
  playCompletionTone();
  render();
}

function startAnimationLoop() {
  stopAnimationLoop();
  APP_STATE.rafId = requestAnimationFrame(tick);
}

function stopAnimationLoop() {
  if (APP_STATE.rafId) {
    cancelAnimationFrame(APP_STATE.rafId);
    APP_STATE.rafId = null;
  }
}

function tick(now) {
  if (APP_STATE.mode !== "running") {
    return;
  }

  if (APP_STATE.lastFrameTime == null) {
    APP_STATE.lastFrameTime = now;
  }

  const deltaSeconds = Math.min((now - APP_STATE.lastFrameTime) / 1000, 0.15);
  APP_STATE.lastFrameTime = now;
  APP_STATE.currentPhaseElapsed += deltaSeconds;
  APP_STATE.sessionElapsedSeconds = clamp(
    APP_STATE.sessionElapsedSeconds + deltaSeconds,
    0,
    APP_STATE.sessionDurationSeconds
  );
  APP_STATE.remainingSessionSeconds = Math.max(
    0,
    APP_STATE.sessionDurationSeconds - APP_STATE.sessionElapsedSeconds
  );

  let phase = getCurrentPhase();

  while (APP_STATE.currentPhaseElapsed >= phase.durationSeconds) {
    APP_STATE.currentPhaseElapsed -= phase.durationSeconds;
    advancePhase();
    phase = getCurrentPhase();
  }

  if (APP_STATE.sessionElapsedSeconds >= APP_STATE.sessionDurationSeconds - 0.001) {
    completeSession();
    return;
  }

  updateControlsVisibility(now);
  render();
  APP_STATE.rafId = requestAnimationFrame(tick);
}

function advancePhase() {
  const technique = getCurrentTechnique();
  APP_STATE.currentPhaseIndex = (APP_STATE.currentPhaseIndex + 1) % technique.phases.length;
  updatePhaseStyling();
  playStepTone();
}

function updatePhaseStyling() {
  if (APP_STATE.mode === "complete") {
    DOM.body.dataset.phase = "complete";
    return;
  }

  DOM.body.dataset.phase = getCurrentPhase().phaseType;
}

function syncPreviewContent() {
  const technique = getCurrentTechnique();
  const phase = technique.phases[0];
  DOM.selectedTechniqueLabel.textContent = technique.label;
  DOM.techniqueInstruction.textContent = technique.instruction;
  DOM.previewPhaseLabel.textContent = phase.label;
  DOM.previewPhaseSeconds.textContent = `${phase.durationSeconds} sec`;
}

function syncTimerDisplay() {
  DOM.timerDisplayValue.textContent = formatDuration(APP_STATE.sessionDurationSeconds);
}

function renderTechniqueButtons() {
  if (!DOM.techniqueGrid.childElementCount) {
    for (const technique of TECHNIQUES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "technique-button";
      button.textContent = technique.label;
      button.dataset.techniqueId = technique.id;
      button.setAttribute("role", "radio");
      button.addEventListener("click", () => {
        registerInteraction();
        setTechnique(technique.id);
      });
      DOM.techniqueGrid.appendChild(button);
    }
  }

  DOM.techniqueGrid.querySelectorAll(".technique-button").forEach((button) => {
    button.setAttribute(
      "aria-checked",
      String(button.dataset.techniqueId === APP_STATE.currentTechnique)
    );
  });
}

function renderPresetButtons() {
  if (!DOM.presetGrid.childElementCount) {
    for (const seconds of TIMER_PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-button";
      button.textContent = formatDuration(seconds);
      button.dataset.seconds = String(seconds);
      button.setAttribute("role", "radio");
      button.addEventListener("click", () => {
        registerInteraction();
        setPreset(seconds);
      });
      DOM.presetGrid.appendChild(button);
    }
  }

  DOM.presetGrid.querySelectorAll(".preset-button").forEach((button) => {
    button.setAttribute("aria-checked", String(Number(button.dataset.seconds) === APP_STATE.sessionDurationSeconds));
  });
}

function renderHUD() {
  const phase = getCurrentPhase();
  const phaseRemaining = Math.max(0, phase.durationSeconds - APP_STATE.currentPhaseElapsed);
  const totalRemaining = Math.max(0, APP_STATE.remainingSessionSeconds);
  const percent = APP_STATE.sessionDurationSeconds
    ? (APP_STATE.sessionElapsedSeconds / APP_STATE.sessionDurationSeconds) * 100
    : 0;

  DOM.activeStepLabel.textContent = APP_STATE.mode === "complete" ? "Complete" : phase.label;
  DOM.activeStepCount.textContent = APP_STATE.mode === "complete" ? "0" : String(Math.ceil(phaseRemaining));
  DOM.sessionTimeRemaining.textContent =
    APP_STATE.mode === "complete"
      ? "Session complete"
      : `${formatDuration(Math.ceil(totalRemaining))} remaining`;
  DOM.progressBar.style.width = `${clamp(percent, 0, 100)}%`;
  DOM.pauseButton.textContent = APP_STATE.mode === "running" ? "Pause" : "Resume";
}

function renderModal() {
  DOM.timerModal.hidden = !APP_STATE.modalOpen;
  DOM.timerError.textContent = "";

  if (APP_STATE.modalOpen) {
    DOM.minutesInput.value = String(APP_STATE.customTimerDraft.minutes);
    DOM.secondsInput.value = String(APP_STATE.customTimerDraft.seconds).padStart(2, "0");
  }
}

function render() {
  renderTechniqueButtons();
  renderPresetButtons();
  syncPreviewContent();
  syncTimerDisplay();
  renderHUD();
  renderModal();
  renderCanvas();
}

function previewLoop() {
  if (APP_STATE.mode === "setup") {
    renderCanvas();
  }

  previewRafId = requestAnimationFrame(previewLoop);
}

function resizeCanvas(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return { width: rect.width, height: rect.height };
}

function getVisualState(mode) {
  const technique = getCurrentTechnique();
  const phase = APP_STATE.mode === "complete" ? { label: "Complete", phaseType: "complete", durationSeconds: 1 } : getCurrentPhase();

  let phaseProgress = 0;
  if (APP_STATE.mode === "running" || APP_STATE.mode === "paused") {
    phaseProgress = clamp(APP_STATE.currentPhaseElapsed / phase.durationSeconds, 0, 1);
  } else {
    const previewDuration = technique.phases[0].durationSeconds;
    const previewSeconds = (performance.now() / 1000) % previewDuration;
    phaseProgress = APP_STATE.reducedMotion ? 0.5 : previewSeconds / previewDuration;
  }

  return {
    technique,
    phase,
    phaseProgress,
    mode,
  };
}

function renderCanvas() {
  renderCanvasInstance(DOM.setupCanvas, CANVAS_CONTEXT.setup, "setup");
  renderCanvasInstance(DOM.activeCanvas, CANVAS_CONTEXT.active, "active");
}

function renderCanvasInstance(canvas, ctx, mode) {
  if (!canvas || !ctx) {
    return;
  }

  const { width, height } = resizeCanvas(canvas, ctx);
  ctx.clearRect(0, 0, width, height);

  const visualState = getVisualState(mode);
  const { technique } = visualState;

  if (technique.visualType === "box") {
    renderBoxBreathing(ctx, width, height, visualState);
    return;
  }

  if (technique.visualType === "reset") {
    renderResetBreath(ctx, width, height, visualState);
    return;
  }

  renderCircleBreathing(ctx, width, height, visualState);
}

function getPhaseColor(phaseType, alpha = 1) {
  const colors = {
    inhale: `rgba(125, 168, 255, ${alpha})`,
    hold: `rgba(172, 149, 221, ${alpha})`,
    exhale: `rgba(116, 204, 186, ${alpha})`,
    complete: `rgba(214, 192, 132, ${alpha})`,
  };
  return colors[phaseType] || colors.inhale;
}

function renderBackdropGlow(ctx, width, height, phaseType) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    width * 0.08,
    width / 2,
    height / 2,
    width * 0.48
  );
  gradient.addColorStop(0, getPhaseColor(phaseType, 0.22));
  gradient.addColorStop(1, "rgba(10, 16, 28, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function renderBoxBreathing(ctx, width, height, visualState) {
  const { phase, phaseProgress } = visualState;
  renderBackdropGlow(ctx, width, height, phase.phaseType);

  const size = Math.min(width, height) * 0.56;
  const centerX = width / 2;
  const centerY = height / 2;
  const left = centerX - size / 2;
  const top = centerY - size / 2;
  const radius = size * 0.08;

  ctx.lineWidth = Math.max(8, size * 0.02);
  ctx.strokeStyle = "rgba(208, 224, 244, 0.16)";
  drawRoundedRect(ctx, left, top, size, size, radius);
  ctx.stroke();

  const pathSegments = [
    { from: [left, top + size], to: [left, top], phaseType: "inhale" },
    { from: [left, top], to: [left + size, top], phaseType: "hold" },
    { from: [left + size, top], to: [left + size, top + size], phaseType: "exhale" },
    { from: [left + size, top + size], to: [left, top + size], phaseType: "hold" },
  ];

  pathSegments.forEach((segment, index) => {
    ctx.lineWidth = Math.max(12, size * 0.028);
    ctx.strokeStyle =
      index === APP_STATE.currentPhaseIndex && APP_STATE.mode !== "setup"
        ? getPhaseColor(segment.phaseType, 0.72)
        : "rgba(208, 224, 244, 0.08)";
    ctx.beginPath();
    ctx.moveTo(segment.from[0], segment.from[1]);
    ctx.lineTo(segment.to[0], segment.to[1]);
    ctx.stroke();
  });

  const currentSegment = pathSegments[APP_STATE.currentPhaseIndex] || pathSegments[0];
  const dotProgress = APP_STATE.reducedMotion ? 0.5 : phaseProgress;
  const dotX = currentSegment.from[0] + (currentSegment.to[0] - currentSegment.from[0]) * dotProgress;
  const dotY = currentSegment.from[1] + (currentSegment.to[1] - currentSegment.from[1]) * dotProgress;
  const dotRadius = Math.max(16, size * 0.042);

  ctx.beginPath();
  ctx.fillStyle = getPhaseColor(phase.phaseType, 0.98);
  ctx.shadowBlur = APP_STATE.reducedMotion ? 0 : 28;
  ctx.shadowColor = getPhaseColor(phase.phaseType, 0.6);
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function renderCircleBreathing(ctx, width, height, visualState) {
  const { phase, phaseProgress, technique } = visualState;
  renderBackdropGlow(ctx, width, height, phase.phaseType);

  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * 0.2;
  const maxRadius = Math.min(width, height) * 0.33;
  const normalized = getBreathingScale(phase.phaseType, phaseProgress, technique.id);
  const radius = baseRadius + (maxRadius - baseRadius) * normalized;

  ctx.beginPath();
  ctx.fillStyle = getPhaseColor(phase.phaseType, 0.16);
  ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
  ctx.fill();

  const gradient = ctx.createRadialGradient(
    centerX - radius * 0.24,
    centerY - radius * 0.24,
    radius * 0.2,
    centerX,
    centerY,
    radius
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.86)");
  gradient.addColorStop(0.12, getPhaseColor(phase.phaseType, 0.88));
  gradient.addColorStop(1, getPhaseColor(phase.phaseType, 0.22));

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.shadowBlur = APP_STATE.reducedMotion ? 0 : 48;
  ctx.shadowColor = getPhaseColor(phase.phaseType, 0.36);
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.lineWidth = Math.max(5, radius * 0.04);
  ctx.strokeStyle = "rgba(246, 250, 255, 0.28)";
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function renderResetBreath(ctx, width, height, visualState) {
  const { phase, phaseProgress } = visualState;
  renderBackdropGlow(ctx, width, height, phase.phaseType);

  const centerX = width / 2;
  const centerY = height / 2;
  const minRadius = Math.min(width, height) * 0.18;
  const maxRadius = Math.min(width, height) * 0.32;
  let normalized = 0.22;

  if (phase.label === "Inhale") {
    normalized = APP_STATE.reducedMotion ? 0.5 : 0.2 + phaseProgress * 0.35;
  } else if (phase.label === "Small Inhale") {
    normalized = APP_STATE.reducedMotion ? 0.62 : 0.56 + phaseProgress * 0.12;
  } else if (phase.label === "Long Exhale") {
    normalized = APP_STATE.reducedMotion ? 0.36 : 0.68 - phaseProgress * 0.48;
  }

  const radius = minRadius + (maxRadius - minRadius) * normalized;

  ctx.beginPath();
  ctx.fillStyle = getPhaseColor(phase.phaseType, 0.12);
  ctx.arc(centerX, centerY, radius * 1.35, 0, Math.PI * 2);
  ctx.fill();

  const gradient = ctx.createRadialGradient(
    centerX - radius * 0.16,
    centerY - radius * 0.22,
    radius * 0.16,
    centerX,
    centerY,
    radius
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  gradient.addColorStop(0.18, getPhaseColor(phase.phaseType, 0.86));
  gradient.addColorStop(1, getPhaseColor(phase.phaseType, 0.2));

  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.shadowBlur = APP_STATE.reducedMotion ? 0 : 42;
  ctx.shadowColor = getPhaseColor(phase.phaseType, 0.4);
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (phase.label === "Small Inhale" || phase.label === "Long Exhale") {
    ctx.beginPath();
    ctx.lineWidth = Math.max(3, radius * 0.038);
    ctx.strokeStyle = "rgba(248, 251, 255, 0.34)";
    ctx.arc(centerX, centerY, radius * 1.1, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function getBreathingScale(phaseType, phaseProgress, techniqueId) {
  const smooth = APP_STATE.reducedMotion ? 0.5 : easeInOutSine(phaseProgress);

  if (phaseType === "inhale") {
    return smooth;
  }

  if (phaseType === "hold") {
    return techniqueId === "four-seven-eight" ? 1 : 0.76;
  }

  if (phaseType === "exhale") {
    return 1 - smooth * 0.84;
  }

  return 0.5;
}

function easeInOutSine(value) {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function initAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    audioContext = new AudioContextClass();
  }
}

function unlockAudio() {
  initAudio();
  if (!audioContext) {
    return;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  APP_STATE.audioUnlocked = true;
}

function playTone({ frequency, duration, type = "sine", gain = 0.05, attack = 0.02, release = 0.18, detune = 0 }) {
  if (!APP_STATE.soundEnabled) {
    return;
  }

  unlockAudio();

  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.detune.value = detune;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(gain, now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + release + 0.02);
}

function playStepTone() {
  playTone({ frequency: 510, duration: 0.1, gain: 0.034, type: "sine", attack: 0.01, release: 0.16 });
  playTone({ frequency: 680, duration: 0.08, gain: 0.016, type: "triangle", attack: 0.01, release: 0.12 });
}

function playCompletionTone() {
  playTone({ frequency: 392, duration: 0.18, gain: 0.03, type: "triangle", attack: 0.02, release: 0.22 });
  setTimeout(() => {
    playTone({ frequency: 523.25, duration: 0.22, gain: 0.038, type: "sine", attack: 0.02, release: 0.26 });
  }, 140);
}

function openTimerModal() {
  if (APP_STATE.activeMode) {
    return;
  }
  APP_STATE.modalOpen = true;
  renderModal();
  requestAnimationFrame(() => DOM.minutesInput.focus());
}

function closeTimerModal() {
  APP_STATE.modalOpen = false;
  renderModal();
  DOM.customTimerTrigger.focus();
}

function validateCustomTime(minutes, seconds) {
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return "Enter minutes and seconds.";
  }

  if (minutes < 0 || seconds < 0 || seconds > 59) {
    return "Use 0 to 15 minutes and 0 to 59 seconds.";
  }

  const total = minutes * 60 + seconds;

  if (total < MIN_DURATION || total > MAX_DURATION) {
    return "Choose a time from 30 seconds to 15 minutes.";
  }

  return "";
}

function handleCustomTimerSubmit(event) {
  event.preventDefault();
  registerInteraction();
  const minutes = Number.parseInt(DOM.minutesInput.value || "0", 10);
  const seconds = Number.parseInt(DOM.secondsInput.value || "0", 10);
  const error = validateCustomTime(minutes, seconds);

  if (error) {
    DOM.timerError.textContent = error;
    return;
  }

  const total = minutes * 60 + seconds;
  setCustomDuration(total);
  APP_STATE.modalOpen = false;
  renderModal();
  DOM.customTimerTrigger.focus();
}

function updateControlsVisibility(now = performance.now()) {
  if (!APP_STATE.activeMode || APP_STATE.mode !== "running") {
    DOM.body.classList.remove("controls-hidden");
    return;
  }

  const inactiveFor = now - APP_STATE.lastInteractionTime;
  DOM.body.classList.toggle("controls-hidden", inactiveFor >= 3000);
}

function registerInteraction() {
  APP_STATE.lastInteractionTime = performance.now();
  if (APP_STATE.activeMode) {
    DOM.body.classList.remove("controls-hidden");
  }
}

function handleKeydown(event) {
  const activeTag = document.activeElement ? document.activeElement.tagName : "";
  const isTypingField = activeTag === "INPUT" || activeTag === "TEXTAREA";

  if (event.key === "Escape") {
    if (APP_STATE.modalOpen) {
      event.preventDefault();
      closeTimerModal();
      return;
    }

    if (APP_STATE.mode === "running") {
      event.preventDefault();
      pauseSession();
      return;
    }

    if (APP_STATE.mode === "paused" || APP_STATE.mode === "complete") {
      event.preventDefault();
      resetSession();
    }
  }

  if (event.code === "Space" && !isTypingField) {
    event.preventDefault();
    registerInteraction();

    if (APP_STATE.mode === "setup") {
      startSession();
      return;
    }

    if (APP_STATE.mode === "running") {
      pauseSession();
      return;
    }

    if (APP_STATE.mode === "paused") {
      resumeSession();
    }
  }
}

async function toggleFullscreen() {
  registerInteraction();
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
  } else if (document.exitFullscreen) {
    await document.exitFullscreen().catch(() => {});
  }
}

function bindEvents() {
  DOM.startButton.addEventListener("click", () => {
    registerInteraction();
    startSession();
  });
  DOM.resetButton.addEventListener("click", () => {
    registerInteraction();
    resetSession();
  });
  DOM.pauseButton.addEventListener("click", () => {
    registerInteraction();
    if (APP_STATE.mode === "running") {
      pauseSession();
    }
  });
  DOM.endButton.addEventListener("click", () => {
    registerInteraction();
    resetSession();
  });
  DOM.resumeButton.addEventListener("click", () => {
    registerInteraction();
    resumeSession();
  });
  DOM.pausedResetButton.addEventListener("click", () => {
    registerInteraction();
    resetSession();
  });
  DOM.restartButton.addEventListener("click", () => {
    registerInteraction();
    startSession();
  });
  DOM.changeSettingsButton.addEventListener("click", () => {
    registerInteraction();
    resetSession({ keepCurrentDuration: true });
  });
  DOM.soundToggle.addEventListener("click", () => {
    registerInteraction();
    APP_STATE.soundEnabled = !APP_STATE.soundEnabled;
    DOM.soundToggle.textContent = APP_STATE.soundEnabled ? "Sound On" : "Sound Off";
    DOM.soundToggle.setAttribute("aria-pressed", String(APP_STATE.soundEnabled));
  });
  DOM.fullscreenToggle.addEventListener("click", toggleFullscreen);
  DOM.customTimerTrigger.addEventListener("click", () => {
    registerInteraction();
    openTimerModal();
  });
  DOM.closeModalButton.addEventListener("click", closeTimerModal);
  DOM.cancelModalButton.addEventListener("click", closeTimerModal);
  DOM.customTimerForm.addEventListener("submit", handleCustomTimerSubmit);
  DOM.timerModal.addEventListener("click", (event) => {
    if (event.target === DOM.timerModal) {
      closeTimerModal();
    }
  });

  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("pointermove", registerInteraction, { passive: true });
  document.addEventListener("pointerdown", registerInteraction, { passive: true });
  document.addEventListener("focusin", registerInteraction);
  window.addEventListener("resize", render);
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
    APP_STATE.reducedMotion = event.matches;
    render();
  });
}

function init() {
  bindEvents();
  setMode("setup");
  updatePhaseStyling();
  render();
  if (!previewRafId) {
    previewRafId = requestAnimationFrame(previewLoop);
  }
}

init();
