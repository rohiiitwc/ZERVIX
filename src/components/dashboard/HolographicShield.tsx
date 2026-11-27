"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Lock } from "lucide-react";

interface HolographicShieldProps {
  compact?: boolean;
  label?: string;
}

export function HolographicShield({
  compact = false,
  label = "LOCAL ZERO-UPLOAD SHIELD ACTIVE",
}: HolographicShieldProps) {
  const size = compact ? "w-28 h-28" : "w-40 h-40";

  return (
    <div className="relative flex flex-col items-center justify-center select-none pointer-events-none">
      {/* Subtle radial aura */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full blur-2xl opacity-45"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(34,211,238,0.25) 55%, transparent 75%)",
        }}
      />

      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        className={`relative ${size} flex items-center justify-center`}
      >
        {/* Outer rotating holographic ring */}
        <svg
          aria-hidden="true"
          viewBox="0 0 180 180"
          className="absolute inset-0 w-full h-full animate-zervix-spin"
        >
          <defs>
            <linearGradient id="zvxRingGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#D946EF" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <circle
            cx="90"
            cy="90"
            r="82"
            fill="none"
            stroke="url(#zvxRingGrad1)"
            strokeWidth="1.5"
            strokeDasharray="16 8 4 8"
          />
          <circle
            cx="90"
            cy="8"
            r="3"
            fill="#22D3EE"
          />
        </svg>

        {/* Inner counter-rotating ring */}
        <svg
          aria-hidden="true"
          viewBox="0 0 180 180"
          className="absolute inset-0 w-full h-full animate-zervix-spin-reverse"
        >
          <circle
            cx="90"
            cy="90"
            r="66"
            fill="none"
            stroke="#3B82F6"
            strokeOpacity="0.4"
            strokeWidth="1"
            strokeDasharray="6 6"
          />
          <circle
            cx="156"
            cy="90"
            r="2.5"
            fill="#A855F7"
          />
        </svg>

        {/* 3D Glass Shield Core */}
        <div
          className="relative flex items-center justify-center rounded-2xl border border-cyan-400/35 shadow-[0_0_28px_rgba(139,92,246,0.35)]"
          style={{
            width: compact ? "58px" : "78px",
            height: compact ? "64px" : "86px",
            background:
              "linear-gradient(155deg, rgba(139,92,246,0.28) 0%, rgba(16,17,32,0.92) 55%, rgba(34,211,238,0.22) 100%)",
            transform: "perspective(500px) rotateX(8deg) rotateY(-6deg)",
          }}
        >
          <ShieldCheck
            aria-hidden="true"
            className={`${compact ? "w-7 h-7" : "w-10 h-10"} text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]`}
          />
          <Lock
            aria-hidden="true"
            className="w-3.5 h-3.5 text-violet-300 absolute bottom-2 right-2 opacity-80"
          />
        </div>
      </motion.div>

      {label ? (
        <span className="mt-2 text-[10px] tracking-[0.18em] uppercase font-medium text-cyan-300/90 text-center">
          {label}
        </span>
      ) : null}
    </div>
  );
}
