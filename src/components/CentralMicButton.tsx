import React from "react";
import { Mic, MicOff, Power, Loader2, Volume2, Sparkles } from "lucide-react";
import { LiveSessionState, AuraTheme } from "../types";
import { AURA_THEMES } from "../utils/theme";

interface CentralMicButtonProps {
  state: LiveSessionState;
  currentTheme: AuraTheme;
  onToggle: () => void;
  audioLevel: number;
}

export const CentralMicButton: React.FC<CentralMicButtonProps> = ({
  state,
  currentTheme,
  onToggle,
  audioLevel,
}) => {
  const themeConfig = AURA_THEMES[currentTheme] || AURA_THEMES.neon_rose;

  const getButtonContent = () => {
    switch (state) {
      case "disconnected":
        return {
          icon: <Power className="w-8 h-8 sm:w-10 sm:h-10 text-white/80 transition-transform group-hover:scale-110" />,
          title: "TALK TO MAHI",
          subtitle: "Tap to connect voice link",
          glowColor: themeConfig.glow,
          borderStyle: "border-white/20 hover:border-white/40",
          scaleStyle: "hover:scale-105 active:scale-95",
          ringEffect: "group-hover:ring-8 group-hover:ring-white/5",
        };
      case "connecting":
        return {
          icon: <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 animate-spin" />,
          title: "CONNECTING...",
          subtitle: "Waking up Mahi's neural network",
          glowColor: "rgba(245, 158, 11, 0.5)",
          borderStyle: "border-amber-500/50",
          scaleStyle: "scale-100",
          ringEffect: "animate-pulse ring-8 ring-amber-500/20",
        };
      case "listening":
        return {
          icon: (
            <div className="relative">
              <Mic className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-300" />
              {audioLevel > 0.05 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
              )}
            </div>
          ),
          title: "LISTENING TO YOU",
          subtitle: "Speak naturally · Tap to end session",
          glowColor: "rgba(16, 185, 129, 0.5)",
          borderStyle: "border-emerald-500/60 shadow-emerald-500/20",
          scaleStyle: "hover:scale-105 active:scale-95",
          ringEffect: "ring-8 ring-emerald-500/20 animate-pulse",
        };
      case "speaking":
        return {
          icon: (
            <div className="relative flex items-center justify-center">
              <Volume2 className="w-8 h-8 sm:w-10 sm:h-10 text-rose-300 animate-pulse" />
              <Sparkles className="w-3.5 h-3.5 text-rose-200 absolute -top-2 -right-2 animate-bounce" />
            </div>
          ),
          title: "MAHI IS SPEAKING",
          subtitle: "Speak anytime to interrupt · Tap to disconnect",
          glowColor: themeConfig.glow,
          borderStyle: "border-rose-500/70 shadow-rose-500/30",
          scaleStyle: "hover:scale-105 active:scale-95",
          ringEffect: "ring-10 ring-rose-500/30 animate-pulse",
        };
    }
  };

  const btn = getButtonContent();

  return (
    <div className="relative z-20 flex flex-col items-center justify-center select-none">
      {/* Interactive Core Button */}
      <button
        id="btn-central-mic"
        onClick={onToggle}
        aria-label={btn.title}
        className={`group relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-2xl backdrop-blur-xl ${btn.borderStyle} ${btn.scaleStyle} ${btn.ringEffect} border-2`}
        style={{
          background:
            state === "disconnected"
              ? "radial-gradient(circle at 35% 35%, #27272a 0%, #09090b 100%)"
              : state === "listening"
              ? "radial-gradient(circle at 35% 35%, #064e3b 0%, #022c22 100%)"
              : state === "speaking"
              ? `radial-gradient(circle at 35% 35%, ${themeConfig.primary}40 0%, #09090b 100%)`
              : "radial-gradient(circle at 35% 35%, #451a03 0%, #09090b 100%)",
          boxShadow: `0 0 35px ${btn.glowColor}, inset 0 0 20px rgba(255,255,255,0.1)`,
          transform:
            state === "speaking"
              ? `scale(${1 + audioLevel * 0.15})`
              : state === "listening"
              ? `scale(${1 + audioLevel * 0.1})`
              : undefined,
        }}
      >
        {/* Dynamic inner neon ring */}
        <div
          className="absolute inset-1 rounded-full border border-white/10 pointer-events-none transition-all duration-500"
          style={{
            borderColor:
              state === "speaking"
                ? `${themeConfig.primary}80`
                : state === "listening"
                ? "#10b98180"
                : "rgba(255, 255, 255, 0.08)",
          }}
        />

        {/* Central Icon */}
        <div className="relative z-10 flex items-center justify-center">
          {btn.icon}
        </div>
      </button>

      {/* Primary Action Title & Status Line */}
      <div className="mt-6 text-center max-w-xs px-4">
        <div className="flex items-center justify-center gap-2">
          <span
            className="text-xs sm:text-sm font-semibold tracking-widest uppercase font-mono transition-colors"
            style={{
              color:
                state === "speaking"
                  ? themeConfig.secondary
                  : state === "listening"
                  ? "#6ee7b7"
                  : state === "connecting"
                  ? "#fbbf24"
                  : "#a1a1aa",
            }}
          >
            {btn.title}
          </span>
        </div>
        <p className="text-xs text-white/50 mt-1 font-sans tracking-wide">
          {btn.subtitle}
        </p>
      </div>
    </div>
  );
};
