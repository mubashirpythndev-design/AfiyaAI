"use client";

/**
 * Afiya AI — Adaptive Cyber-Luminous AI Cursor
 * Clean, luminous, authentic pointing hand (No black fill, pure crystalline/neon glow)
 * Author / Developer: Mubashir (Lead Developer)
 */

import { useEffect, useRef, useState } from "react";

type CursorMode = "default" | "pointer" | "text";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export default function CustomCursor() {
  const [mounted, setMounted] = useState(false);
  const [cursorMode, setCursorMode] = useState<CursorMode>("default");
  const [isClicked, setIsClicked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  const mousePos = useRef({ x: -100, y: -100 });
  const prevMousePos = useRef({ x: -100, y: -100 });
  const particles = useRef<Particle[]>([]);
  const isVisibleRef = useRef(false);

  const colors = [
    "rgba(45, 212, 191, ",  // Vivid Cyan
    "rgba(13, 148, 136, ",  // Primary Teal
    "rgba(129, 140, 248, ", // Bright Indigo
    "rgba(255, 255, 255, ", // Bright White
  ];

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkDevice = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        document.documentElement.classList.remove("custom-cursor-active");
      } else {
        document.documentElement.classList.add("custom-cursor-active");
      }
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);

    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext("2d") : null;

    const resize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };

      if (!isVisibleRef.current) {
        setIsVisible(true);
        isVisibleRef.current = true;
      }

      // Direct zero-lag pointer tracking
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Emit neon energy particles on movement
      const dx = e.clientX - prevMousePos.current.x;
      const dy = e.clientY - prevMousePos.current.y;
      const speed = Math.sqrt(dx * dx + dy * dy);

      if (speed > 1.5) {
        const count = Math.min(Math.floor(speed / 3) + 1, 3);
        for (let i = 0; i < count; i++) {
          const color = colors[Math.floor(Math.random() * colors.length)];
          particles.current.push({
            x: e.clientX + (Math.random() - 0.5) * 4,
            y: e.clientY + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 1.5 - dx * 0.08,
            vy: (Math.random() - 0.5) * 1.5 - dy * 0.08,
            size: Math.random() * 3.5 + 1.2,
            color,
            alpha: 0.9,
          });
        }
      }
      prevMousePos.current = { x: e.clientX, y: e.clientY };

      // Adaptive Structure Detection
      const target = e.target as HTMLElement | null;
      if (target) {
        try {
          // 1. Text Inputs & Editable Text Selection
          if (
            target.tagName === "INPUT" &&
            (target as HTMLInputElement).type !== "button" &&
            (target as HTMLInputElement).type !== "submit" &&
            (target as HTMLInputElement).type !== "checkbox" &&
            (target as HTMLInputElement).type !== "radio"
          ) {
            setCursorMode("text");
          } else if (
            target.tagName === "TEXTAREA" ||
            target.isContentEditable ||
            target.closest("input[type='text']") ||
            target.closest("input[type='search']") ||
            target.closest("textarea")
          ) {
            setCursorMode("text");
          }
          // 2. Clickable Links, Buttons & Interactive Elements -> Pointing Hand
          else if (
            target.closest("button") ||
            target.closest("a") ||
            target.closest("[role='button']") ||
            target.closest(".cursor-pointer") ||
            target.closest(".card-hover") ||
            target.closest("[data-medicine-id]") ||
            target.tagName === "BUTTON" ||
            target.tagName === "A"
          ) {
            setCursorMode("pointer");
          }
          // 3. Default State
          else {
            setCursorMode("default");
          }
        } catch {
          setCursorMode("default");
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      setIsClicked(true);

      // Spawn click energy burst
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.4;
        const burstSpeed = Math.random() * 3.5 + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * burstSpeed,
          vy: Math.sin(angle) * burstSpeed,
          size: Math.random() * 4 + 2,
          color,
          alpha: 1,
        });
      }
    };

    const onMouseUp = () => setIsClicked(false);
    const onMouseLeave = () => {
      setIsVisible(false);
      isVisibleRef.current = false;
    };
    const onMouseEnter = () => {
      setIsVisible(true);
      isVisibleRef.current = true;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.documentElement.addEventListener("mouseenter", onMouseEnter);

    // 120 FPS Particle Loop
    let rafId: number;
    const render = () => {
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = particles.current.length - 1; i >= 0; i--) {
          const p = particles.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.028;
          p.size *= 0.97;

          if (p.alpha <= 0 || p.size <= 0.4) {
            particles.current.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${p.alpha})`;
          ctx.shadowColor = "rgba(45, 212, 191, 0.9)";
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.documentElement.removeEventListener("mouseenter", onMouseEnter);
      cancelAnimationFrame(rafId);
    };
  }, []);

  if (!mounted || isMobile) return null;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[9999999] transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Adaptive Morphing Cursor Container */}
      <div
        ref={cursorRef}
        className="absolute top-0 left-0 pointer-events-none will-change-transform"
        style={{ transform: "translate3d(-100px, -100px, 0)" }}
      >
        <div
          className={`relative transition-all duration-150 ease-out origin-top-left ${
            isClicked ? "scale-90" : "scale-100"
          }`}
        >
          {/* Ambient Glow Aura */}
          <div
            className={`absolute -top-3 -left-3 w-10 h-10 rounded-full blur-md transition-all duration-300 pointer-events-none ${
              cursorMode === "pointer"
                ? "bg-primary-light/50 scale-150"
                : cursorMode === "text"
                ? "bg-accent/45 scale-125"
                : "bg-primary/35 scale-100"
            }`}
          />

          {/* ========================================================================= */}
          {/* STRUCTURE 1: AUTHENTIC LUMINOUS POINTING HAND (Clean, Glassmorphic White/Teal) */}
          {/* ========================================================================= */}
          {cursorMode === "pointer" && (
            <div className="-translate-x-[5px] -translate-y-[2px] animate-fade-in">
              <svg
                width="28"
                height="32"
                viewBox="0 0 24 28"
                fill="none"
                className="drop-shadow-[0_0_12px_rgba(45,212,191,0.95)]"
              >
                {/* Luminous Authentic Hand Shape (Translucent White & Cyan Gradient) */}
                <path
                  d="M7 1.5C5.9 1.5 5 2.4 5 3.5V13.8L3.8 12.3C3 11.4 1.7 11.3 0.8 12.1C-0.1 12.9 -0.2 14.3 0.6 15.2L5.4 20.8C6.9 22.5 9 23.5 11.2 23.5H15.5C19.1 23.5 22 20.6 22 17V10.5C22 9.4 21.1 8.5 20 8.5C19.8 8.5 19.5 8.5 19.3 8.6C19 7.7 18.2 7 17.2 7C17 7 16.7 7 16.5 7.1C16.2 6.2 15.3 5.5 14.2 5.5C14 5.5 13.8 5.5 13.6 5.6C13.2 4.4 12 3.5 10.7 3.5C10.5 3.5 10.2 3.5 10 3.6V3.5C10 2.4 9.1 1.5 8 1.5H7Z"
                  fill="rgba(255, 255, 255, 0.95)"
                  stroke="#2dd4bf"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Subtle Inner Curved Finger Contours */}
                <path
                  d="M10 9V14M13.5 10.5V15M17 12V16M5 13.8V17"
                  stroke="rgba(13, 148, 136, 0.4)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />

                {/* Laser Hotspot Fingertip Point */}
                <circle cx="7.5" cy="2.5" r="1.5" fill="#0d9488" />
              </svg>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STRUCTURE 2: LUMINOUS I-BEAM / SELECTOR (For Text, Inputs, Search Bars)    */}
          {/* ========================================================================= */}
          {cursorMode === "text" && (
            <div className="-translate-x-[6px] -translate-y-3 animate-fade-in">
              <svg
                width="16"
                height="26"
                viewBox="0 0 16 24"
                fill="none"
                className="drop-shadow-[0_0_8px_rgba(129,140,248,1)]"
              >
                <path
                  d="M3 3H13M8 3V21M3 21H13"
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="8"
                  y1="5"
                  x2="8"
                  y2="19"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STRUCTURE 3: SLEEK CYBER ARROW (Default State)                             */}
          {/* ========================================================================= */}
          {cursorMode === "default" && (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-[0_0_8px_rgba(45,212,191,0.95)]"
            >
              {/* Outer Outline */}
              <path
                d="M3 3L10.5 21L13.8 13.8L21 10.5L3 3Z"
                fill="rgba(255, 255, 255, 0.95)"
                stroke="#2dd4bf"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              {/* Inner Core */}
              <path
                d="M6 6L11 17L13 13L17 11L6 6Z"
                fill="#2dd4bf"
              />
              {/* Tip Dot */}
              <circle
                cx="4"
                cy="4"
                r="1.2"
                fill="#0d9488"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
