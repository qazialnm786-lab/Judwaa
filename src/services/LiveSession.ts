import { AudioStreamer } from "../audio/AudioStreamer";
import { LiveSessionState, ToolCallEvent } from "../types";

export interface LiveSessionCallbacks {
  onStateChange?: (state: LiveSessionState) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onError?: (error: string) => void;
  onInterrupted?: () => void;
  onTurnComplete?: () => void;
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private audioStreamer: AudioStreamer;
  private state: LiveSessionState = "disconnected";
  private callbacks: LiveSessionCallbacks = {};
  private selectedVoice: string = "Kore";
  private isIntentionalDisconnect = false;

  constructor(audioStreamer: AudioStreamer, callbacks: LiveSessionCallbacks = {}) {
    this.audioStreamer = audioStreamer;
    this.callbacks = callbacks;

    // Listen to streamer speaking state
    this.audioStreamer.setSpeakingCallback((isSpeaking) => {
      if (this.state === "disconnected" || this.state === "connecting") return;
      if (isSpeaking) {
        this.setState("speaking");
      } else {
        this.setState("listening");
      }
    });
  }

  public getState(): LiveSessionState {
    return this.state;
  }

  public setVoice(voice: string) {
    this.selectedVoice = voice;
  }

  public updateCallbacks(callbacks: Partial<LiveSessionCallbacks>) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setState(newState: LiveSessionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.callbacks.onStateChange?.(newState);
  }

  /**
   * Connect to backend Gemini Live API bridge & start mic streaming
   */
  public async connect(): Promise<void> {
    if (this.state !== "disconnected") {
      this.disconnect();
    }

    this.isIntentionalDisconnect = false;
    this.setState("connecting");

    try {
      // 1. Establish WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws?voice=${encodeURIComponent(
        this.selectedVoice
      )}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        console.log("WebSocket connection to Gemini Live established");
        // Start streaming mic audio to backend
        try {
          await this.audioStreamer.startRecording((pcm16Base64) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(
                JSON.stringify({
                  type: "realtime_audio",
                  audio: pcm16Base64,
                })
              );
            }
          });
          // Transition to listening once mic is live
          this.setState("listening");
        } catch (micErr: any) {
          console.error("Microphone access failed:", micErr);
          this.callbacks.onError?.(
            micErr?.message || "Microphone access was denied or is unavailable."
          );
          this.disconnect();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "session_connecting") {
            this.setState("connecting");
          } else if (msg.type === "session_ready") {
            if (this.state === "connecting") {
              this.setState("listening");
            }
          } else if (msg.type === "audio" && msg.audio) {
            // Received response audio from model (24kHz PCM16)
            this.audioStreamer.playAudioChunk(msg.audio);
          } else if (msg.type === "interrupted") {
            // User interrupted the model while it was speaking
            console.log("Interruption detected: flushing audio queue");
            this.audioStreamer.stopAllPlayback();
            this.setState("listening");
            this.callbacks.onInterrupted?.();
          } else if (msg.type === "turn_complete") {
            this.callbacks.onTurnComplete?.();
          } else if (msg.type === "tool_call") {
            console.log("Tool call received:", msg.name, msg.args);
            const toolEvent: ToolCallEvent = {
              id: msg.id,
              name: msg.name,
              args: msg.args || {},
              timestamp: Date.now(),
            };
            this.callbacks.onToolCall?.(toolEvent);
          } else if (msg.type === "error") {
            console.error("Server reported Live session error:", msg.message);
            this.callbacks.onError?.(msg.message);
          }
        } catch (err) {
          console.error("Failed to parse message from WebSocket:", err);
        }
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket transport error:", err);
        if (!this.isIntentionalDisconnect) {
          this.callbacks.onError?.("Connection to voice assistant server failed.");
          this.disconnect();
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket connection closed");
        if (!this.isIntentionalDisconnect && this.state !== "disconnected") {
          this.disconnect();
        }
      };
    } catch (err: any) {
      console.error("Failed to initiate LiveSession:", err);
      this.callbacks.onError?.(err?.message || "Could not connect to voice assistant.");
      this.disconnect();
    }
  }

  /**
   * Disconnect live session and release mic and audio
   */
  public disconnect(): void {
    this.isIntentionalDisconnect = true;

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "stop_session" }));
        }
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }

    this.audioStreamer.stopRecording();
    this.audioStreamer.stopAllPlayback();
    this.setState("disconnected");
  }

  /**
   * Clean up everything
   */
  public destroy(): void {
    this.disconnect();
    this.audioStreamer.destroy();
  }
}
