/**
 * Main application component for Dalkia LiveAssist.
 * Coordinates WebSockets audio streaming, Dalkia facility state, and UI layout.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { MetricsCards } from './components/MetricsCards.tsx';
import { SynopticView } from './components/SynopticView.tsx';
import { VoiceControlBar } from './components/VoiceControlBar.tsx';
import { AlarmsAndLogsPanel } from './components/AlarmsAndLogsPanel.tsx';
import { ApiKeyModal } from './components/ApiKeyModal.tsx';
import { AudioManager, IAudioVisualizerData } from './services/audioManager.ts';
import { GeminiLiveClient } from './services/geminiLiveClient.ts';
import {
  initialFacilityState,
  setTemperatureSetpointAction,
  setEquipmentStatusAction,
  acknowledgeAlarmAction,
  logInterventionAction,
  setEnergyModeAction
} from './services/dalkiaFacilityStore.ts';
import {
  IDalkiaFacilityState,
  ITranscriptItem,
  IFunctionCallItem,
  EquipmentStatus,
  EquipmentMode,
  EnergyOptimizationMode
} from './types/dalkia.ts';

/**
 * Root Application component for Dalkia LiveAssist.
 * @returns JSX Element
 */
export const App: React.FC = () => {
  // Facility state
  const [facilityState, setFacilityState] = useState<IDalkiaFacilityState>(initialFacilityState);

  // Transcripts list
  const [transcripts, setTranscripts] = useState<readonly ITranscriptItem[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Bonjour Technicien. Dalkia LiveAssist est prêt pour la supervision vocale de la chaufferie biomasse et du réseau urbain.',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      isFinal: true
    }
  ]);

  // Settings & Keys
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('dalkia_gemini_api_key') || '');
  const [isSimulation, setIsSimulation] = useState<boolean>(() => {
    const saved = localStorage.getItem('dalkia_gemini_simulation');
    return saved !== null ? saved === 'true' : true; // Default to simulation if no API key is present
  });
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);

  // Connection & Streaming States
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState<boolean>(false);

  // References to long-lived audio and websocket managers
  const audioManagerRef = useRef<AudioManager | null>(null);
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const facilityStateRef = useRef<IDalkiaFacilityState>(facilityState);

  // Keep ref synchronized with state for callbacks
  useEffect(() => {
    facilityStateRef.current = facilityState;
  }, [facilityState]);

  /**
   * Dispatches and handles a tool call executed by Gemini Live API or Simulator.
   * @param call Tool call item with name and arguments
   * @returns Structured JSON result for Gemini
   */
  const handleToolCall = useCallback(async (call: IFunctionCallItem): Promise<Record<string, unknown>> => {
    const currentState = facilityStateRef.current;
    const { name, args } = call;

    if (name === 'setTemperatureSetpoint') {
      const circuit = String(args.circuit || 'primary');
      const temp = Number(args.temperature || 80);
      setFacilityState((prev) => setTemperatureSetpointAction(prev, circuit, temp));
      return {
        status: 'success',
        circuit,
        setpointSet: temp,
        unit: 'celsius',
        message: `Consigne réglée à ${temp}°C sur le circuit ${circuit}`
      };
    }

    if (name === 'setEquipmentStatus') {
      const equipmentId = String(args.equipmentId || 'G2');
      const status = (args.status as EquipmentStatus) || 'on';
      const mode = args.mode ? (String(args.mode) as EquipmentMode) : undefined;
      const power = args.powerLevelPercent !== undefined ? Number(args.powerLevelPercent) : undefined;
      setFacilityState((prev) => setEquipmentStatusAction(prev, equipmentId, status, mode, power));
      return {
        status: 'success',
        equipmentId,
        newStatus: status,
        powerLevelPercent: power,
        message: `Équipement ${equipmentId} mis à jour : état ${status}`
      };
    }

    if (name === 'acknowledgeAlarm') {
      const alarmId = String(args.alarmId || 'all');
      const comment = args.technicianComment ? String(args.technicianComment) : undefined;
      setFacilityState((prev) => acknowledgeAlarmAction(prev, alarmId, comment));
      return {
        status: 'success',
        alarmId,
        comment,
        message: `Alarme(s) ${alarmId} acquittée(s)`
      };
    }

    if (name === 'logIntervention') {
      const summary = String(args.summary || 'Intervention de maintenance');
      const category = (args.category ? String(args.category) : 'curative') as 'preventive' | 'curative' | 'consigne' | 'controle_visuel';
      setFacilityState((prev) => logInterventionAction(prev, summary, category));
      return {
        status: 'success',
        summary,
        category,
        message: 'Intervention enregistrée dans la GMAO'
      };
    }

    if (name === 'setEnergyMode') {
      const mode = (args.mode as EnergyOptimizationMode) || 'confort';
      setFacilityState((prev) => setEnergyModeAction(prev, mode));
      return {
        status: 'success',
        mode,
        message: `Profil d'optimisation énergétique basculé sur ${mode}`
      };
    }

    if (name === 'getFacilityStatus') {
      return {
        status: 'success',
        facility: currentState.facilityName,
        powerMw: currentState.metrics.globalPowerMw,
        primarySupplyTemp: currentState.primaryCircuit.supplyTempCurrent,
        secondarySupplyTemp: currentState.secondaryCircuit.supplyTempCurrent,
        unacknowledgedAlarms: currentState.alarms.filter((a) => !a.isAcknowledged).length
      };
    }

    return { status: 'unknown_tool', name };
  }, []);

  /**
   * Initializes AudioManager and GeminiLiveClient services.
   */
  useEffect(() => {
    // Instantiate Audio Manager
    const audioManager = new AudioManager({
      onInputAudioChunk: (base64Chunk: string): void => {
        if (liveClientRef.current) {
          liveClientRef.current.sendRealtimeAudio(base64Chunk);
        }
      },
      onSpeakingStatusChange: (speaking: boolean): void => {
        setIsAssistantSpeaking(speaking);
      }
    });
    audioManagerRef.current = audioManager;

    // Instantiate Gemini Live Client
    const liveClient = new GeminiLiveClient({
      apiKey,
      isSimulation,
      onTranscript: (item: ITranscriptItem): void => {
        setTranscripts((prev) => [...prev, item]);
      },
      onAudioOutput: (base64AudioChunk: string): void => {
        audioManager.playAudioChunk(base64AudioChunk);
      },
      onInterrupted: (): void => {
        audioManager.clearPlaybackQueue();
      },
      onToolCall: handleToolCall,
      onConnectionStatusChange: (status): void => {
        setIsConnected(status.isConnected);
        setIsConnecting(status.isConnecting);
      }
    });
    liveClientRef.current = liveClient;

    return (): void => {
      audioManager.dispose();
      liveClient.disconnect();
    };
  }, [handleToolCall, apiKey, isSimulation]);

  /**
   * Toggles the connection with Gemini Live API or Simulation.
   */
  const handleToggleConnection = useCallback(async (): Promise<void> => {
    if (!liveClientRef.current) {
      return;
    }

    if (isConnected) {
      liveClientRef.current.disconnect();
      if (audioManagerRef.current && isCapturing) {
        audioManagerRef.current.stopCapture();
        setIsCapturing(false);
      }
    } else {
      liveClientRef.current.updateOptions({ apiKey, isSimulation });
      await liveClientRef.current.connect();
    }
  }, [isConnected, isCapturing, apiKey, isSimulation]);

  /**
   * Toggles microphone audio capture.
   */
  const handleToggleMic = useCallback(async (): Promise<void> => {
    if (!audioManagerRef.current) {
      return;
    }

    if (isCapturing) {
      audioManagerRef.current.stopCapture();
      setIsCapturing(false);
    } else {
      try {
        await audioManagerRef.current.startCapture();
        setIsCapturing(true);
      } catch (err) {
        console.error('Impossible de démarrer la capture microphone:', err);
      }
    }
  }, [isCapturing]);

  /**
   * Sends a manual typed text prompt or triggers a suggested command.
   * @param text Text instruction
   */
  const handleSendTextPrompt = useCallback(async (text: string): Promise<void> => {
    if (!liveClientRef.current) {
      return;
    }

    if (!isConnected) {
      await handleToggleConnection();
    }

    await liveClientRef.current.processSimulatedSpokenText(text);
  }, [isConnected, handleToggleConnection]);

  /**
   * Toggles status of an equipment from the synoptic UI.
   * @param equipmentId Identifier of equipment
   * @param currentStatus Current status
   */
  const handleToggleEquipment = useCallback((equipmentId: string, currentStatus: EquipmentStatus): void => {
    const nextStatus: EquipmentStatus = currentStatus === 'on' ? 'standby' : 'on';
    setFacilityState((prev) => setEquipmentStatusAction(prev, equipmentId, nextStatus));
  }, []);

  /**
   * Updates setpoint temperature for a circuit.
   * @param circuit Target circuit
   * @param temp Temperature in Celsius
   */
  const handleUpdateSetpoint = useCallback((circuit: 'primary' | 'secondary', temp: number): void => {
    setFacilityState((prev) => setTemperatureSetpointAction(prev, circuit, temp));
  }, []);

  /**
   * Acknowledges an alarm.
   * @param alarmId Identifier of the alarm
   */
  const handleAcknowledgeAlarm = useCallback((alarmId: string): void => {
    setFacilityState((prev) => acknowledgeAlarmAction(prev, alarmId, 'Acquitté manuellement par le technicien'));
  }, []);

  /**
   * Saves API key and simulation preference.
   * @param key Gemini API Key
   * @param isSim Simulation mode flag
   */
  const handleSaveApiKey = useCallback((key: string, isSim: boolean): void => {
    setApiKey(key);
    setIsSimulation(isSim);
    localStorage.setItem('dalkia_gemini_api_key', key);
    localStorage.setItem('dalkia_gemini_simulation', isSim ? 'true' : 'false');

    if (liveClientRef.current) {
      liveClientRef.current.updateOptions({ apiKey: key, isSimulation: isSim });
      if (isConnected) {
        liveClientRef.current.disconnect();
        void liveClientRef.current.connect();
      }
    }
  }, [isConnected]);

  /**
   * Provides visualizer data to child components.
   * @returns Visualizer metrics
   */
  const getVisualizerData = useCallback((): IAudioVisualizerData => {
    return audioManagerRef.current?.getVisualizerData() || { inputVolume: 0, outputVolume: 0 };
  }, []);

  const unacknowledgedAlarmsCount = facilityState.alarms.filter((a) => !a.isAcknowledged).length;

  return (
    <div className="min-h-screen bg-[#07111e] text-slate-100 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <Navbar
        facilityState={facilityState}
        isConnected={isConnected}
        isConnecting={isConnecting}
        isSimulation={isSimulation}
        hasApiKey={apiKey !== ''}
        unacknowledgedAlarmsCount={unacknowledgedAlarmsCount}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onToggleConnection={handleToggleConnection}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Telemetry KPI Cards */}
        <MetricsCards
          metrics={facilityState.metrics}
          primaryCircuit={facilityState.primaryCircuit}
          secondaryCircuit={facilityState.secondaryCircuit}
          lastVoiceAction={facilityState.lastVoiceAction}
        />

        {/* Operational Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (8 cols): Synoptic Schematic & Voice Control Bar */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            <SynopticView
              facilityState={facilityState}
              onToggleEquipment={handleToggleEquipment}
              onUpdateSetpoint={handleUpdateSetpoint}
            />

            <VoiceControlBar
              isConnected={isConnected}
              isConnecting={isConnecting}
              isCapturing={isCapturing}
              isAssistantSpeaking={isAssistantSpeaking}
              transcripts={transcripts}
              getAudioVisualizerData={getVisualizerData}
              onToggleMic={handleToggleMic}
              onSendTextPrompt={handleSendTextPrompt}
              onToggleConnection={handleToggleConnection}
            />
          </div>

          {/* Right Column (4 cols): Alarms & GMAO Maintenance Logs */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <AlarmsAndLogsPanel
              alarms={facilityState.alarms}
              logs={facilityState.interventionLogs}
              onAcknowledgeAlarm={handleAcknowledgeAlarm}
            />
          </div>
        </div>
      </main>

      {/* API Key Modal Dialog */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        currentApiKey={apiKey}
        isSimulation={isSimulation}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
};
