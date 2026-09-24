/**
 * Audio streaming manager for browser microphone capture and real-time PCM playback.
 * Configured for Gemini Live API:
 * - Input: 16kHz 16-bit linear PCM mono (Base64)
 * - Output: 24kHz 16-bit linear PCM mono (Base64)
 */

/**
 * Options for initializing the audio manager.
 */
export interface IAudioManagerOptions {
  readonly onInputAudioChunk: (base64Chunk: string) => void;
  readonly onSpeakingStatusChange?: (isSpeaking: boolean) => void;
}

/**
 * Audio visualizer waveform metrics.
 */
export interface IAudioVisualizerData {
  readonly inputVolume: number;
  readonly outputVolume: number;
}

/**
 * Converts a Float32Array of audio samples to a 16-bit signed PCM ArrayBuffer.
 * @param input Float32 audio samples in range [-1.0, 1.0]
 * @returns Int16Array containing raw PCM bytes
 */
export const floatTo16BitPCM = (input: Float32Array): Int16Array => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
};

/**
 * Converts an ArrayBufferLike to a Base64 string.
 * @param buffer Buffer to convert
 * @returns Base64 encoded string
 */
export const arrayBufferToBase64 = (buffer: ArrayBufferLike): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

/**
 * Converts a Base64 string of raw PCM 16-bit data to a Float32Array for AudioBuffer playback.
 * @param base64 Base64 encoded PCM 16-bit data
 * @returns Float32Array in range [-1.0, 1.0]
 */
export const base64ToFloat32PCM = (base64: string): Float32Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i += 1) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
};

/**
 * High-performance audio streaming manager class.
 */
export class AudioManager {
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scheduledPlaybackTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private inputVolumeLevel = 0;
  private outputVolumeLevel = 0;
  private isCapturing = false;
  private readonly options: IAudioManagerOptions;

  /**
   * Initializes the audio manager with chunk callbacks.
   * @param options Callback options
   */
  public constructor(options: IAudioManagerOptions) {
    this.options = options;
  }

  /**
   * Starts capturing microphone audio and begins streaming 16kHz PCM chunks.
   */
  public async startCapture(): Promise<void> {
    if (this.isCapturing) {
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Browser Web Audio input context, sampleRate 16kHz matches Gemini Live specification
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.inputContext = new AudioCtx({ sampleRate: 16000 });
      await this.inputContext.resume();

      this.mediaStreamSource = this.inputContext.createMediaStreamSource(this.mediaStream);

      // ScriptProcessor buffer size: 4096 samples at 16kHz is ~256ms per audio chunk
      const bufferSize = 4096;
      this.scriptProcessor = this.inputContext.createScriptProcessor(bufferSize, 1, 1);

      this.scriptProcessor.onaudioprocess = (e: AudioProcessingEvent): void => {
        if (!this.isCapturing) {
          return;
        }

        const channelData = e.inputBuffer.getChannelData(0);

        // Compute volume level for visualizer
        let sum = 0;
        for (let i = 0; i < channelData.length; i += 1) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        this.inputVolumeLevel = Math.min(1, rms * 5);

        // Convert to 16-bit signed PCM
        const pcm16 = floatTo16BitPCM(channelData);
        const base64Chunk = arrayBufferToBase64(pcm16.buffer);

        this.options.onInputAudioChunk(base64Chunk);
      };

      this.mediaStreamSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputContext.destination);
      this.isCapturing = true;
    } catch (err) {
      console.error('[AudioManager] Failed to access microphone:', err);
      throw err;
    }
  }

  /**
   * Stops microphone audio capture and releases device resources.
   */
  public stopCapture(): void {
    this.isCapturing = false;
    this.inputVolumeLevel = 0;

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputContext && this.inputContext.state !== 'closed') {
      void this.inputContext.close();
      this.inputContext = null;
    }
  }

  /**
   * Queues and plays a 24kHz raw PCM Base64 chunk received from Gemini Live API.
   * @param base64PcmChunk Base64 encoded 24kHz 16-bit PCM chunk
   */
  public playAudioChunk(base64PcmChunk: string): void {
    if (!base64PcmChunk) {
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!this.outputContext || this.outputContext.state === 'closed') {
      this.outputContext = new AudioCtx({ sampleRate: 24000 });
      this.scheduledPlaybackTime = 0;
    }

    if (this.outputContext.state === 'suspended') {
      void this.outputContext.resume();
    }

    const floatSamples = base64ToFloat32PCM(base64PcmChunk);
    if (floatSamples.length === 0) {
      return;
    }

    // Compute speaker volume for visualizer
    let sum = 0;
    for (let i = 0; i < floatSamples.length; i += 1) {
      sum += floatSamples[i] * floatSamples[i];
    }
    const rms = Math.sqrt(sum / floatSamples.length);
    this.outputVolumeLevel = Math.min(1, rms * 4);

    const audioBuffer = this.outputContext.createBuffer(1, floatSamples.length, 24000);
    audioBuffer.getChannelData(0).set(floatSamples);

    const source = this.outputContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputContext.destination);

    const currentTime = this.outputContext.currentTime;
    const startTime = Math.max(currentTime, this.scheduledPlaybackTime);
    source.start(startTime);
    this.scheduledPlaybackTime = startTime + audioBuffer.duration;

    this.activeSources.push(source);
    if (this.options.onSpeakingStatusChange) {
      this.options.onSpeakingStatusChange(true);
    }

    source.onended = (): void => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0) {
        this.outputVolumeLevel = 0;
        if (this.options.onSpeakingStatusChange) {
          this.options.onSpeakingStatusChange(false);
        }
      }
    };
  }

  /**
   * Immediately clears playback queue on model interruption (barge-in).
   */
  public clearPlaybackQueue(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore if already stopped
      }
    });
    this.activeSources = [];
    this.scheduledPlaybackTime = 0;
    this.outputVolumeLevel = 0;

    if (this.options.onSpeakingStatusChange) {
      this.options.onSpeakingStatusChange(false);
    }
  }

  /**
   * Retrieves current volume levels for audio visualizers.
   * @returns Object with input and output normalized volume (0.0 to 1.0)
   */
  public getVisualizerData(): IAudioVisualizerData {
    return {
      inputVolume: this.inputVolumeLevel,
      outputVolume: this.outputVolumeLevel
    };
  }

  /**
   * Releases all audio resources and closes contexts.
   */
  public dispose(): void {
    this.stopCapture();
    this.clearPlaybackQueue();

    if (this.outputContext && this.outputContext.state !== 'closed') {
      void this.outputContext.close();
      this.outputContext = null;
    }
  }
}
