/**
 * WebSocket client for the Gemini Live API (gemini-3.8-live)
 * supporting bidirectional audio streaming, real-time transcriptions, and function calling.
 */

import {
  ITranscriptItem,
  IFunctionCallItem,
  IFunctionResponseItem
} from '../types/dalkia.ts';

/**
 * Interface for options passed to GeminiLiveClient.
 */
export interface IGeminiLiveClientOptions {
  readonly apiKey?: string;
  readonly isSimulation?: boolean;
  readonly onTranscript: (transcript: ITranscriptItem) => void;
  readonly onAudioOutput: (base64AudioChunk: string) => void;
  readonly onInterrupted: () => void;
  readonly onToolCall: (call: IFunctionCallItem) => Promise<Record<string, unknown>>;
  readonly onConnectionStatusChange: (status: { isConnected: boolean; isConnecting: boolean; error?: string }) => void;
}

/**
 * Gemini Live API WebSocket service.
 */
export class GeminiLiveClient {
  private socket: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isSimulation = false;
  private options: IGeminiLiveClientOptions;
  private simulatedRecognition: unknown = null;

  /**
   * Constructs a new Gemini Live Client instance.
   * @param options Connection callbacks and options
   */
  public constructor(options: IGeminiLiveClientOptions) {
    this.options = options;
    this.isSimulation = !!options.isSimulation;
  }

  /**
   * Updates options such as API key or simulation flag.
   * @param options Updated partial options
   */
  public updateOptions(options: Partial<IGeminiLiveClientOptions>): void {
    this.options = { ...this.options, ...options };
    if (options.isSimulation !== undefined) {
      this.isSimulation = options.isSimulation;
    }
  }

  /**
   * Establishes the WebSocket connection to Gemini Live API or initiates simulation.
   */
  public async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      return;
    }

    if (this.isSimulation || !this.options.apiKey) {
      this.connectSimulation();
      return;
    }

    this.isConnecting = true;
    this.options.onConnectionStatusChange({ isConnected: false, isConnecting: true });

    try {
      const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.options.apiKey}`;
      this.socket = new WebSocket(endpoint);

      this.socket.onopen = (): void => {
        this.sendSetupMessage();
      };

      this.socket.onmessage = async (event: MessageEvent): Promise<void> => {
        try {
          let rawData = event.data;
          if (rawData instanceof Blob) {
            rawData = await rawData.text();
          }

          const message = JSON.parse(rawData);
          await this.handleServerMessage(message);
        } catch (err) {
          console.error('[GeminiLiveClient] Failed to parse server message:', err);
        }
      };

      this.socket.onerror = (event): void => {
        console.error('[GeminiLiveClient] WebSocket error event:', event);
        this.options.onConnectionStatusChange({
          isConnected: false,
          isConnecting: false,
          error: 'Erreur de connexion WebSocket avec l\'API Gemini Live. Vérifiez la clé API ou basculez en mode Simulation.'
        });
      };

      this.socket.onclose = (event): void => {
        this.isConnected = false;
        this.isConnecting = false;
        this.options.onConnectionStatusChange({
          isConnected: false,
          isConnecting: false,
          error: event.wasClean ? undefined : `Connexion interrompue (Code ${event.code})`
        });
      };
    } catch (err) {
      this.isConnecting = false;
      this.options.onConnectionStatusChange({
        isConnected: false,
        isConnecting: false,
        error: String(err)
      });
    }
  }

  /**
   * Sends the initial session setup configuration with Dalkia tools and system prompt.
   */
  private sendSetupMessage(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const setupPayload = {
      setup: {
        model: 'models/gemini-3.8-live',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede'
              }
            }
          }
        },
        systemInstruction: {
          parts: [
            {
              text: `Tu es Dalkia LiveAssist, l'assistant vocal intelligent d'exploitation et de supervision pour les techniciens de Dalkia (réseaux de chaleur, chaufferies biomasse et centrales thermiques urbaines).
Tu t'adresses au technicien de maintenance en français.
Ton ton est professionnel, technique, concis et réactif.
Tu disposes d'outils pour piloter les équipements de la chaufferie :
- setTemperatureSetpoint(circuit, temperature) pour régler les consignes de départ primaire ou secondaire
- setEquipmentStatus(equipmentId, status, mode, powerLevelPercent) pour allumer, éteindre, moduler ou basculer les chaudières (B1 biomasse, G2 gaz appoint) et pompes (P1, P2)
- acknowledgeAlarm(alarmId, technicianComment) pour acquitter les alarmes actives
- logIntervention(summary, category) pour enregistrer un compte-rendu ou une note dans la GMAO Dalkia
- setEnergyMode(mode) pour changer le profil d'optimisation énergétique (eco, confort, boost, inter-saison)
- getFacilityStatus(scope) pour consulter les mesures clés

RÈGLE ABSOLUE : Dès que le technicien demande une action ou une modification, exécute TOUJOURS l'outil approprié immédiatement, puis confirme vocalement et brièvement le résultat.`
            }
          ]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'setTemperatureSetpoint',
                description: 'Règle la température de consigne en degrés Celsius pour le circuit primaire ou secondaire de la chaufferie',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    circuit: {
                      type: 'STRING',
                      enum: ['primary', 'secondary'],
                      description: 'Le circuit thermique cible (primaire ou secondaire)'
                    },
                    temperature: {
                      type: 'NUMBER',
                      description: 'La température de consigne en degrés Celsius (ex: 80, 72.5)'
                    }
                  },
                  required: ['circuit', 'temperature']
                }
              },
              {
                name: 'setEquipmentStatus',
                description: 'Modifie l\'état, le mode opératoire ou la puissance d\'un équipement (chaudière biomasse B1, chaudière gaz G2, pompe primaire P1, etc.)',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    equipmentId: {
                      type: 'STRING',
                      description: 'Identifiant ou nom de l\'équipement (ex: B1, G2, P1, P2)'
                    },
                    status: {
                      type: 'STRING',
                      enum: ['on', 'off', 'standby', 'fault'],
                      description: 'Nouvel état opérationnel'
                    },
                    mode: {
                      type: 'STRING',
                      enum: ['auto', 'manual', 'eco', 'backup'],
                      description: 'Mode de conduite'
                    },
                    powerLevelPercent: {
                      type: 'NUMBER',
                      description: 'Puissance de consigne en pourcentage (0 à 100)'
                    }
                  },
                  required: ['equipmentId', 'status']
                }
              },
              {
                name: 'acknowledgeAlarm',
                description: 'Acquitte une alarme d\'exploitation active avec justification éventuelle du technicien',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    alarmId: {
                      type: 'STRING',
                      description: 'Identifiant de l\'alarme (ex: ALM-102) ou "all" pour toutes les alarmes'
                    },
                    technicianComment: {
                      type: 'STRING',
                      description: 'Commentaire ou constatation du technicien'
                    }
                  },
                  required: ['alarmId']
                }
              },
              {
                name: 'logIntervention',
                description: 'Enregistre une note ou un rapport d\'intervention dans le journal de maintenance GMAO Dalkia',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    summary: {
                      type: 'STRING',
                      description: 'Description détaillée de l\'action ou de la constatation technique'
                    },
                    category: {
                      type: 'STRING',
                      enum: ['preventive', 'curative', 'consigne', 'controle_visuel'],
                      description: 'Catégorie d\'intervention'
                    }
                  },
                  required: ['summary']
                }
              },
              {
                name: 'setEnergyMode',
                description: 'Bascule le mode d\'efficacité énergétique global de la centrale (eco, confort, boost, inter-saison)',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    mode: {
                      type: 'STRING',
                      enum: ['eco', 'confort', 'boost', 'inter-saison'],
                      description: 'Mode d\'optimisation énergétique'
                    }
                  },
                  required: ['mode']
                }
              },
              {
                name: 'getFacilityStatus',
                description: 'Interroge l\'état synthétique de l\'installation Dalkia (températures, puissance, rendement, alertes)',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    scope: {
                      type: 'STRING',
                      description: 'Périmètre de l\'état demandé (ex: all, boilers, alarms, temperatures)'
                    }
                  }
                }
              }
            ]
          }
        ],
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };

    this.socket.send(JSON.stringify(setupPayload));
  }

  /**
   * Processes incoming server messages from the Live API WebSocket.
   * @param message Deserialized JSON server message
   */
  private async handleServerMessage(message: Record<string, unknown>): Promise<void> {
    if (message.setupComplete) {
      this.isConnected = true;
      this.isConnecting = false;
      this.options.onConnectionStatusChange({ isConnected: true, isConnecting: false });
      return;
    }

    // Process server content (audio stream, transcriptions, interruptions)
    if (message.serverContent && typeof message.serverContent === 'object') {
      const serverContent = message.serverContent as Record<string, unknown>;

      if (serverContent.interrupted === true) {
        this.options.onInterrupted();
      }

      if (serverContent.inputTranscription && typeof serverContent.inputTranscription === 'object') {
        const trans = serverContent.inputTranscription as { text?: string };
        if (trans.text) {
          this.options.onTranscript({
            id: `usr-${Date.now()}`,
            sender: 'user',
            text: trans.text,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            isFinal: true
          });
        }
      }

      if (serverContent.outputTranscription && typeof serverContent.outputTranscription === 'object') {
        const trans = serverContent.outputTranscription as { text?: string };
        if (trans.text) {
          this.options.onTranscript({
            id: `gem-${Date.now()}`,
            sender: 'assistant',
            text: trans.text,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            isFinal: true
          });
        }
      }

      if (serverContent.modelTurn && typeof serverContent.modelTurn === 'object') {
        const modelTurn = serverContent.modelTurn as { parts?: Array<{ inlineData?: { data?: string } }> };
        if (Array.isArray(modelTurn.parts)) {
          for (const part of modelTurn.parts) {
            if (part.inlineData && part.inlineData.data) {
              this.options.onAudioOutput(part.inlineData.data);
            }
          }
        }
      }
    }

    // Process tool calls (Function Calling)
    if (message.toolCall && typeof message.toolCall === 'object') {
      const toolCall = message.toolCall as { functionCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }> };
      if (Array.isArray(toolCall.functionCalls) && toolCall.functionCalls.length > 0) {
        const functionResponses: IFunctionResponseItem[] = [];

        for (const fc of toolCall.functionCalls) {
          try {
            const result = await this.options.onToolCall(fc);
            functionResponses.push({
              id: fc.id,
              name: fc.name,
              response: result
            });
          } catch (err) {
            functionResponses.push({
              id: fc.id,
              name: fc.name,
              response: { status: 'error', message: String(err) }
            });
          }
        }

        this.sendToolResponse(functionResponses);
      }
    }
  }

  /**
   * Sends the tool responses back to Gemini Live API.
   * @param functionResponses Array of function responses matched by ID
   */
  public sendToolResponse(functionResponses: IFunctionResponseItem[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload = {
      toolResponse: {
        functionResponses: functionResponses.map((item) => ({
          id: item.id,
          name: item.name,
          response: item.response
        }))
      }
    };

    this.socket.send(JSON.stringify(payload));
  }

  /**
   * Sends raw 16kHz PCM audio chunk to the Gemini Live session.
   * @param base64AudioChunk Base64 encoded 16-bit PCM chunk
   */
  public sendRealtimeAudio(base64AudioChunk: string): void {
    if (this.isSimulation) {
      // In simulation mode, microphone audio is handled via Web Speech or simulated parser
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isConnected) {
      return;
    }

    const payload = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64AudioChunk
        }
      }
    };

    this.socket.send(JSON.stringify(payload));
  }

  /**
   * Disconnects the WebSocket and cleans up resources.
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.stopSimulation();
    this.isConnected = false;
    this.isConnecting = false;
    this.options.onConnectionStatusChange({ isConnected: false, isConnecting: false });
  }

  // ==========================================
  // SIMULATION MODE (Fallback and interactive test)
  // ==========================================

  /**
   * Starts simulation mode with Web Speech Recognition or intent synthesis.
   */
  private connectSimulation(): void {
    this.isConnecting = true;
    this.options.onConnectionStatusChange({ isConnected: false, isConnecting: true });

    setTimeout(() => {
      this.isConnected = true;
      this.isConnecting = false;
      this.options.onConnectionStatusChange({ isConnected: true, isConnecting: false });

      this.options.onTranscript({
        id: `sys-${Date.now()}`,
        sender: 'system',
        text: 'Mode Simulation Dalkia LiveAssist activé. Vous pouvez parler au micro ou utiliser les commandes rapides ci-dessous.',
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isFinal: true
      });

      this.setupWebSpeechRecognition();
    }, 400);
  }

  /**
   * Sets up browser Web Speech API for simulation recognition when Gemini API key is not present.
   */
  private setupWebSpeechRecognition(): void {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    try {
      const recognition = new SpeechRecognition() as {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void;
        onerror: (err: unknown) => void;
        start: () => void;
        stop: () => void;
      };

      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'fr-FR';

      recognition.onresult = async (event): Promise<void> => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult && lastResult[0]) {
          const spokenText = lastResult[0].transcript.trim();
          await this.processSimulatedSpokenText(spokenText);
        }
      };

      recognition.start();
      this.simulatedRecognition = recognition;
    } catch (err) {
      console.warn('[GeminiLiveClient] Web Speech API unavailable in simulation:', err);
    }
  }

  /**
   * Processes a simulated text command, extracts intent, triggers tools, and speaks the response.
   * @param text Spoken or typed phrase
   */
  public async processSimulatedSpokenText(text: string): Promise<void> {
    this.options.onTranscript({
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isFinal: true
    });

    const lower = text.toLowerCase();
    let responseText = 'Instruction bien reçue.';

    // Intent 1: Consigne de température
    if (lower.includes('consigne') || lower.includes('température') || lower.includes('degré') || lower.includes('régler') || lower.includes('met')) {
      const match = lower.match(/(\d+([.,]\d+)?)/);
      const tempValue = match ? parseFloat(match[1].replace(',', '.')) : 78;
      const circuit = lower.includes('secondaire') ? 'secondary' : 'primary';

      await this.options.onToolCall({
        id: `sim-call-${Date.now()}`,
        name: 'setTemperatureSetpoint',
        args: { circuit, temperature: tempValue }
      });

      responseText = `Consigne du circuit ${circuit === 'primary' ? 'primaire' : 'secondaire'} ajustée à ${tempValue}°C. Paramètre transmis aux régulateurs Dalkia.`;
    }
    // Intent 2: Allumer / Démarrer équipement
    else if (lower.includes('démarre') || lower.includes('allume') || lower.includes('active') || lower.includes('lance')) {
      let eqId = 'G2';
      if (lower.includes('biomasse') || lower.includes('b1')) {
        eqId = 'B1';
      } else if (lower.includes('pompe') && (lower.includes('p1') || lower.includes('primaire'))) {
        eqId = 'P1';
      } else if (lower.includes('pompe') && (lower.includes('p2') || lower.includes('secondaire'))) {
        eqId = 'P2';
      }

      await this.options.onToolCall({
        id: `sim-call-${Date.now()}`,
        name: 'setEquipmentStatus',
        args: { equipmentId: eqId, status: 'on', mode: 'auto', powerLevelPercent: 85 }
      });

      responseText = `Équipement ${eqId} démarré avec succès. Montée en régime vers 85% de charge.`;
    }
    // Intent 3: Arrêter équipement
    else if (lower.includes('arrête') || lower.includes('stoppe') || lower.includes('coupe') || lower.includes('veille')) {
      let eqId = 'G2';
      if (lower.includes('biomasse') || lower.includes('b1')) {
        eqId = 'B1';
      }

      await this.options.onToolCall({
        id: `sim-call-${Date.now()}`,
        name: 'setEquipmentStatus',
        args: { equipmentId: eqId, status: 'standby', mode: 'backup', powerLevelPercent: 0 }
      });

      responseText = `Équipement ${eqId} basculé en veille de secours.`;
    }
    // Intent 4: Acquitter les alarmes
    else if (lower.includes('acquitte') || lower.includes('alarme') || lower.includes('alerte')) {
      await this.options.onToolCall({
        id: `sim-call-${Date.now()}`,
        name: 'acknowledgeAlarm',
        args: { alarmId: 'all', technicianComment: 'Vérification et acquittement vocal par le technicien Dalkia' }
      });

      responseText = 'Toutes les alarmes en attente ont été acquittées et validées dans le système.';
    }
    // Intent 5: Mode d'énergie
    else if (lower.includes('mode éco') || lower.includes('eco') || lower.includes('confort') || lower.includes('boost')) {
      const mode = lower.includes('éco') || lower.includes('eco')
        ? 'eco'
        : (lower.includes('boost') ? 'boost' : 'confort');

      await this.options.onToolCall({
        id: `sim-call-${Date.now()}`,
        name: 'setEnergyMode',
        args: { mode }
      });

      responseText = `Mode d'exploitation passé sur ${mode.toUpperCase()}. Les courbes de chauffe ont été recalculées.`;
    }
    // Intent 6: Rapport d'intervention / GMAO
    else if (lower.includes('intervention') || lower.includes('rapport') || lower.includes('note') || lower.includes('purge') || lower.includes('filtre')) {
      await this.options.onToolCall({
        id: `sim-call-${Date.now()}`,
        name: 'logIntervention',
        args: { summary: text, category: 'curative' }
      });

      responseText = `Votre compte-rendu d'intervention a été consigné dans la GMAO Dalkia : "${text}".`;
    } else {
      responseText = `Instruction reçue : "${text}". Tous les paramètres de la chaufferie sont nominaux (Puissance: 14.2 MW, départ primaire: 82.5°C).`;
    }

    // Speak response using SpeechSynthesis in browser
    this.options.onTranscript({
      id: `gem-${Date.now()}`,
      sender: 'assistant',
      text: responseText,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isFinal: true
    });

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(responseText);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  }

  /**
   * Stops simulation recognition.
   */
  private stopSimulation(): void {
    if (this.simulatedRecognition) {
      try {
        (this.simulatedRecognition as { stop: () => void }).stop();
      } catch {
        // Ignore
      }
      this.simulatedRecognition = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
