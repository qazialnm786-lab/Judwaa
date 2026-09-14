import React, { useEffect, useState } from "react";
import { ExternalLink, Search, Clock, Palette, CheckCircle, X } from "lucide-react";
import { ToolCallEvent, AuraTheme, ActiveTimer } from "../types";
import { AURA_THEMES } from "../utils/theme";

interface ActiveToolsHUDProps {
  lastToolCall: ToolCallEvent | null;
  onClearToolCall: () => void;
  currentTheme: AuraTheme;
  activeTimers: ActiveTimer[];
  onDismissTimer: (timerId: string) => void;
}

export const ActiveToolsHUD: React.FC<ActiveToolsHUDProps> = ({
  lastToolCall,
  onClearToolCall,
  currentTheme,
  activeTimers,
  onDismissTimer,
}) => {
  const themeConfig = AURA_THEMES[currentTheme] || AURA_THEMES.neon_rose;
  const [visibleCall, setVisibleCall] = useState<ToolCallEvent | null>(null);

  useEffect(() => {
    if (lastToolCall) {
      setVisibleCall(lastToolCall);
      const timer = setTimeout(() => {
        setVisibleCall(null);
        onClearToolCall();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [lastToolCall, onClearToolCall]);

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-40 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {/* Active Timers Display */}
      {activeTimers.map((timer) => {
        const mins = Math.floor(timer.remainingSeconds / 60);
        const secs = timer.remainingSeconds % 60;
        const formatted = `${mins.toString().padStart(2, "0")}:${secs
          .toString()
          .padStart(2, "0")}`;
        const pct =
          timer.totalSeconds > 0
            ? Math.round((timer.remainingSeconds / timer.totalSeconds) * 100)
            : 0;

        return (
          <div
            key={timer.id}
            className="pointer-events-auto flex items-center justify-between p-3.5 rounded-xl border border-white/15 bg-zinc-950/90 backdrop-blur-xl shadow-2xl animate-in slide-in-from-top-4 duration-300"
            style={{
              boxShadow: `0 8px 30px ${themeConfig.glow}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center border"
                style={{
                  borderColor: themeConfig.primary,
                  backgroundColor: `${themeConfig.primary}20`,
                  color: themeConfig.secondary,
                }}
              >
                <Clock className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white tracking-wide">
                  {timer.label || "Timer"}
                </div>
                <div className="text-sm font-mono font-bold" style={{ color: themeConfig.secondary }}>
                  {formatted}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-12 bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: themeConfig.primary,
                  }}
                />
              </div>
              <button
                onClick={() => onDismissTimer(timer.id)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Dismiss Timer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Floating Tool Execution Toast */}
      {visibleCall && (
        <div
          className="pointer-events-auto p-4 rounded-2xl border border-white/20 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300"
          style={{
            boxShadow: `0 10px 40px ${themeConfig.glow}`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0"
                style={{
                  borderColor: themeConfig.primary,
                  backgroundColor: `${themeConfig.primary}20`,
                  color: themeConfig.secondary,
                }}
              >
                {visibleCall.name === "openWebsite" ? (
                  <ExternalLink className="w-5 h-5" />
                ) : visibleCall.name === "searchWeb" ? (
                  <Search className="w-5 h-5" />
                ) : visibleCall.name === "changeAuraTheme" ? (
                  <Palette className="w-5 h-5" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.5 rounded uppercase bg-white/10 text-white/80">
                    ACTION EXECUTED
                  </span>
                </div>

                <div className="text-xs font-semibold text-white mt-1">
                  {visibleCall.name === "openWebsite" && (
                    <>Mahi opened {visibleCall.args.target || "Destination"}</>
                  )}
                  {visibleCall.name === "searchWeb" && (
                    <>Mahi searched Google for: "{visibleCall.args.query}"</>
                  )}
                  {visibleCall.name === "changeAuraTheme" && (
                    <>Aura calibrated to {visibleCall.args.theme}</>
                  )}
                  {visibleCall.name === "setCountdownTimer" && (
                    <>Timer started: {visibleCall.args.seconds}s</>
                  )}
                </div>

                {/* If openWebsite, give quick link button */}
                {visibleCall.name === "openWebsite" && visibleCall.args.url && (
                  <a
                    href={visibleCall.args.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all duration-200 border"
                    style={{
                      borderColor: themeConfig.primary,
                      backgroundColor: `${themeConfig.primary}30`,
                    }}
                  >
                    <span>Visit {visibleCall.args.target || "Link"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {visibleCall.name === "searchWeb" && visibleCall.args.query && (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(
                      visibleCall.args.query
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all duration-200 border"
                    style={{
                      borderColor: themeConfig.primary,
                      backgroundColor: `${themeConfig.primary}30`,
                    }}
                  >
                    <span>View Search Results</span>
                    <Search className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setVisibleCall(null);
                onClearToolCall();
              }}
              className="text-white/40 hover:text-white p-1 rounded-md hover:bg-white/10"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
