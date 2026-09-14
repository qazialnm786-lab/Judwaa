export type LiveSessionState = "disconnected" | "connecting" | "listening" | "speaking";

export type AuraTheme =
  | "neon_rose"
  | "cyber_violet"
  | "electric_cyan"
  | "emerald_matrix"
  | "solar_amber";

export interface ToolCallEvent {
  id: string;
  name: string;
  args: Record<string, any>;
  timestamp: number;
  result?: string;
}

export interface ActiveTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
}

export interface AuraThemeConfig {
  id: AuraTheme;
  name: string;
  subtitle: string;
  primary: string;
  secondary: string;
  glow: string;
  gradient: string;
  border: string;
  ring: string;
  bgGlow: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  persona: string;
  recommended?: boolean;
}

export interface AudioFrequencyData {
  micLevel: number;
  speakerLevel: number;
  frequencies: Uint8Array;
}
