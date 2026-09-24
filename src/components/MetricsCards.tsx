/**
 * Facility telemetry overview cards component.
 */

import React from 'react';
import { Gauge, Zap, Thermometer, Leaf, Activity } from 'lucide-react';
import { IFacilityMetrics, IThermalCircuit } from '../types/dalkia.ts';

/**
 * Props for the MetricsCards component.
 */
export interface IMetricsCardsProps {
  readonly metrics: IFacilityMetrics;
  readonly primaryCircuit: IThermalCircuit;
  readonly secondaryCircuit: IThermalCircuit;
  readonly lastVoiceAction?: string;
}

/**
 * Key performance indicators and thermal overview banner.
 * @param props Component properties
 * @returns JSX Element
 */
export const MetricsCards: React.FC<IMetricsCardsProps> = ({
  metrics,
  primaryCircuit,
  secondaryCircuit,
  lastVoiceAction
}) => {
  return (
    <div className="space-y-3">
      {/* Voice Action Toast Banner */}
      {lastVoiceAction && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#002E6D]/80 via-[#10223A] to-[#0A1628] border border-[#0072CE]/40 shadow-sm text-sm">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0072CE]/20 text-[#38bdf8] flex-shrink-0 animate-pulse">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#38bdf8]">
            Dernière action vocale :
          </span>
          <span className="text-slate-200 font-medium truncate flex-1">
            {lastVoiceAction}
          </span>
        </div>
      )}

      {/* Grid of Key Performance Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Puissance Thermique */}
        <div className="bg-[#0b1728]/90 border border-[#1b3456] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#0072CE]/60 transition-all shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Puissance Chaufferie</span>
            <Gauge className="w-4 h-4 text-[#FF5E00]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {metrics.globalPowerMw.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-slate-400">MW / {metrics.targetPowerMw.toFixed(1)} MW</span>
          </div>
          <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#FF5E00] to-amber-400 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (metrics.globalPowerMw / metrics.targetPowerMw) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Efficacité Énergétique (COP) */}
        <div className="bg-[#0b1728]/90 border border-[#1b3456] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#0072CE]/60 transition-all shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Performance COP</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
              {metrics.energyEfficiencyCop.toFixed(2)}
            </span>
            <span className="text-xs font-medium text-slate-400">Rendement DESC</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Seuil contractuel : &gt;4.0</span>
            <span className="text-emerald-400 font-semibold">+8.7%</span>
          </div>
        </div>

        {/* Card 3: Écarts Thermiques Réseaux */}
        <div className="bg-[#0b1728]/90 border border-[#1b3456] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#0072CE]/60 transition-all shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Boucles Prim / Sec</span>
            <Thermometer className="w-4 h-4 text-[#0072CE]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {primaryCircuit.supplyTempCurrent.toFixed(1)}°C
            </span>
            <span className="text-xs font-medium text-[#38bdf8]">
              / {secondaryCircuit.supplyTempCurrent.toFixed(1)}°C
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>ΔT Prim: {primaryCircuit.deltaTemp.toFixed(1)}°C</span>
            <span className="text-emerald-400">Sec: {secondaryCircuit.deltaTemp.toFixed(1)}°C</span>
          </div>
        </div>

        {/* Card 4: Environnement & Économies CO2 */}
        <div className="bg-[#0b1728]/90 border border-[#1b3456] rounded-xl p-3.5 flex flex-col justify-between hover:border-[#0072CE]/60 transition-all shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Bilan Décarbonation</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">
              {metrics.co2SavedTons}
            </span>
            <span className="text-xs font-medium text-emerald-400 font-semibold">T CO₂ évitées</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>T° Extérieure : {metrics.outdoorTempCelsius}°C</span>
            <span className="text-slate-300">Biomasse: 88%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
