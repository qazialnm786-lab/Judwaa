import React, { useEffect, useRef } from "react";
import { LiveSessionState, AuraTheme } from "../types";
import { AURA_THEMES } from "../utils/theme";

interface AuraVisualizerProps {
  state: LiveSessionState;
  currentTheme: AuraTheme;
  getFrequencies?: (targetArray: Uint8Array) => void;
  audioLevel: number;
}

export const AuraVisualizer: React.FC<AuraVisualizerProps> = ({
  state,
  currentTheme,
  getFrequencies,
  audioLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeConfig = AURA_THEMES[currentTheme] || AURA_THEMES.neon_rose;
  const animFrameRef = useRef<number | null>(null);
  const freqBufferRef = useRef<Uint8Array>(new Uint8Array(64));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(canvas);

    let angle = 0;
    let pulsePhase = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const minDim = Math.min(width, height);
      const baseRadius = minDim * 0.28;

      // Fetch live frequency data if available
      if (getFrequencies) {
        getFrequencies(freqBufferRef.current);
      }

      angle += state === "speaking" ? 0.03 : state === "connecting" ? 0.05 : 0.01;
      pulsePhase += 0.04;

      // Base energetic multiplier from audio level
      const dynamicBoost = audioLevel * (minDim * 0.08);

      // 1. Draw outer ambient gradient bloom
      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        baseRadius * 1.8 + dynamicBoost * 2
      );
      const alphaGlow =
        state === "speaking"
          ? 0.35 + audioLevel * 0.3
          : state === "listening"
          ? 0.2 + audioLevel * 0.2
          : state === "connecting"
          ? 0.25
          : 0.1;

      bgGrad.addColorStop(0, `${themeConfig.primary}${Math.round(alphaGlow * 255).toString(16).padStart(2, "0")}`);
      bgGrad.addColorStop(0.6, `${themeConfig.secondary}${Math.round(alphaGlow * 0.5 * 255).toString(16).padStart(2, "0")}`);
      bgGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.8 + dynamicBoost * 2, 0, Math.PI * 2);
      ctx.fill();

      // 2. Futuristic Reticle Rings
      ctx.save();
      ctx.strokeStyle = `${themeConfig.primary}40`;
      ctx.lineWidth = 1.5 * window.devicePixelRatio;
      ctx.setLineDash([6 * window.devicePixelRatio, 12 * window.devicePixelRatio]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.25 + Math.sin(pulsePhase) * 4, angle, angle + Math.PI * 2);
      ctx.stroke();

      // Counter-rotating fine ring
      ctx.strokeStyle = `${themeConfig.secondary}30`;
      ctx.lineWidth = 1 * window.devicePixelRatio;
      ctx.setLineDash([2 * window.devicePixelRatio, 6 * window.devicePixelRatio]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.45, -angle * 1.3, -angle * 1.3 + Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 3. Radar Sweep Line if connecting
      if (state === "connecting") {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle * 2);
        const sweepGrad = ctx.createLinearGradient(0, 0, baseRadius * 1.4, 0);
        sweepGrad.addColorStop(0, `${themeConfig.primary}00`);
        sweepGrad.addColorStop(1, `${themeConfig.primary}99`);
        ctx.strokeStyle = sweepGrad;
        ctx.lineWidth = 2 * window.devicePixelRatio;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(baseRadius * 1.4, 0);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Radial Frequency Wave Bars around the center core
      const barCount = 48;
      const freqData = freqBufferRef.current;
      const stepAngle = (Math.PI * 2) / barCount;

      ctx.save();
      for (let i = 0; i < barCount; i++) {
        const barAngle = i * stepAngle + angle * 0.4;
        const freqIndex = Math.floor((i / barCount) * (freqData.length / 2));
        const rawFreq = freqData[freqIndex] || 0;

        let barHeight = 6 * window.devicePixelRatio;
        if (state === "speaking") {
          barHeight += (rawFreq / 255) * (minDim * 0.12) + dynamicBoost;
        } else if (state === "listening") {
          barHeight += (rawFreq / 255) * (minDim * 0.08) + dynamicBoost * 0.8;
        } else if (state === "connecting") {
          barHeight += Math.sin(pulsePhase * 2 + i) * 6 * window.devicePixelRatio + 4;
        } else {
          // Idle breathing
          barHeight += Math.sin(pulsePhase + i * 0.2) * 3 * window.devicePixelRatio;
        }

        const innerR = baseRadius * 0.88;
        const outerR = innerR + barHeight;

        const x1 = centerX + Math.cos(barAngle) * innerR;
        const y1 = centerY + Math.sin(barAngle) * innerR;
        const x2 = centerX + Math.cos(barAngle) * outerR;
        const y2 = centerY + Math.sin(barAngle) * outerR;

        ctx.strokeStyle =
          state === "speaking"
            ? themeConfig.primary
            : state === "listening"
            ? themeConfig.secondary
            : `${themeConfig.primary}60`;
        ctx.lineWidth = 2.5 * window.devicePixelRatio;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      // 5. Continuous undulating organic wave loop inside the core
      ctx.save();
      ctx.beginPath();
      const wavePoints = 64;
      const waveAngleStep = (Math.PI * 2) / wavePoints;
      const coreRadius = baseRadius * 0.72;

      for (let i = 0; i <= wavePoints; i++) {
        const a = i * waveAngleStep;
        const noise =
          state === "speaking" || state === "listening"
            ? Math.sin(a * 5 + pulsePhase * 3) * (audioLevel * 14 * window.devicePixelRatio)
            : Math.sin(a * 4 + pulsePhase) * (3 * window.devicePixelRatio);
        const r = coreRadius + noise;
        const px = centerX + Math.cos(a) * r;
        const py = centerY + Math.sin(a) * r;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();

      ctx.fillStyle = "rgba(10, 10, 14, 0.85)";
      ctx.fill();
      ctx.strokeStyle =
        state === "speaking"
          ? themeConfig.primary
          : state === "listening"
          ? "#34d399"
          : `${themeConfig.primary}80`;
      ctx.lineWidth = 2 * window.devicePixelRatio;
      ctx.stroke();
      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [state, currentTheme, audioLevel]);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Background ambient lighting pulse */}
      <div
        className="absolute w-[340px] sm:w-[460px] h-[340px] sm:h-[460px] rounded-full blur-[90px] transition-all duration-700 opacity-60 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${themeConfig.primary}40 0%, ${themeConfig.secondary}15 60%, transparent 80%)`,
          transform:
            state === "speaking"
              ? `scale(${1 + audioLevel * 0.4})`
              : state === "listening"
              ? `scale(${1 + audioLevel * 0.25})`
              : "scale(1)",
        }}
      />
      {/* Real-time HTML5 2D Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full max-w-[650px] max-h-[650px] relative z-10"
      />
    </div>
  );
};
