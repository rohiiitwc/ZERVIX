"use client";

import { useId } from "react";

type LogoSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: "w-8 h-8",
  md: "w-9 h-9",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
};

interface ZervixLogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
}

export function ZervixLogo({
  size = "md",
  showWordmark = false,
  subtitle,
  className = "",
}: ZervixLogoProps) {
  const uid = useId().replace(/:/g, "");
  const outerGradId = `zvx-outer-${uid}`;
  const topBladeId = `zvx-top-${uid}`;
  const bottomBladeId = `zvx-bot-${uid}`;
  const glowGradId = `zvx-glow-${uid}`;

  return (
    <div className={`inline-flex items-center gap-3 shrink-0 ${className}`}>
      <div
        className={`relative ${SIZE_CLASSES[size]} flex items-center justify-center shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.28)]`}
      >
        <svg
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id={outerGradId} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="48%" stopColor="#D946EF" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
            <linearGradient id={topBladeId} x1="16" y1="16" x2="48" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#C4B5FD" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
            <linearGradient id={bottomBladeId} x1="16" y1="30" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="55%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#F0ABFC" />
            </linearGradient>
            <radialGradient id={glowGradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Asymmetric Beveled Octagon Prism Vault */}
          <path
            d="M22 4H46L60 18V42L42 60H18L4 46V22L22 4Z"
            fill="#090913"
            stroke={`url(#${outerGradId})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Inner Geometric Vault Lattice */}
          <path
            d="M23 9H44L55 20V41L41 55H20L9 44V23L23 9Z"
            fill={`url(#${glowGradId})`}
            stroke={`url(#${outerGradId})`}
            strokeOpacity="0.34"
            strokeWidth="1"
            strokeLinejoin="round"
          />

          {/* Interlocking Dual-Shard Z Monogram */}
          <path
            d="M19 21H45L36 30H24L19 21Z"
            fill={`url(#${topBladeId})`}
          />
          <path
            d="M28 34H40L45 43H19L28 34Z"
            fill={`url(#${bottomBladeId})`}
          />
          <path
            d="M44 21L20 43"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Central Zero-Knowledge Quantum Node */}
          <path
            d="M32 25.5L38.5 32L32 38.5L25.5 32L32 25.5Z"
            fill="#090913"
            stroke="#22D3EE"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="2.6" fill="#22D3EE" />

          {/* Diagonal Telemetry Vertex Nodes */}
          <circle cx="46" cy="4" r="2" fill="#22D3EE" />
          <circle cx="18" cy="60" r="2" fill="#D946EF" />
        </svg>
      </div>

      {showWordmark ? (
        <div className="min-w-0 text-left">
          <div className="text-base font-bold tracking-[0.14em] zervix-brand-wordmark bg-clip-text text-transparent leading-tight">
            ZERVIX
          </div>
          {subtitle ? (
            <p className="text-[10px] text-[var(--text-secondary)] truncate">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
