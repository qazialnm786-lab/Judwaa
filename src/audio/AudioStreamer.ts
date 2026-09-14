/**
 * AudioStreamer manages:
 * 1. Mic capture, downsampling to 16kHz PCM16, base64 encoding.
 * 2. 24kHz PCM16 response playback using Web Audio API buffer scheduling.
 * 3. Real-time audio analysis (RMS & frequencies) for glowing visual states.
 * 4. Rapid interruption handling (instant queue flush and active audio cutoff).
 */

export class AudioStreamer {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private speakerAnalyser: AnalyserNode | null = null;

  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime = 0;
  private onSpeakingChangeCallback: ((isSpeaking: boolean) => void) | null = null;

  private micDataArray = new Uint8Array(64);
  private speakerDataArray = new Uint8Array(64);

  constructor() {
    // Lazily initialized on user interaction to abide by browser audio policies
  }

  public setSpeakingCallback(callback: (isSpeaking: boolean) => void) {
    this.onSpeakingChangeCallback = callback;
  }

  /**
   * Initialize and start capturing microphone input at 16kHz PCM16
   */
  public async startRecording(onAudioChunk: (base64Pcm16: string) => void): Promise<void> {
    this.stopRecording();

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Request input audio context
    this.inputAudioCtx = new AudioContextClass();
    if (this.inputAudioCtx.state === "suspended") {
      await this.inputAudioCtx.resume();
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);

    // Setup input analyzer for live mic waveform visualization
    this.micAnalyser = this.inputAudioCtx.createAnalyser();
    this.micAnalyser.fftSize = 128;
    this.micAnalyser.smoothingTimeConstant = 0.4;
    source.connect(this.micAnalyser);

    // 4096 buffer size gives ~90ms chunks at 44.1/48kHz or ~256ms at 16kHz
    this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

    const inputSampleRate = this.inputAudioCtx.sampleRate;

    this.scriptProcessor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);

      // Downsample to 16kHz if the system AudioContext is running at 44.1k or 48k
      const resampled = this.downsampleTo16kHz(channelData, inputSampleRate);

      // Convert to 16-bit PCM little-endian
      const pcm16Buffer = this.floatTo16BitPCM(resampled);

      // Convert to Base64
      const base64Chunk = this.arrayBufferToBase64(pcm16Buffer);

      onAudioChunk(base64Chunk);
    };

    // Connect source -> scriptProcessor -> muted gain to prevent feedback
    const silentGain = this.inputAudioCtx.createGain();
    silentGain.gain.value = 0;

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(silentGain);
    silentGain.connect(this.inputAudioCtx.destination);
  }

  /**
   * Stop recording and release mic media stream
   */
  public stopRecording(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    this.micAnalyser = null;
  }

  /**
   * Ensure output AudioContext is primed and ready at 24kHz
   */
  private ensureOutputContext(): AudioContext {
    if (!this.outputAudioCtx || this.outputAudioCtx.state === "closed") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });

      this.speakerAnalyser = this.outputAudioCtx.createAnalyser();
      this.speakerAnalyser.fftSize = 128;
      this.speakerAnalyser.smoothingTimeConstant = 0.5;
      this.speakerAnalyser.connect(this.outputAudioCtx.destination);
    }
    if (this.outputAudioCtx.state === "suspended") {
      this.outputAudioCtx.resume().catch(() => {});
    }
    return this.outputAudioCtx;
  }

  /**
   * Queue and play 24kHz raw PCM16 audio received from Gemini Live API
   */
  public playAudioChunk(base64Pcm16: string): void {
    const ctx = this.ensureOutputContext();
    const float32 = this.base64ToFloat32(base64Pcm16);

    if (float32.length === 0) return;

    // Create 24kHz mono audio buffer
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    if (this.speakerAnalyser) {
      source.connect(this.speakerAnalyser);
    } else {
      source.connect(ctx.destination);
    }

    const currentTime = ctx.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;

    this.activeSources.add(source);

    if (this.onSpeakingChangeCallback && this.activeSources.size > 0) {
      this.onSpeakingChangeCallback(true);
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        // Queue has emptied
        this.nextStartTime = 0;
        if (this.onSpeakingChangeCallback) {
          this.onSpeakingChangeCallback(false);
        }
      }
    };
  }

  /**
   * Immediately cut off all audio on user interruption
   */
  public stopAllPlayback(): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Source may already be ended
      }
    });
    this.activeSources.clear();
    this.nextStartTime = 0;

    if (this.onSpeakingChangeCallback) {
      this.onSpeakingChangeCallback(false);
    }
  }

  /**
   * Check if model is currently playing speech
   */
  public isSpeaking(): boolean {
    return this.activeSources.size > 0;
  }

  /**
   * Get dynamic microphone volume (0 to 1) for visualization
   */
  public getMicLevel(): number {
    if (!this.micAnalyser) return 0;
    this.micAnalyser.getByteFrequencyData(this.micDataArray);
    let sum = 0;
    for (let i = 0; i < this.micDataArray.length; i++) {
      sum += this.micDataArray[i];
    }
    return Math.min(1, (sum / this.micDataArray.length) / 128);
  }

  /**
   * Get dynamic assistant speaker volume (0 to 1) for visualization
   */
  public getSpeakerLevel(): number {
    if (!this.speakerAnalyser || this.activeSources.size === 0) return 0;
    this.speakerAnalyser.getByteFrequencyData(this.speakerDataArray);
    let sum = 0;
    for (let i = 0; i < this.speakerDataArray.length; i++) {
      sum += this.speakerDataArray[i];
    }
    return Math.min(1, (sum / this.speakerDataArray.length) / 128);
  }

  /**
   * Populate frequency byte data for wave animation
   */
  public getFrequencies(targetArray: Uint8Array): void {
    if (this.isSpeaking() && this.speakerAnalyser) {
      this.speakerAnalyser.getByteFrequencyData(targetArray);
    } else if (this.micAnalyser) {
      this.micAnalyser.getByteFrequencyData(targetArray);
    } else {
      targetArray.fill(0);
    }
  }

  /**
   * Downsamples input audio from audioContext sampleRate to 16000
   */
  private downsampleTo16kHz(buffer: Float32Array, inputRate: number): Float32Array {
    if (inputRate === 16000) return buffer;
    const ratio = inputRate / 16000;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : buffer[offsetBuffer];
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  /**
   * Converts Float32 [-1, 1] array to 16-bit PCM little-endian ArrayBuffer
   */
  private floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  /**
   * Converts 16-bit PCM Base64 to Float32Array [-1, 1] for 24kHz Web Audio playback
   */
  private base64ToFloat32(base64: string): Float32Array {
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const dataView = new DataView(bytes.buffer);
      const numSamples = Math.floor(bytes.byteLength / 2);
      const float32 = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7fff;
      }
      return float32;
    } catch (e) {
      console.error("Failed to decode PCM audio chunk:", e);
      return new Float32Array(0);
    }
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Full cleanup
   */
  public destroy(): void {
    this.stopRecording();
    this.stopAllPlayback();
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }
  }
}
