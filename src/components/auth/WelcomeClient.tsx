"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, MotionConfig, AnimatePresence } from "framer-motion";
import { ArrowRight, Cpu, Lock, ShieldCheck } from "lucide-react";
import { HolographicShield } from "@/components/dashboard/HolographicShield";
import { ZervixLogo } from "@/components/brand/ZervixLogo";

export function WelcomeClient({
  userName,
  role,
  nextHref = "/dashboard",
}: {
  userName: string;
  role: string;
  nextHref?: string;
}) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleContinue() {
    if (launching) return;
    try {
      window.sessionStorage.setItem("zervix_welcome_ack", "1");
    } catch {
      // Ignore storage errors
    }
    setLaunching(true);

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const delayMs = prefersReducedMotion ? 200 : 920;
    timerRef.current = setTimeout(() => {
      router.push(nextHref);
    }, delayMs);
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative z-10 min-h-screen overflow-hidden flex items-center justify-center px-4 py-12 bg-transparent text-[var(--text-primary)]">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={
            launching
              ? { opacity: 0.16, scale: 0.94, filter: "blur(6px)" }
              : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
          }
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-xl zervix-gradient-border rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-[0_0_70px_rgba(139,92,246,0.22)]"
        >
          <div className="flex justify-center">
            <ZervixLogo
              size="lg"
              showWordmark
              subtitle="Zero-Upload Privacy Platform"
            />
          </div>

          <div className="flex justify-center">
            <HolographicShield compact label="SESSION AUTHENTICATED" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-2.5"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30 text-[11px] font-semibold tracking-wider uppercase text-violet-200">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              {role} Access Verified
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                ZERVIX
              </span>
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Signed in as{" "}
              <strong className="text-[var(--text-primary)]">{userName}</strong>.
              Your Data. Your Privacy. Your Control.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left"
          >
            <div className="rounded-2xl bg-[var(--bg-secondary)]/80 border border-[var(--border-subtle)] p-3.5 space-y-1">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <div className="text-xs font-semibold">Local Engine</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Files stay inside your browser.
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--bg-secondary)]/80 border border-[var(--border-subtle)] p-3.5 space-y-1">
              <Lock className="w-4 h-4 text-violet-400" />
              <div className="text-xs font-semibold">Zero Raw PII</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Metadata-only audit records.
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--bg-secondary)]/80 border border-[var(--border-subtle)] p-3.5 space-y-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div className="text-xs font-semibold">AI Guardrails</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Dual PII preflight active.
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="pt-1 flex justify-center"
          >
            <motion.button
              type="button"
              onClick={handleContinue}
              disabled={launching}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              className="group relative overflow-hidden inline-flex items-center justify-center gap-2.5 min-h-[48px] px-8 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white text-sm font-semibold shadow-[0_0_30px_rgba(139,92,246,0.45)] hover:shadow-[0_0_38px_rgba(34,211,238,0.5)] disabled:opacity-80"
            >
              <span>{launching ? "Initializing Workspace..." : "Continue to Dashboard"}</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Animated Holographic Portal Launch Overlay */}
        <AnimatePresence>
          {launching ? (
            <motion.div
              key="zervix-launch-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              aria-live="polite"
              className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050509]/80 backdrop-blur-md pointer-events-none"
            >
              {/* Expanding energy pulse rings */}
              <motion.div
                initial={{ scale: 0.35, opacity: 0.85 }}
                animate={{ scale: 2.8, opacity: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="absolute w-44 h-44 rounded-full border-2 border-cyan-400/70 shadow-[0_0_40px_rgba(34,211,238,0.45)]"
              />
              <motion.div
                initial={{ scale: 0.25, opacity: 0.75 }}
                animate={{ scale: 2.3, opacity: 0 }}
                transition={{ duration: 0.85, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="absolute w-44 h-44 rounded-full border border-violet-400/70 shadow-[0_0_40px_rgba(139,92,246,0.45)]"
              />

              {/* Central spinning halo + ZERVIX Logo */}
              <motion.div
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: [0.75, 1.08, 1], opacity: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex flex-col items-center gap-5 px-6 text-center"
              >
                <div className="relative flex items-center justify-center w-28 h-28">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-400/60"
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 rounded-full border border-violet-400/50"
                  />
                  <motion.div
                    initial={{ scale: 0.85 }}
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ZervixLogo size="xl" />
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.25 }}
                    className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300"
                  >
                    Opening Security Command Center
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.25 }}
                    className="text-[11px] text-[var(--text-secondary)]"
                  >
                    Activating local zero-upload PII engine & telemetry...
                  </motion.div>
                </div>

                {/* Progress sweep bar */}
                <div className="w-56 h-1.5 rounded-full bg-white/10 overflow-hidden border border-white/10">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.8)]"
                  />
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
