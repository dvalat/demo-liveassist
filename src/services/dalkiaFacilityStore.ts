/**
 * Functional state manager for the Dalkia heating facility.
 * Follows functional programming paradigms with pure reducer functions and immutable state transitions.
 */

import {
  IDalkiaFacilityState,
  IInterventionLog,
  EnergyOptimizationMode,
  EquipmentStatus,
  EquipmentMode
} from '../types/dalkia.ts';

/**
 * Initial facility state representing a real-world Dalkia district heating plant.
 */
export const initialFacilityState: IDalkiaFacilityState = {
  facilityName: 'Centrale Énergétique Métropole - Chaufferie Biomasse & Réseau Urbain',
  facilityCode: 'DK-LILLE-NORD-01',
  location: 'Lille Métropole - Secteur Nord',
  metrics: {
    globalPowerMw: 14.2,
    targetPowerMw: 15.0,
    energyEfficiencyCop: 4.35,
    outdoorTempCelsius: 3.8,
    co2SavedTons: 1240,
    primaryLoopDeltaT: 24.3,
    energyMode: 'confort'
  },
  primaryCircuit: {
    id: 'primary',
    name: 'Circuit Primaire Réseau de Chaleur',
    supplyTempCurrent: 82.5,
    supplyTempSetpoint: 80.0,
    returnTempCurrent: 58.2,
    deltaTemp: 24.3,
    pressureBar: 4.8,
    flowRateM3h: 310
  },
  secondaryCircuit: {
    id: 'secondary',
    name: 'Circuit Secondaire Sous-Stations Bâtiments',
    supplyTempCurrent: 71.0,
    supplyTempSetpoint: 70.0,
    returnTempCurrent: 46.5,
    deltaTemp: 24.5,
    pressureBar: 2.8,
    flowRateM3h: 265
  },
  equipments: [
    {
      id: 'B1',
      name: 'Chaudière Biomasse N°1 (Bois Énergie)',
      type: 'biomass_boiler',
      status: 'on',
      mode: 'auto',
      powerLevelPercent: 88,
      measuredTemp: 84.0,
      targetTemp: 85.0,
      description: 'Production de base biomasse continue avec régulation d\'air comburant'
    },
    {
      id: 'G2',
      name: 'Chaudière Gaz N°2 (Appoint / Secours)',
      type: 'gas_boiler',
      status: 'standby',
      mode: 'backup',
      powerLevelPercent: 0,
      measuredTemp: 45.0,
      targetTemp: 80.0,
      description: 'Générateur gaz modulant pour appoint de pointe ou relève d\'urgence'
    },
    {
      id: 'P1',
      name: 'Pompe de Circulation Primaire P1',
      type: 'pump',
      status: 'on',
      mode: 'auto',
      powerLevelPercent: 75,
      flowRateM3h: 310,
      pressureBar: 4.8,
      description: 'Circulateur à vitesse variable boucle primaire haute température'
    },
    {
      id: 'P2',
      name: 'Pompe Réseau Secondaire P2',
      type: 'pump',
      status: 'on',
      mode: 'auto',
      powerLevelPercent: 68,
      flowRateM3h: 265,
      pressureBar: 2.8,
      description: 'Distribution vers le réseau de sous-stations tertiaires et résidentielles'
    },
    {
      id: 'V3V',
      name: 'Vanne 3 Voies Régulation Échangeur',
      type: 'valve',
      status: 'on',
      mode: 'auto',
      powerLevelPercent: 64,
      description: 'Vanne motorisée asservie à la loi d\'eau et consigne départ'
    },
    {
      id: 'ECH1',
      name: 'Échangeur à Plaques Haute Performance',
      type: 'exchanger',
      status: 'on',
      mode: 'auto',
      powerLevelPercent: 100,
      description: 'Transfert thermique primaire / secondaire 16 MW'
    }
  ],
  alarms: [
    {
      id: 'ALM-102',
      code: 'WARN_SEC_PRESSURE',
      equipmentId: 'P2',
      equipmentName: 'Circuit Secondaire P2',
      message: 'Légère baisse de pression retour secondaire (2.7 bars, seuil 2.6)',
      severity: 'warning',
      timestamp: '08:42:15',
      isAcknowledged: false
    },
    {
      id: 'ALM-089',
      code: 'INFO_FILTER_DP',
      equipmentId: 'ECH1',
      equipmentName: 'Échangeur ECH1',
      message: 'Perte de charge différentielle conforme après cycle de désembouage',
      severity: 'info',
      timestamp: '07:15:00',
      isAcknowledged: true,
      acknowledgedBy: 'Technicien Dalkia (Équipe Matin)',
      technicianComment: 'Vérification effectuée lors de la ronde'
    }
  ],
  interventionLogs: [
    {
      id: 'LOG-304',
      timestamp: '07:30',
      author: 'J. Dupont (Technicien Dalkia)',
      category: 'consigne',
      summary: 'Passage en consigne hivernale de départ à 80°C selon prévisions météo DESC.',
      status: 'completed'
    },
    {
      id: 'LOG-303',
      timestamp: '06:15',
      author: 'Supervision DESC',
      category: 'controle_visuel',
      summary: 'Contrôle automatique de rendement biomasse : COP mesuré à 4.35.',
      status: 'completed'
    }
  ],
  lastVoiceAction: 'Système prêt pour les consignes vocales'
};

/**
 * Pure function to set the temperature setpoint for a specific circuit.
 * @param state Current facility state
 * @param circuitId Target circuit ('primary' | 'secondary')
 * @param temperature Setpoint value in Celsius
 * @returns Updated facility state
 */
export const setTemperatureSetpointAction = (
  state: IDalkiaFacilityState,
  circuitId: 'primary' | 'secondary' | string,
  temperature: number
): IDalkiaFacilityState => {
  const isTargetPrimary = circuitId.toLowerCase().includes('prim') || circuitId === 'primary';
  const targetKey = isTargetPrimary ? 'primaryCircuit' : 'secondaryCircuit';
  const circuit = state[targetKey];

  const updatedCircuit = {
    ...circuit,
    supplyTempSetpoint: temperature,
    supplyTempCurrent: Number((isTargetPrimary ? temperature - 0.4 : temperature - 0.8).toFixed(1)),
    returnTempCurrent: Number((isTargetPrimary ? temperature - 18.2 : temperature - 23.9).toFixed(1))
  };

  const actionText = `Consigne départ ${circuit.name} ajustée à ${temperature}°C`;

  const newLog: IInterventionLog = {
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    author: 'Technicien Vocal Dalkia',
    category: 'consigne',
    summary: actionText,
    status: 'completed'
  };

  return {
    ...state,
    [targetKey]: updatedCircuit,
    interventionLogs: [newLog, ...state.interventionLogs],
    lastVoiceAction: actionText
  };
};

/**
 * Pure function to change the status, mode, and power of an equipment.
 * @param state Current facility state
 * @param equipmentId Identifier of the equipment (e.g., 'B1', 'G2', 'P1')
 * @param status New status ('on', 'off', 'standby', 'fault')
 * @param mode Optional operating mode
 * @param powerLevelPercent Optional power percentage (0-100)
 * @returns Updated facility state
 */
export const setEquipmentStatusAction = (
  state: IDalkiaFacilityState,
  equipmentId: string,
  status: EquipmentStatus,
  mode?: EquipmentMode,
  powerLevelPercent?: number
): IDalkiaFacilityState => {
  const normalizedId = equipmentId.toUpperCase();
  const targetEquipment = state.equipments.find(
    (e) => e.id.toUpperCase() === normalizedId || e.name.toLowerCase().includes(equipmentId.toLowerCase())
  );

  if (!targetEquipment) {
    return state;
  }

  const updatedEquipments = state.equipments.map((equipment) => {
    if (equipment.id !== targetEquipment.id) {
      return equipment;
    }

    const newPower = powerLevelPercent !== undefined
      ? powerLevelPercent
      : (status === 'on' ? (equipment.powerLevelPercent === 0 ? 80 : equipment.powerLevelPercent) : 0);

    return {
      ...equipment,
      status,
      mode: mode !== undefined ? mode : equipment.mode,
      powerLevelPercent: newPower
    };
  });

  const actionText = `${targetEquipment.name} : état passé à "${status}" (puissance: ${powerLevelPercent !== undefined ? powerLevelPercent : targetEquipment.powerLevelPercent}%)`;

  const newLog: IInterventionLog = {
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    author: 'Technicien Vocal Dalkia',
    category: 'curative',
    summary: actionText,
    status: 'completed'
  };

  return {
    ...state,
    equipments: updatedEquipments,
    interventionLogs: [newLog, ...state.interventionLogs],
    lastVoiceAction: actionText
  };
};

/**
 * Pure function to acknowledge an active alarm.
 * @param state Current facility state
 * @param alarmId Identifier or part of alarm message/code
 * @param technicianComment Optional comment from technician
 * @param author Author of acknowledgment
 * @returns Updated facility state
 */
export const acknowledgeAlarmAction = (
  state: IDalkiaFacilityState,
  alarmId: string,
  technicianComment?: string,
  author: string = 'Technicien Dalkia (Vocal)'
): IDalkiaFacilityState => {
  let matched = false;
  const updatedAlarms = state.alarms.map((alarm) => {
    const isTarget = alarm.id.toUpperCase() === alarmId.toUpperCase() ||
      alarm.code.toLowerCase().includes(alarmId.toLowerCase()) ||
      alarm.equipmentName.toLowerCase().includes(alarmId.toLowerCase()) ||
      alarmId.toLowerCase() === 'all';

    if (isTarget && !alarm.isAcknowledged) {
      matched = true;
      return {
        ...alarm,
        isAcknowledged: true,
        acknowledgedBy: author,
        technicianComment: technicianComment || 'Acquitté à la voix via Dalkia LiveAssist'
      };
    }
    return alarm;
  });

  const actionText = matched
    ? `Alarme(s) acquittée(s) : ${alarmId}`
    : `Aucune alarme en attente correspondant à "${alarmId}"`;

  const newLog: IInterventionLog = {
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    author,
    category: 'curative',
    summary: actionText + (technicianComment ? ` - Note : ${technicianComment}` : ''),
    status: 'completed'
  };

  return {
    ...state,
    alarms: updatedAlarms,
    interventionLogs: [newLog, ...state.interventionLogs],
    lastVoiceAction: actionText
  };
};

/**
 * Pure function to record an intervention log in the GMAO.
 * @param state Current facility state
 * @param summary Description of the maintenance or intervention action
 * @param category Category of the intervention
 * @param author Author of the intervention
 * @returns Updated facility state
 */
export const logInterventionAction = (
  state: IDalkiaFacilityState,
  summary: string,
  category: 'preventive' | 'curative' | 'consigne' | 'controle_visuel' = 'curative',
  author: string = 'Technicien Dalkia (Vocal)'
): IDalkiaFacilityState => {
  const newLog: IInterventionLog = {
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    author,
    category,
    summary,
    status: 'completed'
  };

  const actionText = `Intervention consignée en GMAO : "${summary}"`;

  return {
    ...state,
    interventionLogs: [newLog, ...state.interventionLogs],
    lastVoiceAction: actionText
  };
};

/**
 * Pure function to change the facility global energy mode.
 * @param state Current facility state
 * @param mode Target energy optimization mode
 * @returns Updated facility state
 */
export const setEnergyModeAction = (
  state: IDalkiaFacilityState,
  mode: EnergyOptimizationMode
): IDalkiaFacilityState => {
  const modeSetpoints: Record<EnergyOptimizationMode, { primary: number; secondary: number }> = {
    eco: { primary: 75.0, secondary: 65.0 },
    confort: { primary: 80.0, secondary: 70.0 },
    boost: { primary: 86.0, secondary: 76.0 },
    'inter-saison': { primary: 70.0, secondary: 60.0 }
  };

  const setpoints = modeSetpoints[mode] || modeSetpoints.confort;

  const actionText = `Mode énergétique basculé sur "${mode.toUpperCase()}" (Consignes: ${setpoints.primary}°C / ${setpoints.secondary}°C)`;

  const newLog: IInterventionLog = {
    id: `LOG-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    author: 'Supervision DESC / Vocal',
    category: 'consigne',
    summary: actionText,
    status: 'completed'
  };

  return {
    ...state,
    metrics: {
      ...state.metrics,
      energyMode: mode
    },
    primaryCircuit: {
      ...state.primaryCircuit,
      supplyTempSetpoint: setpoints.primary
    },
    secondaryCircuit: {
      ...state.secondaryCircuit,
      supplyTempSetpoint: setpoints.secondary
    },
    interventionLogs: [newLog, ...state.interventionLogs],
    lastVoiceAction: actionText
  };
};

/**
 * Pure function to delete an individual intervention log by ID.
 * @param state Current facility state
 * @param logId ID of the intervention log to delete
 * @returns Updated facility state
 */
export const deleteInterventionLogAction = (
  state: IDalkiaFacilityState,
  logId: string
): IDalkiaFacilityState => {
  const updatedLogs = state.interventionLogs.filter((log) => log.id !== logId);
  return {
    ...state,
    interventionLogs: updatedLogs,
    lastVoiceAction: `Intervention ${logId} supprimée de la GMAO`
  };
};

