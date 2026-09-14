import React from "react";
import { Sparkles, Volume2, Mic, Settings, Radio } from "lucide-react";
import { LiveSessionState, AuraTheme } from "../types";
import { AURA_THEMES, AVAILABLE_VOICES } from "../utils/theme";

interface HUDHeaderProps {
  state: LiveSessionState;
  currentTheme: AuraTheme;
  onThemeChange: (theme: AuraTheme) => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  audioLevel: number;
}

export const HUDHeader: React.FC<HUDHeaderProps> = ({
  state,
  currentTheme,
  onThemeChange,
  selectedVoice,
  onVoiceChange,
  audioLevel,
}) => {
  const [showSettings, setShowSettings] = React.useState(false);
  const themeConfig = AURA_THEMES[currentTheme] || AURA_THEMES.neon_rose;

  const getStatusBadge = () => {
    switch (state) {
      case "disconnected":
        return {
          label: "STANDBY",
          color: "text-zinc-400 bg-zinc-900/80 border-zinc-800",
          dotColor: "bg-zinc-500",
          ping: false,
        };
      case "connecting":
        return {
          label: "SYNCING NEURAL LINK...",
          color: "text-amber-400 bg-amber-950/40 border-amber-800/60",
          dotColor: "bg-amber-400",
          ping: true,
        };
      case "listening":
        return {
          label: "ALL EARS, BABE",
          color: "text-emerald-400 bg-emerald-950/40 border-emerald-700/60",
          dotColor: "bg-emerald-400",
          ping: true,
        };
      case "speaking":
        return {
          label: "MAHI SPEAKING",
          color: "text-rose-300 bg-rose-950/40 border-rose-700/60",
          dotColor: "bg-rose-400",
          ping: true,
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <header className="relative z-30 w-full px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-black/40">
      {/* Brand & Codename */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center border font-bold text-xs shadow-lg transition-all duration-500"
          style={{
            borderColor: themeConfig.primary,
            backgroundColor: `${themeConfig.primary}15`,
            boxShadow: `0 0 15px ${themeConfig.glow}`,
            color: themeConfig.secondary,
          }}
        >
          M
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-wider text-white flex items-center gap-1.5">
              MAHI
              <span className="text-[10px] tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-mono">
                VOICE-01
              </span>
            </h1>
          </div>
          <p className="text-[11px] text-white/40 tracking-wide font-mono hidden sm:block">
            REAL-TIME NEURAL VOICE // GEMINI 3.1 LIVE
          </p>
        </div>
      </div>

      {/* Middle: Live State Pill */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono tracking-wider transition-all duration-300 ${badge.color}`}
        >
          <span className="relative flex h-2 w-2">
            {badge.ping && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${badge.dotColor}`}
              />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${badge.dotColor}`}
            />
          </span>
          <span className="uppercase text-[11px] font-medium">{badge.label}</span>
        </div>

        {/* Small Audio level activity bar */}
        {state !== "disconnected" && (
          <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            {state === "speaking" ? (
              <Volume2 className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${Math.max(10, Math.min(100, audioLevel * 100))}%`,
                  backgroundColor:
                    state === "speaking" ? themeConfig.primary : "#34d399",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Settings toggle */}
      <div className="flex items-center gap-2">
        <button
          id="btn-settings"
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all relative"
          title="Aura & Voice Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: themeConfig.primary }}
          />
        </button>
      </div>

      {/* Settings Popover */}
      {showSettings && (
        <div
          id="settings-panel"
          className="absolute top-16 right-4 sm:right-6 w-80 rounded-2xl border border-white/10 bg-zinc-950/95 backdrop-blur-xl p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: themeConfig.primary }} />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                Mahi Calibration
              </h2>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="text-white/40 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          {/* Aura Theme Selection */}
          <div className="mb-4">
            <label className="text-[11px] font-mono text-white/60 uppercase tracking-wider block mb-2">
              Aura Energy
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {(Object.keys(AURA_THEMES) as AuraTheme[]).map((themeKey) => {
                const item = AURA_THEMES[themeKey];
                const isSelected = currentTheme === themeKey;
                return (
                  <button
                    key={themeKey}
                    onClick={() => onThemeChange(themeKey)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all border ${
                      isSelected
                        ? "bg-white/10 border-white/30 text-white"
                        : "bg-white/5 border-transparent text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: item.primary,
                          boxShadow: isSelected ? `0 0 8px ${item.glow}` : "none",
                        }}
                      />
                      <div>
                        <div className="text-xs font-medium">{item.name}</div>
                        <div className="text-[10px] text-white/40">{item.subtitle}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/90">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Model Selection */}
          <div>
            <label className="text-[11px] font-mono text-white/60 uppercase tracking-wider block mb-2">
              Voice Preset
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {AVAILABLE_VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onVoiceChange(v.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all border ${
                      isSelected
                        ? "bg-white/10 border-white/30 text-white"
                        : "bg-white/5 border-transparent text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5" style={{ color: isSelected ? themeConfig.primary : "#71717a" }} />
                      <div>
                        <div className="text-xs font-medium flex items-center gap-1.5">
                          {v.name}
                          {v.recommended && (
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.2 rounded font-mono">
                              BEST
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/40">{v.persona}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 text-[10px] font-mono text-white/40 text-center">
            Zero Text Latency // Pure PCM Audio Streaming
          </div>
        </div>
      )}
    </header>
  );
};
