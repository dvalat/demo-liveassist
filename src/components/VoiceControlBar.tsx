/**
 * Real-time voice interaction bar with audio visualizer and live transcript.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Radio,
  MessageSquare,
  Bot,
  User,
  HelpCircle
} from 'lucide-react';
import { ITranscriptItem } from '../types/dalkia.ts';
import { IAudioVisualizerData } from '../services/audioManager.ts';

/**
 * Props for the VoiceControlBar component.
 */
export interface IVoiceControlBarProps {
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly isCapturing: boolean;
  readonly isAssistantSpeaking: boolean;
  readonly transcripts: readonly ITranscriptItem[];
  readonly getAudioVisualizerData: () => IAudioVisualizerData;
  readonly onToggleMic: () => void;
  readonly onSendTextPrompt: (text: string) => void;
  readonly onToggleConnection: () => void;
}

/**
 * Suggested voice commands for quick technician prompting.
 */
const SUGGESTED_VOICE_COMMANDS = [
  'Règle la consigne de départ à 78 degrés',
  'Démarre la chaudière gaz d\'appoint G2',
  'Acquitte l\'alarme de pression du circuit secondaire',
  'Bascule la centrale en mode éco',
  'Enregistre : purge de l\'échangeur terminée, delta T stabilisé'
];

/**
 * Interactive voice control console with dynamic Canvas soundwave visualizer.
 * @param props Component properties
 * @returns JSX Element
 */
export const VoiceControlBar: React.FC<IVoiceControlBarProps> = ({
  isConnected,
  isConnecting,
  isCapturing,
  isAssistantSpeaking,
  transcripts,
  getAudioVisualizerData,
  onToggleMic,
  onSendTextPrompt,
  onToggleConnection
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const [typedText, setTypedText] = useState('');
  const [showCommandsHelp, setShowCommandsHelp] = useState(false);

  // Auto-scroll transcript feed
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Canvas Waveform Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    let animationFrameId: number;
    let phase = 0;

    const render = (): void => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const visualData = getAudioVisualizerData();
      const amplitude = Math.max(0.05, isAssistantSpeaking ? visualData.outputVolume * 0.9 : (isCapturing ? visualData.inputVolume * 0.8 : 0.05));
      const activeColor = isAssistantSpeaking
        ? '#0072CE' // Dalkia Blue for Assistant
        : (isCapturing ? '#FF5E00' : '#475569'); // Dalkia Orange for User Mic

      phase += 0.08;

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = activeColor;
      ctx.beginPath();

      const centerY = height / 2;
      const numPoints = 60;

      for (let i = 0; i <= numPoints; i += 1) {
        const x = (i / numPoints) * width;
        const normalizedX = (i / numPoints) * Math.PI * 2;
        const y = centerY + Math.sin(normalizedX * 2 + phase) * Math.cos(normalizedX * 1.5 - phase) * (amplitude * (height / 2.2));

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Subtle glow effect
      ctx.shadowBlur = amplitude > 0.1 ? 12 : 0;
      ctx.shadowColor = activeColor;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [getAudioVisualizerData, isCapturing, isAssistantSpeaking]);

  const handleFormSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (typedText.trim() !== '') {
      onSendTextPrompt(typedText.trim());
      setTypedText('');
    }
  };

  return (
    <div className="bg-[#0b1728]/95 border border-[#1b3456] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-4">
      {/* Top Bar: Title & Status */}
      <div className="flex items-center justify-between border-b border-[#1b3456] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#FF5E00]/20 text-[#FF5E00]">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Dalkia LiveAssist Console
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF5E00]/20 text-[#FF8C00] border border-[#FF5E00]/30 lowercase font-normal">
                voix bidirectionnelle
              </span>
            </h2>
          </div>
        </div>

        <button
          onClick={() => setShowCommandsHelp(!showCommandsHelp)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Exemples de commandes</span>
        </button>
      </div>

      {/* Suggested Voice Commands Drawer */}
      {showCommandsHelp && (
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs space-y-2 animate-fadeIn">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF5E00]" />
            <span>Commandes vocales recommandées (cliquez ou dictez au micro) :</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_VOICE_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                onClick={() => onSendTextPrompt(cmd)}
                className="px-2.5 py-1 rounded-lg bg-[#10223A] border border-[#1E3A5F] hover:border-[#0072CE] text-slate-300 hover:text-white transition-all text-[11px] text-left"
              >
                &ldquo;{cmd}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Audio & Microphone Control Center */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-[#07111e]/90 p-4 rounded-xl border border-slate-800">
        {/* Big Microphone Toggle Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={isConnected ? onToggleMic : onToggleConnection}
            disabled={isConnecting}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl relative ${
              !isConnected
                ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                : isCapturing
                ? 'bg-gradient-to-tr from-[#FF5E00] to-orange-500 text-white shadow-orange-500/40 ring-4 ring-orange-500/20 scale-105 animate-pulse'
                : 'bg-[#10223A] border border-[#0072CE]/60 text-[#38bdf8] hover:border-[#0072CE] hover:bg-[#152e4d]'
            }`}
            title={isConnected ? (isCapturing ? 'Couper le micro' : 'Activer le micro') : 'Se connecter pour parler'}
          >
            {isCapturing ? (
              <Mic className="w-7 h-7" />
            ) : (
              <MicOff className="w-6 h-6 text-slate-400" />
            )}
          </button>
          <span className="text-[11px] font-mono text-slate-400">
            {!isConnected
              ? 'Hors ligne'
              : isAssistantSpeaking
              ? 'Gemini répond...'
              : isCapturing
              ? 'À l\'écoute...'
              : 'Micro en pause'}
          </span>
        </div>

        {/* Real-time Dynamic Waveform Canvas */}
        <div className="flex-1 w-full flex flex-col justify-center">
          <div className="h-14 bg-black/40 rounded-lg overflow-hidden border border-slate-800/80 relative flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={600}
              height={56}
              className="w-full h-full block"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-slate-400 text-xs font-medium">
                Connectez l&apos;assistant pour démarrer l&apos;interaction vocale
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1 px-1">
            <span>Flux Micro 16kHz PCM</span>
            <span className={isAssistantSpeaking ? 'text-[#38bdf8] font-bold' : ''}>
              Sortie Gemini 24kHz PCM
            </span>
          </div>
        </div>
      </div>

      {/* Live Transcript Log Feed */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-[#0072CE]" />
            Transcription en direct (Technicien &harr; Dalkia LiveAssist)
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {transcripts.length} message(s)
          </span>
        </div>

        <div className="h-44 overflow-y-auto rounded-xl bg-black/35 border border-slate-800 p-3 space-y-2.5 font-sans text-xs scrollbar-thin scrollbar-thumb-slate-700">
          {transcripts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center gap-1.5">
              <Bot className="w-6 h-6 text-slate-600" />
              <span>Aucune interaction vocale pour le moment.</span>
              <span className="text-[11px]">Activez le micro ou cliquez sur une commande suggérée.</span>
            </div>
          ) : (
            transcripts.map((item) => (
              <div
                key={item.id}
                className={`flex gap-2.5 ${item.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {item.sender !== 'user' && (
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      item.sender === 'assistant'
                        ? 'bg-[#0072CE]/20 text-[#38bdf8]'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`p-2.5 rounded-xl max-w-[85%] leading-relaxed ${
                    item.sender === 'user'
                      ? 'bg-[#FF5E00]/20 border border-[#FF5E00]/40 text-orange-100 rounded-tr-none'
                      : item.sender === 'assistant'
                      ? 'bg-[#10223A] border border-[#1E3A5F] text-slate-200 rounded-tl-none shadow-sm'
                      : 'bg-slate-800/80 border border-slate-700 text-slate-300 italic'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-1 font-mono">
                    <span className="font-semibold text-slate-300">
                      {item.sender === 'user' ? 'Technicien Dalkia' : (item.sender === 'assistant' ? 'Assistant Live' : 'Système')}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{item.text}</p>
                </div>

                {item.sender === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-[#FF5E00]/30 text-[#FF5E00] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Manual Prompt Input for Convenience */}
      <form onSubmit={handleFormSubmit} className="flex gap-2">
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder="Saisissez un ordre ou une question technique (ex: Quelle est la température de départ ?)..."
          className="flex-1 bg-black/40 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#0072CE] transition-all"
        />
        <button
          type="submit"
          disabled={typedText.trim() === ''}
          className="px-4 py-2 bg-[#0072CE] hover:bg-[#005fb0] disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Envoyer</span>
        </button>
      </form>
    </div>
  );
};
