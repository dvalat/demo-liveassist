/**
 * Dalkia LiveAssist V1 - Frontend Client
 * Handles:
 * 1. Native Screen Sharing (getDisplayMedia) streaming video frames to Gemini Live 3.8
 * 2. Real-time PCM 16kHz audio recording with VAD & barge-in interruption
 * 3. PCM 24kHz gapless playback & audio visualization
 * 4. Interactive Industrial Cockpit (Boiler B1, ECH1, SCADA alarms & live telemetry)
 */

// DOM Elements - General
const micBtn = document.getElementById('micBtn');
const micIcon = document.getElementById('micIcon');
const pulseRing = document.getElementById('pulseRing');
const stateLabel = document.getElementById('stateLabel');
const connStatus = document.getElementById('connStatus');
const connPill = document.getElementById('connPill');
const modelBadge = document.getElementById('modelBadge');
const feedContainer = document.getElementById('feedContainer');
const emptyState = document.getElementById('emptyState');
const textForm = document.getElementById('textForm');
const textInput = document.getElementById('textInput');
const clearBtn = document.getElementById('clearBtn');
const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');

// DOM Elements - Native Screen Sharing
const screenShareBtn = document.getElementById('screenShareBtn');
const screenShareIcon = document.getElementById('screenShareIcon');
const screenShareLabel = document.getElementById('screenShareLabel');
const screenShareCard = document.getElementById('screenShareCard');
const screenStatusIcon = document.getElementById('screenStatusIcon');
const screenStatusTitle = document.getElementById('screenStatusTitle');
const screenStatusDesc = document.getElementById('screenStatusDesc');
const screenLiveBadge = document.getElementById('screenLiveBadge');

// DOM Elements - Industrial Cockpit (Boiler B1 & Alarms)
const boilerCard = document.getElementById('boilerCard');
const boilerTempDigits = document.getElementById('boilerTempDigits');
const tempScaleFill = document.getElementById('tempScaleFill');
const boilerPressure = document.getElementById('boilerPressure');
const boilerAirFlow = document.getElementById('boilerAirFlow');
const boilerRegStatus = document.getElementById('boilerRegStatus');
const alarmsBanner = document.getElementById('alarmsBanner');
const alarmIcon = document.getElementById('alarmIcon');
const alarmTitle = document.getElementById('alarmTitle');
const alarmDesc = document.getElementById('alarmDesc');
const alarmBadge = document.getElementById('alarmBadge');
const btnSimNominal = document.getElementById('btnSimNominal');
const btnSimWarning = document.getElementById('btnSimWarning');
const btnSimDanger = document.getElementById('btnSimDanger');
const tempSlider = document.getElementById('tempSlider');
const sliderValueText = document.getElementById('sliderValueText');

// DOM Elements - Telemetry Grid & Setpoints
const exchangerCard = document.getElementById('exchangerCard');
const telemetryPrimarySupply = document.getElementById('telemetryPrimarySupply');
const telemetryPrimarySetpoint = document.getElementById('telemetryPrimarySetpoint');
const telemetryPrimaryReturn = document.getElementById('telemetryPrimaryReturn');
const telemetryPrimaryFlow = document.getElementById('telemetryPrimaryFlow');
const telemetrySecondarySupply = document.getElementById('telemetrySecondarySupply');
const telemetrySecondarySetpoint = document.getElementById('telemetrySecondarySetpoint');
const telemetrySecondaryReturn = document.getElementById('telemetrySecondaryReturn');
const telemetrySecondaryPressure = document.getElementById('telemetrySecondaryPressure');

// State Variables
let ws = null;
let isLiveActive = false;
let audioRecordContext = null;
let audioPlayContext = null;
let mediaStream = null;
let scriptProcessor = null;
let nextPlayTime = 0;
let activeAudioSources = [];
let currentUserBubble = null;
let currentAssistantBubble = null;

// Screen Sharing State
let isScreenSharing = false;
let screenStream = null;
let screenVideoElem = null;
let screenCaptureInterval = null;
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// Visualizer State
let inputVolume = 0;
let outputVolume = 0;
let animPhase = 0;

function ensureAudioPlayContext() {
  if (!audioPlayContext) {
    audioPlayContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  }
  if (audioPlayContext.state === 'suspended') {
    audioPlayContext.resume();
  }
}

// Initialize Visualizer Loop
function renderVisualizer() {
  requestAnimationFrame(renderVisualizer);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;

  let currentVol = Math.max(inputVolume, outputVolume);
  if (!isLiveActive && currentVol < 0.05) currentVol = 0.05;

  ctx.lineWidth = 2.5;
  const waveCount = 3;
  animPhase += 0.05 + currentVol * 0.15;

  for (let w = 0; w < waveCount; w++) {
    ctx.beginPath();
    const alpha = (0.2 + (w / waveCount) * 0.6) * (isLiveActive ? 1 : 0.35);
    const color = outputVolume > 0.05 ? `rgba(2, 132, 199, ${alpha})` : `rgba(255, 74, 0, ${alpha})`;
    ctx.strokeStyle = color;

    for (let x = 0; x < width; x += 4) {
      const progress = x / width;
      const envelope = Math.sin(progress * Math.PI);
      const freq = 0.02 + w * 0.01;
      const amp = (8 + currentVol * 45) * envelope;
      const y = centerY + Math.sin(x * freq + animPhase + w * 1.5) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  inputVolume *= 0.85;
  outputVolume *= 0.85;
}
renderVisualizer();

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/live`;

  connStatus.textContent = 'Connexion...';
  connPill.className = 'status-pill';

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to Dalkia LiveAssist Server');
    connStatus.textContent = 'Prêt';
    connPill.className = 'status-pill connected';
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (e) {
      console.error('Error parsing server message:', e);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket closed');
    connStatus.textContent = 'Déconnecté';
    connPill.className = 'status-pill';
    if (isLiveActive) stopLiveSession();
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    connStatus.textContent = 'Erreur';
    connPill.className = 'status-pill';
  };
}

// Handle Incoming Server Messages
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'ready':
      stateLabel.textContent = 'Session active. Parlez ou posez vos questions sur l\'écran partagé...';
      if (msg.model && modelBadge) {
        const badgeSpan = modelBadge.querySelector('span:last-child');
        if (badgeSpan) badgeSpan.textContent = msg.model;
      }
      break;

    case 'audio':
      ensureAudioPlayContext();
      playAudioChunk(msg.data);
      updateAgentSpeakingState(true);
      break;

    case 'transcript':
      handleTranscript(msg.role, msg.text, msg.finished);
      break;

    case 'tool_call':
      appendToolCallEvent(msg.name, msg.args);
      break;

    case 'tool_result':
      updateToolResultEvent(msg.name, msg.result);
      break;

    case 'telemetry_updated':
      console.log('SCADA Telemetry updated from tool execution:', msg.data);
      handleTelemetryUpdated(msg.data);
      break;

    case 'gmao_updated':
      console.log('GMAO intervention event received:', msg.ticket);
      handleGmaoTicketCreated(msg.ticket);
      break;

    case 'gmao_deleted':
      console.log('GMAO intervention deleted event received:', msg.ticket_id);
      handleGmaoTicketDeleted(msg.ticket_id);
      break;

    case 'interrupted':
      handleInterruption();
      break;

    case 'turn_complete':
      updateAgentSpeakingState(false);
      currentUserBubble = null;
      currentAssistantBubble = null;
      break;

    case 'error':
      console.error('Server error:', msg.message);
      stateLabel.textContent = `Erreur : ${msg.message}`;
      break;
  }
}

// Audio Recording (Microphone -> 16kHz PCM)
async function startAudioRecording() {
  audioRecordContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }
  });

  const source = audioRecordContext.createMediaStreamSource(mediaStream);
  scriptProcessor = audioRecordContext.createScriptProcessor(2048, 1, 1);

  scriptProcessor.onaudioprocess = (e) => {
    if (!isLiveActive || !ws || ws.readyState !== WebSocket.OPEN) return;

    const inputData = e.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);
    inputVolume = Math.min(1, rms * 4);

    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const bytes = new Uint8Array(pcm16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);

    ws.send(JSON.stringify({ type: 'audio', data: b64 }));
  };

  source.connect(scriptProcessor);
  scriptProcessor.connect(audioRecordContext.destination);
}

// Audio Playback (24kHz PCM Gapless Scheduling)
function playAudioChunk(b64Data) {
  ensureAudioPlayContext();

  const binaryString = atob(b64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);

  const float32 = new Float32Array(int16Array.length);
  let sum = 0;
  for (let i = 0; i < int16Array.length; i++) {
    const s = int16Array[i] / 32768.0;
    float32[i] = s;
    sum += s * s;
  }
  outputVolume = Math.min(1, Math.sqrt(sum / float32.length) * 4);

  const audioBuffer = audioPlayContext.createBuffer(1, float32.length, 24000);
  audioBuffer.getChannelData(0).set(float32);

  const source = audioPlayContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioPlayContext.destination);

  const currentTime = audioPlayContext.currentTime;
  const startTime = Math.max(currentTime, nextPlayTime);
  source.start(startTime);
  nextPlayTime = startTime + audioBuffer.duration;

  activeAudioSources.push(source);
  source.onended = () => {
    const idx = activeAudioSources.indexOf(source);
    if (idx !== -1) activeAudioSources.splice(idx, 1);
    if (activeAudioSources.length === 0) {
      updateAgentSpeakingState(false);
    }
  };
}

// Interruption Handler (Barge-in)
function handleInterruption() {
  console.log('Interruption detected: stopping audio playback');
  activeAudioSources.forEach(src => {
    try { src.stop(); } catch (e) {}
  });
  activeAudioSources = [];
  if (audioPlayContext) {
    nextPlayTime = audioPlayContext.currentTime;
  }
  updateAgentSpeakingState(false);
  stateLabel.textContent = 'Vous parlez... L\'agent écoute.';
}

// Live Voice Session Toggle
async function toggleLiveSession() {
  ensureAudioPlayContext();
  if (isLiveActive) {
    stopLiveSession();
  } else {
    await startLiveSession();
  }
}

async function startLiveSession() {
  try {
    stateLabel.textContent = 'Activation du microphone...';
    await startAudioRecording();
    isLiveActive = true;
    micBtn.className = 'mic-button active';
    pulseRing.className = 'pulse-ring pulsing';
    stateLabel.textContent = 'Micro ouvert. Parlez librement avec Dalkia LiveAssist...';
  } catch (err) {
    console.error('Failed to open microphone:', err);
    stateLabel.textContent = 'Erreur : Impossible d\'accéder au microphone.';
  }
}

function stopLiveSession() {
  isLiveActive = false;
  micBtn.className = 'mic-button';
  pulseRing.className = 'pulse-ring';
  stateLabel.textContent = 'Micro désactivé. Cliquez pour réactiver la voix.';

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (audioRecordContext) {
    audioRecordContext.close();
    audioRecordContext = null;
  }

  activeAudioSources.forEach(src => {
    try { src.stop(); } catch (e) {}
  });
  activeAudioSources = [];

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'stop' }));
  }
}

function updateAgentSpeakingState(isSpeaking) {
  if (isSpeaking) {
    micBtn.className = 'mic-button speaking';
    stateLabel.textContent = 'Dalkia LiveAssist vous répond à la voix...';
  } else if (isLiveActive) {
    micBtn.className = 'mic-button active';
    stateLabel.textContent = 'Microphone ouvert. L\'agent vous écoute...';
  } else {
    micBtn.className = 'mic-button';
    stateLabel.textContent = 'Cliquez sur le micro pour échanger en direct';
  }
}

// ==============================================================================
// Native Screen Sharing Feature (getDisplayMedia -> Video Stream to Gemini Live)
// ==============================================================================

async function toggleScreenShare() {
  if (isScreenSharing) {
    stopScreenShare();
  } else {
    await startScreenShare();
  }
}

async function startScreenShare() {
  try {
    // Make sure WebSocket is connected
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }

    // Call native getDisplayMedia
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        frameRate: { max: 5 }
      },
      audio: false
    });

    const videoTrack = screenStream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error("Aucune piste vidéo dans le flux d'écran.");
    }

    // Handle user stopping screen share via browser floating controls
    videoTrack.onended = () => {
      console.log('Screen sharing stopped by user in browser controls');
      stopScreenShare();
    };

    // Attach stream to hidden video element
    if (!screenVideoElem) {
      screenVideoElem = document.createElement('video');
      screenVideoElem.autoplay = true;
      screenVideoElem.muted = true;
      screenVideoElem.playsInline = true;
    }
    screenVideoElem.srcObject = screenStream;
    await screenVideoElem.play();

    isScreenSharing = true;

    // Update UI Elements
    screenShareBtn.classList.add('active');
    screenShareIcon.textContent = 'stop_screen_share';
    screenShareLabel.textContent = 'Arrêter le partage';

    screenShareCard.classList.add('active');
    screenStatusIcon.textContent = 'visibility';
    screenStatusTitle.textContent = 'Écran partagé avec Gemini Live 3.8';
    screenStatusDesc.textContent = 'Gemini voit le synoptique, la chaudière B1 et les alarmes en direct.';
    screenLiveBadge.classList.remove('hidden');

    stateLabel.textContent = 'Écran partagé. Gemini Live 3.8 observe la supervision en direct.';

    // Send first frame immediately
    captureAndSendVideoFrame();

    // Setup periodic frame extraction (1 frame per second = 1 FPS)
    screenCaptureInterval = setInterval(captureAndSendVideoFrame, 1000);

  } catch (err) {
    console.warn('Screen share cancelled or failed:', err);
    stopScreenShare();
  }
}

function captureAndSendVideoFrame() {
  if (!isScreenSharing || !screenVideoElem || screenVideoElem.readyState < 2) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  try {
    const origWidth = screenVideoElem.videoWidth || 1280;
    const origHeight = screenVideoElem.videoHeight || 720;

    // Target max dimension ~1280px for high-definition readability of temperatures/labels
    const scale = Math.min(1, 1280 / origWidth);
    const targetW = Math.round(origWidth * scale);
    const targetH = Math.round(origHeight * scale);

    offscreenCanvas.width = targetW;
    offscreenCanvas.height = targetH;
    offscreenCtx.drawImage(screenVideoElem, 0, 0, targetW, targetH);

    // Convert to lightweight JPEG (quality 0.75 is optimal for text and diagrams)
    const frameDataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.75);

    ws.send(JSON.stringify({
      type: 'video_frame',
      data: frameDataUrl
    }));
  } catch (err) {
    console.error('Error capturing video frame:', err);
  }
}

function stopScreenShare() {
  isScreenSharing = false;

  if (screenCaptureInterval) {
    clearInterval(screenCaptureInterval);
    screenCaptureInterval = null;
  }

  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }

  if (screenVideoElem) {
    screenVideoElem.srcObject = null;
  }

  // Restore UI Elements
  screenShareBtn.classList.remove('active');
  screenShareIcon.textContent = 'screen_share';
  screenShareLabel.textContent = "Partager l'écran";

  screenShareCard.classList.remove('active');
  screenStatusIcon.textContent = 'visibility_off';
  screenStatusTitle.textContent = 'Vision Gemini Live inactive';
  screenStatusDesc.textContent = "Cliquez sur « Partager l'écran » pour que Gemini voit la chaudière et les alarmes en direct.";
  screenLiveBadge.classList.add('hidden');
}

// ==============================================================================
// Industrial Cockpit Simulation & Telemetry Logic
// ==============================================================================

/**
 * Met à jour dynamiquement toutes les valeurs de l'échangeur ECH1 et du réseau DESC
 * couplées à la température du foyer de la chaudière ou aux consignes reçues.
 * @param {number} boilerTemp Température foyer en °C
 * @param {Object} [overrideData] Données télémétriques précises si fournies par le backend
 */
function updateExchangerTelemetry(boilerTemp, overrideData = {}) {
  const temp = Math.round(boilerTemp);
  const deltaT = temp - 870;

  // Calculs couplés thermodynamiques si non surchargés par le backend
  const primSupply = overrideData.primary_supply_temp !== undefined 
    ? Number(overrideData.primary_supply_temp) 
    : Math.round((84.6 + (deltaT * 0.08)) * 10) / 10;

  const primSetpoint = overrideData.primary_setpoint_temp !== undefined 
    ? Number(overrideData.primary_setpoint_temp) 
    : (overrideData.circuit === 'primary' && overrideData.new_setpoint_celsius !== undefined
        ? Number(overrideData.new_setpoint_celsius)
        : Math.round((85.0 + (deltaT * 0.075)) * 10) / 10);

  const primReturn = overrideData.primary_return_temp !== undefined 
    ? Number(overrideData.primary_return_temp) 
    : Math.round((66.8 + (deltaT * 0.055)) * 10) / 10;

  const primFlow = overrideData.primary_flow !== undefined 
    ? Math.round(overrideData.primary_flow) 
    : Math.round(495 + (deltaT * 0.25));

  const secSupply = overrideData.secondary_supply_temp !== undefined 
    ? Number(overrideData.secondary_supply_temp) 
    : Math.round((77.2 + (deltaT * 0.065)) * 10) / 10;

  const secSetpoint = overrideData.secondary_setpoint_temp !== undefined 
    ? Number(overrideData.secondary_setpoint_temp) 
    : (overrideData.circuit === 'secondary' && overrideData.new_setpoint_celsius !== undefined
        ? Number(overrideData.new_setpoint_celsius)
        : Math.round((78.0 + (deltaT * 0.06)) * 10) / 10);

  const secReturn = overrideData.secondary_return_temp !== undefined 
    ? Number(overrideData.secondary_return_temp) 
    : Math.round((54.1 + (deltaT * 0.04)) * 10) / 10;

  const secPressure = overrideData.secondary_pressure !== undefined 
    ? Number(overrideData.secondary_pressure).toFixed(1) 
    : (3.9 + (deltaT * 0.0025)).toFixed(1);

  // Mise à jour du DOM
  if (telemetryPrimarySupply) telemetryPrimarySupply.textContent = `${primSupply.toFixed(1)} °C`;
  if (telemetryPrimarySetpoint) telemetryPrimarySetpoint.textContent = `Consigne : ${primSetpoint.toFixed(1)} °C`;
  if (telemetryPrimaryReturn) telemetryPrimaryReturn.textContent = `${primReturn.toFixed(1)} °C`;
  if (telemetryPrimaryFlow) telemetryPrimaryFlow.textContent = `Débit : ${primFlow} m³/h`;

  if (telemetrySecondarySupply) telemetrySecondarySupply.textContent = `${secSupply.toFixed(1)} °C`;
  if (telemetrySecondarySetpoint) telemetrySecondarySetpoint.textContent = `Consigne : ${secSetpoint.toFixed(1)} °C`;
  if (telemetrySecondaryReturn) telemetrySecondaryReturn.textContent = `${secReturn.toFixed(1)} °C`;
  if (telemetrySecondaryPressure) telemetrySecondaryPressure.textContent = `Pression : ${secPressure} bar`;

  // Animations visuelles sur les valeurs de l'échangeur
  [telemetryPrimarySupply, telemetryPrimarySetpoint, telemetryPrimaryReturn, telemetryPrimaryFlow,
   telemetrySecondarySupply, telemetrySecondarySetpoint, telemetrySecondaryReturn, telemetrySecondaryPressure].forEach(el => {
    if (el) {
      el.classList.remove('flash-updated-text');
      void el.offsetWidth;
      el.classList.add('flash-updated-text');
      setTimeout(() => el.classList.remove('flash-updated-text'), 1500);
    }
  });

  // Animation visuelle sur la carte échangeur
  if (exchangerCard) {
    exchangerCard.classList.remove('flash-updated');
    void exchangerCard.offsetWidth;
    exchangerCard.classList.add('flash-updated');
    setTimeout(() => exchangerCard.classList.remove('flash-updated'), 1500);
  }
}

function setBoilerSimulation(temperature, overrideData = {}) {
  const temp = Math.round(temperature);

  // Update slider & input
  if (tempSlider) tempSlider.value = temp;
  if (sliderValueText) sliderValueText.textContent = `${temp}°C`;

  // Update temperature digits
  if (boilerTempDigits) boilerTempDigits.textContent = temp;

  // Update scale fill percentage (scale: 700°C to 1020°C)
  const pct = Math.max(0, Math.min(100, ((temp - 700) / (1020 - 700)) * 100));
  if (tempScaleFill) tempScaleFill.style.width = `${pct}%`;

  // Update button active states
  if (btnSimNominal) btnSimNominal.classList.toggle('active', temp <= 880);
  if (btnSimWarning) btnSimWarning.classList.toggle('active', temp > 880 && temp < 950);
  if (btnSimDanger) btnSimDanger.classList.toggle('active', temp >= 950);

  // Critical Overheat State (>= 950°C : Seuil d'arrêt d'urgence)
  if (temp >= 950) {
    boilerCard.classList.add('surchauffe');
    alarmsBanner.className = 'alarm-banner danger';
    alarmIcon.textContent = 'warning';
    alarmTitle.textContent = `🚨 ALM-B1-SURCHAUFFE : Température foyer Chaudière B1 à ${temp}°C (Seuil critique 950°C atteint)`;
    alarmDesc.textContent = "Arrêt d'urgence préconisé selon MAN-DK-BIO-001. Risque d'avarie réfractaires et tubes.";
    alarmBadge.textContent = 'SURCHAUFFE CRITIQUE';

    boilerRegStatus.textContent = 'ALERTE SÉCURITÉ';
    boilerRegStatus.className = 'm-value text-danger';
    boilerPressure.textContent = '-24 mbar';
    boilerAirFlow.textContent = '18 900 Nm³/h';
  } 
  // High Temperature Warning (900°C - 949°C)
  else if (temp >= 900) {
    boilerCard.classList.remove('surchauffe');
    alarmsBanner.className = 'alarm-banner';
    alarmsBanner.style.background = '#FFFBEB';
    alarmsBanner.style.borderColor = '#FDE68A';
    alarmsBanner.style.color = '#92400E';
    alarmIcon.textContent = 'warning';
    alarmTitle.textContent = `⚠️ AVERTISSEMENT : Température foyer B1 à ${temp}°C proche du seuil critique (950°C)`;
    alarmDesc.textContent = "Surveiller l'alimentation en combustible bois et le tirage d'air primaire.";
    alarmBadge.textContent = 'ALERTE SEUIL';

    boilerRegStatus.textContent = 'MODULATION RÉDUITE';
    boilerRegStatus.className = 'm-value text-orange';
    boilerPressure.textContent = '-16 mbar';
    boilerAirFlow.textContent = '16 000 Nm³/h';
  } 
  // Nominal Operating Mode (< 900°C)
  else {
    boilerCard.classList.remove('surchauffe');
    alarmsBanner.style = '';
    alarmsBanner.className = 'alarm-banner nominal';
    alarmIcon.textContent = 'verified';
    alarmTitle.textContent = 'Régulation nominale du réseau DESC';
    alarmDesc.textContent = `Aucune alarme active. Température foyer B1 sous contrôle (${temp}°C).`;
    alarmBadge.textContent = 'NOMINAL';

    boilerRegStatus.textContent = 'AUTO NOMINAL';
    boilerRegStatus.className = 'm-value text-emerald';
    boilerPressure.textContent = '-12 mbar';
    boilerAirFlow.textContent = '14 200 Nm³/h';
  }

  // Update coupled exchanger and DESC network values
  updateExchangerTelemetry(temp, overrideData);

  // If screen sharing is active, trigger an immediate frame capture so Gemini sees the change instantly
  if (isScreenSharing) {
    captureAndSendVideoFrame();
  }
}

/**
 * Met à jour dynamiquement le cockpit et la télémétrie suite à une consigne vocale exécutée par Gemini.
 * @param {Object} data Données télémétriques renvoyées par les outils SCADA
 */
function handleTelemetryUpdated(data) {
  if (!data) return;

  // 1. Mise à jour dynamique de la chaudière biomasse B1
  if (data.boiler_temp !== undefined) {
    const temp = parseFloat(data.boiler_temp);
    setBoilerSimulation(temp, data);

    // Animation flash sur la carte chaudière
    if (boilerCard) {
      boilerCard.classList.remove('flash-updated');
      void boilerCard.offsetWidth; // Force CSS reflow
      boilerCard.classList.add('flash-updated');
      setTimeout(() => boilerCard.classList.remove('flash-updated'), 1500);
    }
  } else {
    // Si c'est un changement direct de consigne (primaire ou secondaire)
    const currentTemp = tempSlider ? parseFloat(tempSlider.value) : 870;
    updateExchangerTelemetry(currentTemp, data);
  }

  // 2. Partage d'écran actif : transmettre immédiatement une nouvelle frame vidéo
  if (isScreenSharing) {
    setTimeout(captureAndSendVideoFrame, 200);
  }
}

// Bind Simulation Buttons & Slider
if (btnSimNominal) btnSimNominal.addEventListener('click', () => setBoilerSimulation(870));
if (btnSimWarning) btnSimWarning.addEventListener('click', () => setBoilerSimulation(920));
if (btnSimDanger) btnSimDanger.addEventListener('click', () => setBoilerSimulation(965));
if (tempSlider) {
  tempSlider.addEventListener('input', (e) => {
    setBoilerSimulation(parseFloat(e.target.value));
  });
}

// ==============================================================================
// Transcript & Message Display
// ==============================================================================

function hideEmptyState() {
  if (emptyState) emptyState.style.display = 'none';
}

function handleTranscript(role, text, finished) {
  hideEmptyState();

  if (role === 'user') {
    if (!currentUserBubble) {
      currentUserBubble = document.createElement('div');
      currentUserBubble.className = 'chat-bubble user';
      currentUserBubble.innerHTML = `
        <span class="bubble-role">Technicien</span>
        <div class="bubble-text"></div>
      `;
      feedContainer.appendChild(currentUserBubble);
    }
    const content = currentUserBubble.querySelector('.bubble-text');
    content.textContent += (content.textContent ? ' ' : '') + text;
    if (finished) currentUserBubble = null;
  } else if (role === 'assistant') {
    if (!currentAssistantBubble) {
      currentAssistantBubble = document.createElement('div');
      currentAssistantBubble.className = 'chat-bubble assistant';
      currentAssistantBubble.innerHTML = `
        <span class="bubble-role">Dalkia LiveAssist (Gemini Live 3.8)</span>
        <div class="bubble-text"></div>
      `;
      feedContainer.appendChild(currentAssistantBubble);
    }
    const content = currentAssistantBubble.querySelector('.bubble-text');
    content.textContent += text;
    if (finished) currentAssistantBubble = null;
  }

  feedContainer.scrollTop = feedContainer.scrollHeight;
}

// Tool Calls Display (RAG & SCADA)
function appendToolCallEvent(name, args) {
  hideEmptyState();
  const card = document.createElement('div');
  card.className = 'tool-event-card';
  card.id = `tool-${name}-${Date.now()}`;

  let label = 'Action';
  let icon = 'build';
  if (name === 'search_dalkia_knowledge_base') {
    label = 'RAG : Recherche manuels Dalkia';
    icon = 'menu_book';
  } else if (name.includes('telemetry') || name.includes('alarms')) {
    label = 'SCADA : Télémétrie en direct';
    icon = 'sensors';
  } else if (name.includes('setpoint') || name.includes('override')) {
    label = 'SCADA : Pilotage consigne';
    icon = 'tune';
  } else if (name.includes('gmao')) {
    label = 'GMAO : Enregistrement intervention';
    icon = 'assignment';
  }

  card.innerHTML = `
    <div class="tool-event-header">
      <span class="material-symbols-outlined">${icon}</span>
      <span>${label}</span>
    </div>
    <div class="tool-event-body">Paramètre : "${args.query || JSON.stringify(args)}"</div>
  `;

  feedContainer.appendChild(card);
  feedContainer.scrollTop = feedContainer.scrollHeight;
}

function updateToolResultEvent(name, result) {
  const cards = feedContainer.querySelectorAll('.tool-event-card');
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1];
    const body = lastCard.querySelector('.tool-event-body');
    if (body) {
      body.innerHTML += `<br><strong>Données extraites :</strong> ${result}`;
    }
  }
  feedContainer.scrollTop = feedContainer.scrollHeight;
}

// Send Text Prompt
function sendTextPrompt(text) {
  if (!text || !text.trim()) return;
  hideEmptyState();
  ensureAudioPlayContext();

  currentUserBubble = null;
  currentAssistantBubble = null;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble user';
  bubble.innerHTML = `
    <span class="bubble-role">Technicien</span>
    <div class="bubble-text">${text}</div>
  `;
  feedContainer.appendChild(bubble);
  feedContainer.scrollTop = feedContainer.scrollHeight;

  if (ws && ws.readyState === WebSocket.OPEN) {
    // If screen sharing is on, send a fresh frame alongside the text prompt
    if (isScreenSharing) {
      captureAndSendVideoFrame();
    }
    ws.send(JSON.stringify({ type: 'text', text: text }));
    stateLabel.textContent = 'Envoi de la requête...';
  }
}

// Bind Event Listeners
micBtn.addEventListener('click', toggleLiveSession);
screenShareBtn.addEventListener('click', toggleScreenShare);

textForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = textInput.value;
  textInput.value = '';
  sendTextPrompt(text);
});

clearBtn.addEventListener('click', () => {
  feedContainer.innerHTML = `
    <div class="empty-state" id="emptyState">
      <span class="material-symbols-outlined">record_voice_over</span>
      <p>La conversation vocale, les analyses visuelles et les recherches documentaires RAG apparaîtront ici en direct.</p>
    </div>
  `;
});

// Clickable Quick Test Chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    ensureAudioPlayContext();
    const prompt = chip.getAttribute('data-prompt');
    if (prompt) {
      sendTextPrompt(prompt);
    }
  });
});

// ==============================================================================
// VERSION V2: NAVIGATION PAR ONGLETS & MODULE GMAO BIGQUERY
// ==============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Tabs DOM Elements
const tabSupervisionBtn = document.getElementById('tabSupervisionBtn');
const tabGmaoBtn = document.getElementById('tabGmaoBtn');
const supervisionTabContent = document.getElementById('supervisionTabContent');
const gmaoTabContent = document.getElementById('gmaoTabContent');
const gmaoBadgeCount = document.getElementById('gmaoBadgeCount');

// GMAO Dashboard DOM Elements
const kpiTotalTickets = document.getElementById('kpiTotalTickets');
const kpiCriticalTickets = document.getElementById('kpiCriticalTickets');
const kpiPreventiveTickets = document.getElementById('kpiPreventiveTickets');
const kpiEquipmentsCount = document.getElementById('kpiEquipmentsCount');
const gmaoSearchInput = document.getElementById('gmaoSearchInput');
const gmaoFilterEquip = document.getElementById('gmaoFilterEquip');
const gmaoFilterSeverity = document.getElementById('gmaoFilterSeverity');
const gmaoTicketsGrid = document.getElementById('gmaoTicketsGrid');
const btnRefreshGmao = document.getElementById('btnRefreshGmao');

// Modal Form DOM Elements
const btnOpenModal = document.getElementById('btnOpenModal');
const ticketModal = document.getElementById('ticketModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const manualTicketForm = document.getElementById('manualTicketForm');
const formEquipment = document.getElementById('formEquipment');
const formSeverity = document.getElementById('formSeverity');
const formTitle = document.getElementById('formTitle');
const formDescription = document.getElementById('formDescription');

let gmaoTicketsList = [];

// Tab Navigation
function switchTab(tabId) {
  if (tabId === 'supervision') {
    tabSupervisionBtn.classList.add('active');
    tabGmaoBtn.classList.remove('active');
    supervisionTabContent.classList.add('active');
    gmaoTabContent.classList.remove('active');
  } else if (tabId === 'gmao') {
    tabGmaoBtn.classList.add('active');
    tabSupervisionBtn.classList.remove('active');
    gmaoTabContent.classList.add('active');
    supervisionTabContent.classList.remove('active');
  }
}

if (tabSupervisionBtn && tabGmaoBtn) {
  tabSupervisionBtn.addEventListener('click', () => switchTab('supervision'));
  tabGmaoBtn.addEventListener('click', () => switchTab('gmao'));
}

// Render GMAO Tickets Grid
function renderFilteredGmaoTickets() {
  if (!gmaoTicketsGrid) return;

  const equipFilter = gmaoFilterEquip ? gmaoFilterEquip.value : 'ALL';
  const severityFilter = gmaoFilterSeverity ? gmaoFilterSeverity.value : 'ALL';
  const searchTerm = gmaoSearchInput ? gmaoSearchInput.value.trim().toLowerCase() : '';

  const filtered = gmaoTicketsList.filter(ticket => {
    // Equipment filter
    if (equipFilter !== 'ALL' && ticket.equipment !== equipFilter) {
      return false;
    }
    // Severity filter
    if (severityFilter !== 'ALL' && (ticket.severity || '').toLowerCase() !== severityFilter.toLowerCase()) {
      return false;
    }
    // Search query
    if (searchTerm) {
      const matchText = (ticket.title + ' ' + ticket.description + ' ' + (ticket.ticket_id || '')).toLowerCase();
      if (!matchText.includes(searchTerm)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    gmaoTicketsGrid.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">search_off</span>
        <p>Aucune intervention ne correspond aux critères de filtre sélectionnés.</p>
      </div>
    `;
    return;
  }

  gmaoTicketsGrid.innerHTML = '';
  filtered.forEach(ticket => {
    const card = document.createElement('div');
    card.className = `gmao-ticket-card ${ticket.isNew ? 'just-added' : ''}`;
    
    const severityClass = `severity-${(ticket.severity || 'normal').toLowerCase()}`;
    const equipClass = ticket.equipment || 'GEN';

    card.innerHTML = `
      <div class="ticket-header">
        <div class="ticket-ref-group">
          <span class="ticket-id">${escapeHtml(ticket.ticket_id || ('GMAO-' + ticket.numero_intervention))}</span>
          <span class="equipment-badge ${equipClass}">${escapeHtml(ticket.equipment || 'Équipement')}</span>
        </div>
        <div class="ticket-actions-group">
          <span class="ticket-severity-badge ${severityClass}">${escapeHtml(ticket.severity || 'Normal')}</span>
          <button class="btn-delete-ticket" data-ticket-id="${escapeHtml(ticket.ticket_id || ('GMAO-' + ticket.numero_intervention))}" title="Supprimer ce bon d'intervention">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>

      <h4 class="ticket-title">${escapeHtml(ticket.title || 'Intervention')}</h4>
      <p class="ticket-desc">${escapeHtml(ticket.description || 'Aucun détail fourni.')}</p>

      <div class="ticket-footer">
        <div class="ticket-bq-synced">
          <span class="material-symbols-outlined">cloud_done</span>
          <span>Archivé BigQuery (dataset: dalkia)</span>
        </div>
        <div>
          <span>${escapeHtml(ticket.timestamp || 'Récent')}</span>
          ${ticket.technician ? ` • <span>${escapeHtml(ticket.technician)}</span>` : ''}
        </div>
      </div>
    `;
    gmaoTicketsGrid.appendChild(card);
  });
}

function updateGmaoKpis() {
  const total = gmaoTicketsList.length;
  const critical = gmaoTicketsList.filter(t => (t.severity || '').toLowerCase() === 'critique').length;
  const preventive = gmaoTicketsList.filter(t => (t.severity || '').toLowerCase() === 'preventif').length;
  const equipments = [...new Set(gmaoTicketsList.map(t => t.equipment).filter(Boolean))].join(', ');

  if (kpiTotalTickets) kpiTotalTickets.textContent = total;
  if (kpiCriticalTickets) kpiCriticalTickets.textContent = critical;
  if (kpiPreventiveTickets) kpiPreventiveTickets.textContent = preventive;
  if (kpiEquipmentsCount) kpiEquipmentsCount.textContent = equipments || 'B1, ECH1, V3V';
  if (gmaoBadgeCount) gmaoBadgeCount.textContent = total;
}

async function loadGmaoTickets() {
  try {
    if (gmaoTicketsGrid) {
      gmaoTicketsGrid.innerHTML = `
        <div class="loading-state">
          <span class="material-symbols-outlined spinning">sync</span>
          <p>Chargement des interventions depuis BigQuery...</p>
        </div>
      `;
    }
    const res = await fetch('/api/gmao/interventions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.interventions) {
      gmaoTicketsList = data.interventions;
      updateGmaoKpis();
      renderFilteredGmaoTickets();
    }
  } catch (err) {
    console.error('Failed to load GMAO tickets:', err);
    if (gmaoTicketsGrid) {
      gmaoTicketsGrid.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined text-danger">cloud_off</span>
          <p>Erreur lors de la récupération des données GMAO (${err.message}).</p>
        </div>
      `;
    }
  }
}

function handleGmaoTicketCreated(ticket) {
  if (!ticket) return;
  const newTicket = {
    ticket_id: ticket.ticket_id || `GMAO-2026-${ticket.numero_intervention || Date.now()}`,
    numero_intervention: ticket.numero_intervention,
    equipment: ticket.equipment || 'B1',
    title: ticket.title || 'Intervention créée à la voix',
    description: ticket.description || 'Enregistrée via Gemini Live 3.8',
    severity: ticket.severity || 'normal',
    timestamp: ticket.timestamp || 'À l\'instant',
    technician: 'Technicien Exploitation (Via Dalkia LiveAssist)',
    isNew: true
  };

  // Add to top of list
  gmaoTicketsList.unshift(newTicket);
  updateGmaoKpis();
  renderFilteredGmaoTickets();

  // If on supervision tab, animate badge
  if (gmaoBadgeCount) {
    gmaoBadgeCount.style.transform = 'scale(1.3)';
    gmaoBadgeCount.style.backgroundColor = '#FF7900';
    gmaoBadgeCount.style.color = '#FFFFFF';
    setTimeout(() => {
      gmaoBadgeCount.style.transform = 'scale(1)';
    }, 600);
  }
}

function handleGmaoTicketDeleted(ticketId) {
  if (!ticketId) return;
  const cleanId = String(ticketId).trim();

  gmaoTicketsList = gmaoTicketsList.filter(t => {
    const tId = String(t.ticket_id || ('GMAO-' + t.numero_intervention)).trim();
    const tNum = String(t.numero_intervention || '').trim();
    if (tId === cleanId) return false;
    if (tNum && tNum === cleanId) return false;
    if (tNum && cleanId.endsWith('-' + tNum)) return false;
    return true;
  });

  updateGmaoKpis();
  renderFilteredGmaoTickets();
}

// Single ticket deletion via trash button
if (gmaoTicketsGrid) {
  gmaoTicketsGrid.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.btn-delete-ticket');
    if (!deleteBtn) return;

    const ticketId = deleteBtn.getAttribute('data-ticket-id');
    if (!ticketId) return;

    const confirmMsg = `Confirmez-vous la suppression du bon d'intervention ${ticketId} ?\nCette opération sera également répercutée dans BigQuery.`;
    if (!window.confirm(confirmMsg)) return;

    const card = deleteBtn.closest('.gmao-ticket-card');
    if (card) {
      card.classList.add('deleting');
    }

    try {
      const res = await fetch(`/api/gmao/interventions/${encodeURIComponent(ticketId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      setTimeout(() => {
        handleGmaoTicketDeleted(ticketId);
      }, 250);
    } catch (err) {
      console.error('Erreur lors de la suppression du ticket:', err);
      if (card) card.classList.remove('deleting');
      alert(`Impossible de supprimer le bon d'intervention : ${err.message}`);
    }
  });
}

// Modal Form Handlers
if (btnOpenModal && ticketModal) {
  btnOpenModal.addEventListener('click', () => {
    ticketModal.classList.remove('hidden');
    formTitle.focus();
  });
}

function closeTicketModal() {
  if (ticketModal) ticketModal.classList.add('hidden');
  if (manualTicketForm) manualTicketForm.reset();
}

if (btnCloseModal) btnCloseModal.addEventListener('click', closeTicketModal);
if (btnCancelModal) btnCancelModal.addEventListener('click', closeTicketModal);

if (manualTicketForm) {
  manualTicketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      equipment_id: formEquipment.value,
      severity: formSeverity.value,
      title: formTitle.value.trim(),
      description: formDescription.value.trim()
    };

    try {
      const res = await fetch('/api/gmao/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      closeTicketModal();
      handleGmaoTicketCreated(data);
    } catch (err) {
      alert('Erreur lors de l\'enregistrement dans BigQuery : ' + err.message);
    }
  });
}

if (gmaoFilterEquip) gmaoFilterEquip.addEventListener('change', renderFilteredGmaoTickets);
if (gmaoFilterSeverity) gmaoFilterSeverity.addEventListener('change', renderFilteredGmaoTickets);
if (gmaoSearchInput) gmaoSearchInput.addEventListener('input', renderFilteredGmaoTickets);
if (btnRefreshGmao) btnRefreshGmao.addEventListener('click', loadGmaoTickets);

window.addEventListener('load', () => {
  connectWebSocket();
  setBoilerSimulation(870); // Initialize in nominal state
  loadGmaoTickets(); // Fetch initial GMAO records from BigQuery
});

