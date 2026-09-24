/**
 * Industrial SCADA synoptic diagram component for Dalkia heating plant.
 */

import React from 'react';
import {
  Flame,
  RotateCw,
  Power,
  Droplets,
  Layers,
  TrendingUp
} from 'lucide-react';
import {
  IDalkiaFacilityState,
  EquipmentStatus
} from '../types/dalkia.ts';

/**
 * Props for the SynopticView component.
 */
export interface ISynopticViewProps {
  readonly facilityState: IDalkiaFacilityState;
  readonly onToggleEquipment: (equipmentId: string, currentStatus: EquipmentStatus) => void;
  readonly onUpdateSetpoint: (circuit: 'primary' | 'secondary', temp: number) => void;
}

/**
 * Renders an animated heating plant synoptic with real-time fluid circuits and equipment statuses.
 * @param props Component properties
 * @returns JSX Element
 */
export const SynopticView: React.FC<ISynopticViewProps> = ({
  facilityState,
  onToggleEquipment,
  onUpdateSetpoint
}) => {
  const { primaryCircuit, secondaryCircuit, equipments } = facilityState;

  // Equipment lookup helpers
  const b1 = equipments.find((e) => e.id === 'B1');
  const g2 = equipments.find((e) => e.id === 'G2');
  const p1 = equipments.find((e) => e.id === 'P1');
  const p2 = equipments.find((e) => e.id === 'P2');
  const v3v = equipments.find((e) => e.id === 'V3V');
  const ech1 = equipments.find((e) => e.id === 'ECH1');

  return (
    <div className="bg-[#0b1728]/95 border border-[#1b3456] rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
      {/* Header bar of the Synoptic */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-[#1b3456]">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#0072CE]" />
          <h2 className="text-base font-bold text-white tracking-wide">
            Synoptique d&apos;Exploitation Thermique
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
            Réseau Primaire (110°C / 16b) &rarr; Réseau Secondaire (85°C / 6b)
          </span>
        </div>

        {/* Quick setpoint controls */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700">
            <span className="text-slate-400">Consigne Prim :</span>
            <button
              onClick={() => onUpdateSetpoint('primary', primaryCircuit.supplyTempSetpoint - 1)}
              className="text-slate-300 hover:text-white px-1 font-bold"
            >
              -
            </button>
            <span className="font-mono font-bold text-[#FF5E00]">
              {primaryCircuit.supplyTempSetpoint}°C
            </span>
            <button
              onClick={() => onUpdateSetpoint('primary', primaryCircuit.supplyTempSetpoint + 1)}
              className="text-slate-300 hover:text-white px-1 font-bold"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700">
            <span className="text-slate-400">Consigne Sec :</span>
            <button
              onClick={() => onUpdateSetpoint('secondary', secondaryCircuit.supplyTempSetpoint - 1)}
              className="text-slate-300 hover:text-white px-1 font-bold"
            >
              -
            </button>
            <span className="font-mono font-bold text-[#0072CE]">
              {secondaryCircuit.supplyTempSetpoint}°C
            </span>
            <button
              onClick={() => onUpdateSetpoint('secondary', secondaryCircuit.supplyTempSetpoint + 1)}
              className="text-slate-300 hover:text-white px-1 font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main Synoptic Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative">
        {/* ==================================================== */}
        {/* SECTION 1: Production (Chaudières Biomasse & Gaz)    */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Centrale de Production</span>
            <span className="text-[10px] text-emerald-400 font-mono">Zone Haute Température</span>
          </div>

          {/* Boiler B1 - Biomass */}
          {b1 && (
            <div
              className={`p-3.5 rounded-xl border transition-all relative overflow-hidden ${
                b1.status === 'on'
                  ? 'bg-gradient-to-br from-[#122b1c] to-[#0e1d2c] border-emerald-500/50 shadow-md shadow-emerald-950/40'
                  : 'bg-[#0f1f33]/60 border-slate-700/60 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      b1.status === 'on'
                        ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {b1.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Ref: B1 | Mode: {b1.mode.toUpperCase()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleEquipment('B1', b1.status)}
                  className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
                    b1.status === 'on'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                  title="Démarrer / Arrêter la chaudière B1"
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2 bg-black/25 p-2 rounded-lg">
                <div>
                  <span className="text-slate-400 text-[10px] block">Charge Brûleur</span>
                  <span className="font-bold text-emerald-300 text-sm">
                    {b1.powerLevelPercent}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">T° Foyer / Eau</span>
                  <span className="font-bold text-white text-sm">
                    {b1.measuredTemp}°C
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 line-clamp-1">
                {b1.description}
              </p>
            </div>
          )}

          {/* Boiler G2 - Gaz Appoint & Secours */}
          {g2 && (
            <div
              className={`p-3.5 rounded-xl border transition-all relative overflow-hidden ${
                g2.status === 'on'
                  ? 'bg-gradient-to-br from-[#2f1807] to-[#0e1d2c] border-[#FF5E00]/60 shadow-md shadow-orange-950/40'
                  : 'bg-[#0f1f33]/60 border-slate-700/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      g2.status === 'on'
                        ? 'bg-[#FF5E00]/20 text-[#FF5E00] animate-pulse'
                        : 'bg-slate-800 text-amber-500'
                    }`}
                  >
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {g2.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Ref: G2 | Mode: {g2.mode.toUpperCase()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleEquipment('G2', g2.status)}
                  className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
                    g2.status === 'on'
                      ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 hover:bg-orange-500/30'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                  title="Démarrer / Mettre en veille la chaudière G2"
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono my-2 bg-black/25 p-2 rounded-lg">
                <div>
                  <span className="text-slate-400 text-[10px] block">État Opérationnel</span>
                  <span
                    className={`font-bold text-sm ${
                      g2.status === 'on' ? 'text-[#FF5E00]' : 'text-amber-400'
                    }`}
                  >
                    {g2.status === 'on' ? `${g2.powerLevelPercent}% (Actif)` : 'En Veille'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">T° Corps de Chauffe</span>
                  <span className="font-bold text-white text-sm">
                    {g2.measuredTemp}°C
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 line-clamp-1">
                {g2.description}
              </p>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* SECTION 2: Hydraulique Primaire & Échangeur ECH1    */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Boucle Primaire & Échange</span>
            <span className="text-[10px] text-[#38bdf8] font-mono">Transfert 16 MW</span>
          </div>

          {/* Primary Pump P1 */}
          {p1 && (
            <div className="p-3.5 rounded-xl bg-[#0f1f33]/80 border border-[#1b3456] hover:border-[#0072CE]/60 transition-all shadow-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      p1.status === 'on'
                        ? 'bg-[#0072CE]/20 text-[#38bdf8]'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <RotateCw
                      className={`w-4 h-4 ${p1.status === 'on' ? 'animate-spin' : ''}`}
                      style={{ animationDuration: '3s' }}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {p1.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Ref: P1 | Vitesse: {p1.powerLevelPercent}%
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleEquipment('P1', p1.status)}
                  className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
                    p1.status === 'on'
                      ? 'bg-[#0072CE]/20 border-[#0072CE]/50 text-[#38bdf8]'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/25 p-2 rounded-lg">
                <div>
                  <span className="text-slate-400 text-[10px] block">Débit Mesuré</span>
                  <span className="font-bold text-[#38bdf8] text-sm">
                    {p1.flowRateM3h} m³/h
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Pression Refoulement</span>
                  <span className="font-bold text-white text-sm">
                    {p1.pressureBar} bars
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Heat Exchanger ECH1 */}
          {ech1 && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#10223A] to-[#0A1628] border border-[#0072CE]/40 shadow-lg relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0072CE]/20 text-[#38bdf8] flex items-center justify-center">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {ech1.name}
                    </h3>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Échange Thermique Contre-Courant
                    </span>
                  </div>
                </div>
              </div>

              {/* Temperature gradients representation */}
              <div className="space-y-1.5 my-2">
                <div className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded bg-red-950/30 border border-red-500/20 text-red-300">
                  <span>Départ Primaire (Chaud) :</span>
                  <span className="font-bold">{primaryCircuit.supplyTempCurrent}°C</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded bg-blue-950/30 border border-blue-500/20 text-blue-300">
                  <span>Retour Primaire (Refroidi) :</span>
                  <span className="font-bold">{primaryCircuit.returnTempCurrent}°C</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>Régulation Vanne 3 Voies :</span>
                <span className="text-amber-300 font-mono font-bold">
                  {v3v ? `${v3v.powerLevelPercent}% ouverture` : '64%'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* SECTION 3: Distribution Secondaire & Sous-Stations  */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Réseau Secondaire</span>
            <span className="text-[10px] text-amber-400 font-mono">Sous-Stations Tertiaires</span>
          </div>

          {/* Secondary Pump P2 */}
          {p2 && (
            <div className="p-3.5 rounded-xl bg-[#0f1f33]/80 border border-[#1b3456] hover:border-[#0072CE]/60 transition-all shadow-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      p2.status === 'on'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <RotateCw
                      className={`w-4 h-4 ${p2.status === 'on' ? 'animate-spin' : ''}`}
                      style={{ animationDuration: '3.5s' }}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {p2.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Ref: P2 | Vitesse: {p2.powerLevelPercent}%
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleEquipment('P2', p2.status)}
                  className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
                    p2.status === 'on'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/25 p-2 rounded-lg">
                <div>
                  <span className="text-slate-400 text-[10px] block">Débit Distribution</span>
                  <span className="font-bold text-amber-300 text-sm">
                    {p2.flowRateM3h} m³/h
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Pression Réseau</span>
                  <span className="font-bold text-white text-sm">
                    {p2.pressureBar} bars
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Secondary Circuit Telemetry Box */}
          <div className="p-3.5 rounded-xl bg-[#0f1f33]/80 border border-[#1b3456] shadow-md space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold">Points de Mesure Secondaire</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60">
                <span className="text-slate-400">Départ Bâtiments :</span>
                <span className="text-white font-bold">{secondaryCircuit.supplyTempCurrent}°C</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60">
                <span className="text-slate-400">Consigne DESC :</span>
                <span className="text-[#0072CE] font-bold">{secondaryCircuit.supplyTempSetpoint}°C</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60">
                <span className="text-slate-400">Retour Réseau :</span>
                <span className="text-slate-300">{secondaryCircuit.returnTempCurrent}°C</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60">
                <span className="text-slate-400">Écart (ΔT) :</span>
                <span className="text-emerald-400 font-bold">{secondaryCircuit.deltaTemp}°C</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
