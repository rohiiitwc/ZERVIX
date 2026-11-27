"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Cpu,
  FileSearch,
  Sliders,
  Play,
  Download,
  Bot,
  BarChart3,
  UserCheck,
  ArrowRight,
  CheckCircle2,
  EyeOff,
} from "lucide-react";

const USEFUL_HIGHLIGHTS = [
  {
    icon: Lock,
    title: "Zero-Upload Browser Protection",
    accent: "text-cyan-400",
    description:
      "Documents are scanned and redacted locally in browser RAM. Original text and raw PII values are never uploaded to servers or databases.",
  },
  {
    icon: UserCheck,
    title: "Strict Per-User Isolation",
    accent: "text-violet-400",
    description:
      "Every account's sanitization metadata, analytics, notifications, and audit trails are isolated strictly to that signed-in user ID — never exposed to other users or admins.",
  },
  {
    icon: EyeOff,
    title: "Prevent Accidental PII Leaks",
    accent: "text-fuchsia-400",
    description:
      "Safely scrub emails, phones, IPv4 addresses, Indian PANs, Aadhaar candidates (Verhoeff check), and Luhn-verified cards before sharing logs, CSVs, or tickets.",
  },
  {
    icon: Bot,
    title: "Safe AI Collaboration",
    accent: "text-emerald-400",
    description:
      "Ask the built-in ZERVIX AI Assistant remediation or privacy questions with dual client and server preflight blocking against sensitive strings.",
  },
];

const GUIDE_STEPS = [
  {
    step: "01",
    title: "Open the Sanitization Workspace",
    icon: FileSearch,
    href: "/workspace",
    cta: "Go to Workspace",
    details:
      "Navigate to Sanitization Workspace from the sidebar (or click Sanitize Document on your Dashboard). Paste raw logs/text or drag and drop a .txt or .csv file.",
  },
  {
    step: "02",
    title: "Select PII Detection Categories",
    icon: Sliders,
    href: "/workspace",
    cta: "Configure Detectors",
    details:
      "Toggle the 6 local detectors you need: Email Addresses, Phone Numbers, IPv4 Addresses, Indian PAN Numbers, Aadhaar-Format Numbers (with Verhoeff checksum), and Luhn Credit Card Candidates.",
  },
  {
    step: "03",
    title: "Choose Your Redaction Mode",
    icon: ShieldCheck,
    href: "/workspace",
    cta: "Compare Modes",
    details:
      "Pick Full Mask ([REDACTED]), Partial Mask (preserves minimal context such as last 4 digits or email domain hint), or Consistent Pseudonymization (maps repeated values to EMAIL_01, PAN_01, etc. locally).",
  },
  {
    step: "04",
    title: "Process & Inspect Live Comparison",
    icon: Play,
    href: "/workspace",
    cta: "Try Demo Sample",
    details:
      "Click Process Document (or load one of the built-in synthetic TXT/CSV samples). Review the side-by-side color-highlighted original vs sanitized diff or structured CSV table.",
  },
  {
    step: "05",
    title: "Copy or Export Sanitized Results & Audit Trails",
    icon: Download,
    href: "/audit-reports",
    cta: "Open Audit Reports",
    details:
      "Click Copy, Download TXT, or Download CSV directly in the Workspace to save scrubbed files. Visit Audit Reports or Detection Analytics anytime to download tamper-evident CSV/JSON compliance logs.",
  },
  {
    step: "06",
    title: "Analyze Metrics & Consult ZERVIX AI",
    icon: BarChart3,
    href: "/analytics",
    cta: "View Analytics",
    details:
      "Track category totals, Luhn rejections, and trends in Detection Analytics, or ask ZERVIX AI Assistant for privacy best practices — protected by automatic PII preflight guardrails.",
  },
];

export function AboutClient({ authenticated }: { authenticated: boolean }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Hero Intro */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="zervix-gradient-border rounded-3xl p-6 sm:p-8 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30 text-xs font-semibold text-violet-200">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            Platform Overview & Step-by-Step User Guide
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            How{" "}
            <span className="zervix-brand-wordmark bg-clip-text text-transparent">
              ZERVIX
            </span>{" "}
            Protects Your Data
          </h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-3xl leading-relaxed">
            ZERVIX is an AI-powered data privacy and PII sanitization platform engineered
            so your confidential files never leave your device. Inspect, mask,
            pseudonymize, and audit sensitive documents in seconds with complete user
            data isolation.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={authenticated ? "/workspace" : "/login"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-xs font-semibold shadow-[0_0_24px_rgba(139,92,246,0.4)] hover:opacity-95 transition"
            >
              {authenticated ? "Open Sanitization Workspace" : "Sign In to Start"}
              <ArrowRight className="w-4 h-4" />
            </Link>
            {authenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl zervix-glass text-xs font-medium"
              >
                Back to Dashboard
              </Link>
            ) : (
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl zervix-glass text-xs font-medium"
              >
                Create Account
              </Link>
            )}
          </div>
        </motion.section>

        {/* Why ZERVIX Is Useful */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Why ZERVIX Is Useful</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Built for engineering, security, compliance, and analytics teams handling real files.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {USEFUL_HIGHLIGHTS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: idx * 0.05 }}
                  className="zervix-glass rounded-2xl p-5 space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
                      <Icon className={`w-4 h-4 ${item.accent}`} />
                    </div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Step-by-Step Guide */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              How to Use ZERVIX — Step by Step
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Follow these 6 steps to scrub sensitive files and generate clean exports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GUIDE_STEPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.1 + idx * 0.05 }}
                  className="zervix-glass rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[11px] font-mono font-semibold text-cyan-300">
                        STEP {item.step}
                      </span>
                      <Icon className="w-4 h-4 text-violet-400" />
                    </div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {item.details}
                    </p>
                  </div>

                  <div>
                    <Link
                      href={authenticated ? item.href : "/login"}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:underline"
                    >
                      {item.cta}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Privacy Guarantee Footer */}
        <section className="zervix-glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold">Privacy & User Isolation Guarantee</div>
              <p className="text-xs text-[var(--text-secondary)]">
                Your files are never uploaded, your records are never visible to other accounts,
                and exported reports contain only non-sensitive metadata counts.
              </p>
            </div>
          </div>
          <Link
            href={authenticated ? "/privacy-security" : "/login"}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition"
          >
            Inspect Privacy Controls
          </Link>
        </section>
      </div>
    </MotionConfig>
  );
}
