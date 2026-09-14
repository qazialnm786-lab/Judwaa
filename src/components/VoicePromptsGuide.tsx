import React from "react";
import { MessageSquareDashed, Sparkles } from "lucide-react";
import { AuraTheme } from "../types";
import { AURA_THEMES } from "../utils/theme";

interface VoicePromptsGuideProps {
  currentTheme: AuraTheme;
  isSessionActive: boolean;
}

const SAMPLE_PROMPTS = [
  "\"Hey Mahi, open YouTube for me\"",
  "\"Put on Spotify\"",
  "\"Change your aura to Cyber Violet\"",
  "\"What should I wear tonight?\"",
  "\"Set a 5 minute timer\"",
  "\"Give me your best witty comeback\"",
];

export const VoicePromptsGuide: React.FC<VoicePromptsGuideProps> = ({
  currentTheme,
  isSessionActive,
}) => {
  const themeConfig = AURA_THEMES[currentTheme] || AURA_THEMES.neon_rose;

  return (
    <footer className="relative z-30 w-full px-4 py-4 sm:py-6 flex flex-col items-center justify-center">
      <div className="flex items-center gap-2 mb-2 text-white/50 text-[11px] font-mono uppercase tracking-widest">
        <Sparkles className="w-3 h-3" style={{ color: themeConfig.secondary }} />
        <span>Voice Inspiration</span>
      </div>

      <div className="flex items-center justify-center flex-wrap gap-2 max-w-2xl px-2">
        {SAMPLE_PROMPTS.map((prompt, idx) => (
          <div
            key={idx}
            className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 backdrop-blur-md hover:border-white/25 hover:text-white transition-all cursor-default select-none shadow-sm"
          >
            {prompt}
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-white/30 font-mono text-center">
        {isSessionActive
          ? "Continuous full-duplex session · Talk over Mahi anytime to interrupt"
          : "Powered by Gemini 3.1 Live · Audio-to-Audio stream"}
      </div>
    </footer>
  );
};
