import React, { useEffect, useRef, useState, useCallback } from "react";
import { LiveSessionState, AuraTheme, ToolCallEvent, ActiveTimer } from "./types";
import { AudioStreamer } from "./audio/AudioStreamer";
import { LiveSession } from "./services/LiveSession";
import { HUDHeader } from "./components/HUDHeader";
import { AuraVisualizer } from "./components/AuraVisualizer";
import { CentralMicButton } from "./components/CentralMicButton";
import { ActiveToolsHUD } from "./components/ActiveToolsHUD";
import { VoicePromptsGuide } from "./components/VoicePromptsGuide";
import { AURA_THEMES } from "./utils/theme";
import { AlertTriangle, Sparkles, VolumeX } from "lucide-react";

export default function App() {
  const [sessionState, setSessionState] = useState<LiveSessionState>("disconnected");
  const [currentTheme, setCurrentTheme] = useState<AuraTheme>("neon_rose");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [lastToolCall, setLastToolCall] = useState<ToolCallEvent | null>(null);
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sassyQuote, setSassyQuote] = useState<string>(
    "I'm all charged up and waiting. Don't leave a girl hanging."
  );

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const animRef = useRef<number | null>(null);

  // Lazy initialize AudioStreamer and LiveSession
  const getAudioStreamer = useCallback(() => {
    if (!audioStreamerRef.current) {
      audioStreamerRef.current = new AudioStreamer();
    }
    return audioStreamerRef.current;
  }, []);

  const handleToolCall = useCallback((event: ToolCallEvent) => {
    console.log("App executing tool:", event);
    setLastToolCall(event);

    if (event.name === "openWebsite" && event.args.url) {
      // Try to open link in new tab safely
      try {
        window.open(event.args.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        console.warn("Popup blocked or not permitted, HUD provides direct link");
      }
    } else if (event.name === "searchWeb" && event.args.query) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        event.args.query
      )}`;
      try {
        window.open(searchUrl, "_blank", "noopener,noreferrer");
      } catch (e) {
        console.warn("Popup blocked");
      }
    } else if (event.name === "changeAuraTheme" && event.args.theme) {
      const targetTheme = event.args.theme as AuraTheme;
      if (AURA_THEMES[targetTheme]) {
        setCurrentTheme(targetTheme);
      }
    } else if (event.name === "setCountdownTimer" && event.args.seconds) {
      const duration = Number(event.args.seconds) || 60;
      const newTimer: ActiveTimer = {
        id: `timer-${Date.now()}`,
        label: event.args.label || "Timer",
        totalSeconds: duration,
        remainingSeconds: duration,
        isRunning: true,
      };
      setActiveTimers((prev) => [...prev, newTimer]);
    }
  }, []);

  // Timer countdown loop
  useEffect(() => {
    if (activeTimers.length === 0) return;

    const interval = setInterval(() => {
      setActiveTimers((prev) =>
        prev
          .map((t) => {
            if (!t.isRunning) return t;
            if (t.remainingSeconds <= 1) {
              return { ...t, remainingSeconds: 0, isRunning: false };
            }
            return { ...t, remainingSeconds: t.remainingSeconds - 1 };
          })
          .filter((t) => t.remainingSeconds > 0 || t.isRunning)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimers.length]);

  const handleDismissTimer = (timerId: string) => {
    setActiveTimers((prev) => prev.filter((t) => t.id !== timerId));
  };

  // Setup LiveSession instance
  const getLiveSession = useCallback(() => {
    if (!liveSessionRef.current) {
      const streamer = getAudioStreamer();
      liveSessionRef.current = new LiveSession(streamer, {
        onStateChange: (newState) => {
          setSessionState(newState);
          if (newState === "connecting") {
            setSassyQuote("Waking up and fixing my hair... one sec.");
          } else if (newState === "listening") {
            setSassyQuote("Go ahead, honey. I'm all ears.");
          } else if (newState === "speaking") {
            setSassyQuote("Listen closely, darling. Wisdom incoming.");
          } else if (newState === "disconnected") {
            setSassyQuote("Power nap time. Tap the core whenever you miss me.");
          }
        },
        onToolCall: handleToolCall,
        onInterrupted: () => {
          setSassyQuote("Ooh, interrupting me? I kind of like the confidence.");
        },
        onError: (err) => {
          setErrorMessage(err);
        },
      });
    }
    return liveSessionRef.current;
  }, [getAudioStreamer, handleToolCall]);

  // Audio level polling loop for responsive visual aura
  useEffect(() => {
    const streamer = audioStreamerRef.current;
    if (!streamer) return;

    const checkAudio = () => {
      if (sessionState === "speaking") {
        setAudioLevel(streamer.getSpeakerLevel());
      } else if (sessionState === "listening") {
        setAudioLevel(streamer.getMicLevel());
      } else {
        setAudioLevel(0);
      }
      animRef.current = requestAnimationFrame(checkAudio);
    };

    animRef.current = requestAnimationFrame(checkAudio);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [sessionState]);

  // Handle voice change
  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    if (liveSessionRef.current) {
      liveSessionRef.current.setVoice(voice);
      // Reconnect if currently active
      if (sessionState !== "disconnected") {
        liveSessionRef.current.disconnect();
        setTimeout(() => {
          liveSessionRef.current?.connect();
        }, 300);
      }
    }
  };

  // Central button click handler
  const handleToggleSession = async () => {
    setErrorMessage(null);
    const session = getLiveSession();

    if (sessionState === "disconnected") {
      session.setVoice(selectedVoice);
      await session.connect();
    } else {
      session.disconnect();
    }
  };

  const getFrequencies = useCallback((targetArray: Uint8Array) => {
    if (audioStreamerRef.current) {
      audioStreamerRef.current.getFrequencies(targetArray);
    }
  }, []);

  const themeConfig = AURA_THEMES[currentTheme] || AURA_THEMES.neon_rose;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white flex flex-col justify-between select-none">
      {/* Background Cybernetic Grid & Radial Glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse at center, ${themeConfig.bgGlow} 0%, transparent 75%)`,
        }}
      />

      {/* Top HUD Navigation */}
      <HUDHeader
        state={sessionState}
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        selectedVoice={selectedVoice}
        onVoiceChange={handleVoiceChange}
        audioLevel={audioLevel}
      />

      {/* Floating Active Tools HUD */}
      <ActiveToolsHUD
        lastToolCall={lastToolCall}
        onClearToolCall={() => setLastToolCall(null)}
        currentTheme={currentTheme}
        activeTimers={activeTimers}
        onDismissTimer={handleDismissTimer}
      />

      {/* Center Stage: Aura Visualizer & Interactive Core */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4">
        <div className="relative w-full max-w-lg h-[380px] sm:h-[440px] flex items-center justify-center">
          {/* Reactive Canvas Aura */}
          <AuraVisualizer
            state={sessionState}
            currentTheme={currentTheme}
            getFrequencies={getFrequencies}
            audioLevel={audioLevel}
          />

          {/* Central Power/Mic Button */}
          <CentralMicButton
            state={sessionState}
            currentTheme={currentTheme}
            onToggle={handleToggleSession}
            audioLevel={audioLevel}
          />
        </div>

        {/* Mahi's Dynamic Sassy Dialogue / Persona Banner */}
        <div className="mt-2 text-center max-w-md px-6 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-lg flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: themeConfig.secondary }} />
          <p className="text-xs sm:text-sm text-white/90 italic font-sans tracking-wide">
            "{sassyQuote}"
          </p>
        </div>

        {/* Error Notification Banner if any */}
        {errorMessage && (
          <div className="mt-4 px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-950/80 text-red-200 text-xs flex items-center gap-2.5 max-w-md backdrop-blur-md animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          </div>
        )}
      </main>

      {/* Bottom Voice Prompt Inspiration Chips */}
      <VoicePromptsGuide
        currentTheme={currentTheme}
        isSessionActive={sessionState !== "disconnected"}
      />
    </div>
  );
}
