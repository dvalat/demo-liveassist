/**
 * Alarms management and GMAO intervention logs panel.
 */

import React, { useState } from 'react';
import {
  ClipboardList,
  CheckCircle,
  Clock,
  ShieldAlert,
  UserCheck,
  FileText,
  Trash2
} from 'lucide-react';
import { IAlarm, IInterventionLog } from '../types/dalkia.ts';

/**
 * Props for the AlarmsAndLogsPanel component.
 */
export interface IAlarmsAndLogsPanelProps {
  readonly alarms: readonly IAlarm[];
  readonly logs: readonly IInterventionLog[];
  readonly onAcknowledgeAlarm: (alarmId: string) => void;
  readonly onDeleteLog?: (logId: string) => void;
}

/**
 * Tabbed view for active facility alarms and GMAO maintenance intervention records.
 * @param props Component properties
 * @returns JSX Element
 */
export const AlarmsAndLogsPanel: React.FC<IAlarmsAndLogsPanelProps> = ({
  alarms,
  logs,
  onAcknowledgeAlarm,
  onDeleteLog
}) => {
  const [activeTab, setActiveTab] = useState<'alarms' | 'gmao'>('alarms');

  const unacknowledgedCount = alarms.filter((a) => !a.isAcknowledged).length;

  return (
    <div className="bg-[#0b1728]/95 border border-[#1b3456] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-4">
      {/* Tab Navigation Header */}
      <div className="flex items-center justify-between border-b border-[#1b3456] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('alarms')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'alarms'
                ? 'bg-[#10223A] border border-[#0072CE] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Alarmes & Alertes</span>
            {unacknowledgedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono">
                {unacknowledgedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('gmao')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'gmao'
                ? 'bg-[#10223A] border border-[#0072CE] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-[#38bdf8]" />
            <span>Journal GMAO Dalkia</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
              {logs.length}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
          Synchronisé GMAO / DESC
        </span>
      </div>

      {/* Alarms Tab Content */}
      {activeTab === 'alarms' && (
        <div className="space-y-2.5">
          {alarms.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
              <span>Aucune alarme active sur l&apos;installation.</span>
            </div>
          ) : (
            alarms.map((alarm) => (
              <div
                key={alarm.id}
                className={`p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  !alarm.isAcknowledged
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-950/20'
                    : 'bg-[#0f1f33]/60 border-slate-800 opacity-80'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        alarm.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : alarm.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {alarm.code}
                    </span>
                    <span className="font-semibold text-white">
                      {alarm.equipmentName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {alarm.timestamp}
                    </span>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {alarm.message}
                  </p>

                  {alarm.isAcknowledged && alarm.technicianComment && (
                    <div className="text-[10px] text-slate-400 italic flex items-center gap-1.5 pt-1">
                      <UserCheck className="w-3 h-3 text-emerald-400" />
                      <span>{alarm.technicianComment}</span>
                    </div>
                  )}
                </div>

                <div>
                  {!alarm.isAcknowledged ? (
                    <button
                      onClick={() => onAcknowledgeAlarm(alarm.id)}
                      className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Acquitter</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="w-3 h-3" />
                      <span>Acquitté</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* GMAO Logs Tab Content */}
      {activeTab === 'gmao' && (
        <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl bg-[#0f1f33]/70 border border-slate-800 text-xs flex flex-col gap-1.5 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400 font-semibold">{log.id}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase">
                    {log.category}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[10px]">
                  <Clock className="w-3 h-3" />
                  <span>{log.timestamp}</span>
                </div>
              </div>

              <p className="text-slate-200 text-xs leading-relaxed">
                {log.summary}
              </p>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3 text-[#0072CE]" />
                  <span>Auteur : {log.author}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold">Validé GMAO</span>
                  {onDeleteLog !== undefined && (
                    <button
                      onClick={() => onDeleteLog(log.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Supprimer ce bon d'intervention"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
