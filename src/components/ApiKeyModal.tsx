/**
 * Modal dialog for configuring the Gemini API key and connection mode.
 */

import React, { useState } from 'react';
import { X, Key, Shield, ExternalLink, Check } from 'lucide-react';

/**
 * Props for the ApiKeyModal component.
 */
export interface IApiKeyModalProps {
  readonly isOpen: boolean;
  readonly currentApiKey: string;
  readonly isSimulation: boolean;
  readonly onClose: () => void;
  readonly onSaveApiKey: (key: string, isSim: boolean) => void;
}

/**
 * Modal dialog enabling technicians and evaluators to input their Gemini API key or switch to Simulation mode.
 * @param props Component properties
 * @returns JSX Element | null
 */
export const ApiKeyModal: React.FC<IApiKeyModalProps> = ({
  isOpen,
  currentApiKey,
  isSimulation,
  onClose,
  onSaveApiKey
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(currentApiKey);
  const [simulationChecked, setSimulationChecked] = useState(isSimulation);

  if (!isOpen) {
    return null;
  }

  const handleSave = (e: React.FormEvent): void => {
    e.preventDefault();
    onSaveApiKey(apiKeyInput.trim(), simulationChecked);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0b1728] border border-[#1b3456] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#0072CE]/20 text-[#38bdf8] flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Configuration de l&apos;Assistant Gemini Live
            </h2>
            <p className="text-xs text-slate-400">
              Paramétrez votre accès à l&apos;API Gemini 3.8 Live pour Dalkia
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Clé API Google Gemini (AI Studio)
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-[#0072CE]"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Stockée localement dans votre navigateur (localStorage).</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#38bdf8] hover:underline flex items-center gap-1"
              >
                <span>Obtenir une clé</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Mode Switch Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={simulationChecked}
                onChange={(e) => setSimulationChecked(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-[#0072CE] focus:ring-0"
              />
              <div>
                <span className="font-bold text-slate-200 block">
                  Activer le mode Simulation &amp; Démo locale
                </span>
                <span className="text-slate-400 text-[11px] leading-relaxed block mt-0.5">
                  Permet de tester immédiatement l&apos;assistant vocal Dalkia, le synoptique et le Function Calling même sans clé API Gemini (reconnaissance vocale navigateur + synthèse vocale intégrée).
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#38bdf8] text-[11px]">
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>
              Le modèle utilisé pour le streaming WebSocket temps réel est <strong className="font-mono">gemini-3.8-live</strong>.
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#0072CE] hover:bg-[#005fb0] text-white font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30"
            >
              <Check className="w-4 h-4" />
              <span>Enregistrer et appliquer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
