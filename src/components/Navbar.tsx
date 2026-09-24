/**
 * Navigation and header bar component for Dalkia LiveAssist.
 */

import React from 'react';
import { Flame, Radio, Key, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';
import { IDalkiaFacilityState } from '../types/dalkia.ts';

/**
 * Props for the Navbar component.
 */
export interface INavbarProps {
  readonly facilityState: IDalkiaFacilityState;
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly isSimulation: boolean;
  readonly hasApiKey: boolean;
  readonly unacknowledgedAlarmsCount: number;
  readonly onOpenApiKeyModal: () => void;
  readonly onToggleConnection: () => void;
}

/**
 * Top navigation bar featuring facility telemetry, connection status, and controls.
 * @param props Component properties
 * @returns JSX Element
 */
export const Navbar: React.FC<INavbarProps> = ({
  facilityState,
  isConnected,
  isConnecting,
  isSimulation,
  hasApiKey,
  unacknowledgedAlarmsCount,
  onOpenApiKeyModal,
  onToggleConnection
}) => {
  return (
    <header className="bg-[#0b1728] border-b border-[#1b3456] px-4 py-3 sticky top-0 z-30 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Facility Info */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF5E00] to-[#FF8C00] flex items-center justify-center shadow-md shadow-orange-500/20">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black tracking-wider text-xl text-white">dalkia</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#0072CE]/20 text-[#38bdf8] border border-[#0072CE]/40 font-semibold uppercase">
                  LiveAssist
                </span>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  [{facilityState.facilityCode}]
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                {facilityState.facilityName}
              </p>
            </div>
          </div>

          {/* Unacknowledged alarms badge on mobile */}
          {unacknowledgedAlarmsCount > 0 && (
            <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{unacknowledgedAlarmsCount} alerte</span>
            </div>
          )}
        </div>

        {/* Center: System Status & Alarm Indicator */}
        <div className="hidden lg:flex items-center gap-3">
          {unacknowledgedAlarmsCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{unacknowledgedAlarmsCount} alarme(s) en attente d&apos;acquittement</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Régulation thermique nominale</span>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs font-mono">
            <Zap className="w-3.5 h-3.5 text-[#0072CE]" />
            <span>DESC : Mode {facilityState.metrics.energyMode.toUpperCase()}</span>
          </div>
        </div>

        {/* Action Controls & Gemini Connection Badge */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Connection Status Button */}
          <button
            onClick={onToggleConnection}
            disabled={isConnecting}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm ${
              isConnected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : isConnecting
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span>
              {isConnecting
                ? 'Connexion...'
                : isConnected
                ? (isSimulation ? 'Simulateur Dalkia Connecté' : 'Gemini 3.8 Live Connecté')
                : 'Connecter l\'Assistant'}
            </span>
          </button>

          {/* API Key Modal Button */}
          <button
            onClick={onOpenApiKeyModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              hasApiKey
                ? 'bg-[#10223A] border-[#1E3A5F] text-slate-200 hover:border-[#0072CE]'
                : 'bg-orange-500/15 border-orange-500/40 text-orange-300 hover:bg-orange-500/25 animate-pulse'
            }`}
            title="Configurer la clé API Gemini"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {hasApiKey ? 'Clé API active' : 'Configurer Clé API'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
