/**
 * Types and interfaces for the Dalkia LiveAssist voice control platform.
 * All interfaces are prefixed with `I` in compliance with project conventions.
 */

/**
 * State of an industrial heating equipment (boiler, pump, valve, etc.).
 */
export type EquipmentStatus = 'on' | 'off' | 'standby' | 'fault';

/**
 * Operating mode of an equipment.
 */
export type EquipmentMode = 'auto' | 'manual' | 'eco' | 'backup';

/**
 * Facility energy optimization profile.
 */
export type EnergyOptimizationMode = 'eco' | 'confort' | 'boost' | 'inter-saison';

/**
 * Severity level of an alarm.
 */
export type AlarmSeverity = 'critical' | 'warning' | 'info';

/**
 * Interface representing a physical equipment in the heating facility.
 */
export interface IDalkiaEquipment {
  readonly id: string;
  readonly name: string;
  readonly type: 'biomass_boiler' | 'gas_boiler' | 'pump' | 'valve' | 'exchanger';
  readonly status: EquipmentStatus;
  readonly mode: EquipmentMode;
  readonly powerLevelPercent: number;
  readonly measuredTemp?: number;
  readonly targetTemp?: number;
  readonly flowRateM3h?: number;
  readonly pressureBar?: number;
  readonly description: string;
}

/**
 * Interface representing a thermal circuit (primary or secondary distribution loop).
 */
export interface IThermalCircuit {
  readonly id: string;
  readonly name: string;
  readonly supplyTempCurrent: number;
  readonly supplyTempSetpoint: number;
  readonly returnTempCurrent: number;
  readonly deltaTemp: number;
  readonly pressureBar: number;
  readonly flowRateM3h: number;
}

/**
 * Interface representing an active or historical facility alarm.
 */
export interface IAlarm {
  readonly id: string;
  readonly code: string;
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly message: string;
  readonly severity: AlarmSeverity;
  readonly timestamp: string;
  readonly isAcknowledged: boolean;
  readonly acknowledgedBy?: string;
  readonly technicianComment?: string;
}

/**
 * Interface representing an intervention or maintenance log entry (GMAO).
 */
export interface IInterventionLog {
  readonly id: string;
  readonly timestamp: string;
  readonly author: string;
  readonly category: 'preventive' | 'curative' | 'consigne' | 'controle_visuel';
  readonly summary: string;
  readonly status: 'pending' | 'in_progress' | 'completed';
}

/**
 * Interface representing global real-time facility metrics.
 */
export interface IFacilityMetrics {
  readonly globalPowerMw: number;
  readonly targetPowerMw: number;
  readonly energyEfficiencyCop: number;
  readonly outdoorTempCelsius: number;
  readonly co2SavedTons: number;
  readonly primaryLoopDeltaT: number;
  readonly energyMode: EnergyOptimizationMode;
}

/**
 * Complete immutable state of the Dalkia heating facility.
 */
export interface IDalkiaFacilityState {
  readonly facilityName: string;
  readonly facilityCode: string;
  readonly location: string;
  readonly metrics: IFacilityMetrics;
  readonly primaryCircuit: IThermalCircuit;
  readonly secondaryCircuit: IThermalCircuit;
  readonly equipments: readonly IDalkiaEquipment[];
  readonly alarms: readonly IAlarm[];
  readonly interventionLogs: readonly IInterventionLog[];
  readonly lastVoiceAction?: string;
}

/**
 * Interface for live audio transcription items.
 */
export interface ITranscriptItem {
  readonly id: string;
  readonly sender: 'user' | 'assistant' | 'system';
  readonly text: string;
  readonly timestamp: string;
  readonly isFinal: boolean;
}

/**
 * Interface for Live API tool call function parameters.
 */
export interface IFunctionCallItem {
  readonly id: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
}

/**
 * Interface for Live API tool response items.
 */
export interface IFunctionResponseItem {
  readonly id: string;
  readonly name: string;
  readonly response: Record<string, unknown>;
}

/**
 * Interface representing Gemini Live connection states.
 */
export interface ILiveConnectionState {
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly isMuted: boolean;
  readonly isSpeaking: boolean;
  readonly isSimulated: boolean;
  readonly error?: string;
}
