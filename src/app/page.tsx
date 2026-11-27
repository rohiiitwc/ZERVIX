import Link from "next/link";
import {
  Lock,
  Cpu,
  FileSpreadsheet,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  EyeOff,
} from "lucide-react";
import { HolographicShield } from "@/components/dashboard/HolographicShield";
import { ZervixLogo } from "@/components/brand/ZervixLogo";


const CATEGORIES = [
  { name: "Email Addresses", badge: "EMAIL_01", color: "text-cyan-300 border-cyan-400/30" },
  { name: "Phone Numbers", badge: "PHONE_01", color: "text-violet-300 border-violet-400/30" },
  { name: "IPv4 Addresses", badge: "IP_01", color: "text-blue-300 border-blue-400/30" },
  { name: "Indian PAN", badge: "PAN_01", color: "text-fuchsia-300 border-fuchsia-400/30" },
  { name: "Aadhaar Format", badge: "AADHAAR_01", color: "text-purple-300 border-purple-400/30" },
  { name: "Credit Cards (Luhn)", badge: "CARD_01", color: "text-emerald-300 border-emerald-400/30" },
];

export default async function LandingPage() {
  return (
    <div className="relative z-10 min-h-screen flex flex-col bg-transparent text-[var(--text-primary)]">
      {/* Top Navbar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <ZervixLogo
              size="md"
              showWordmark
              subtitle="Your Data. Your Privacy. Your Control."
            />
          </Link>

          <nav aria-label="Landing navigation" className="flex items-center gap-3">
            <Link
              href="/about"
              className="px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] border border-transparent transition"
            >
              About & Guide
            </Link>
            <Link
              href="/workspace"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-95 shadow-[0_0_24px_rgba(139,92,246,0.4)] transition"
            >
              Open Workspace
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-xs font-medium text-violet-200">
              <Lock className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              Zero-Upload Browser Sanitization Architecture
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.12]">
              AI-Powered Data Privacy &{" "}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                Intelligent PII Sanitization
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed">
              Detect, validate, and redact Emails, Phones, IPv4s, Indian PANs, Aadhaar
              candidates, and Luhn-verified Credit Cards entirely inside your browser.
              Original documents never leave your device.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/workspace"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold text-sm shadow-[0_0_28px_rgba(139,92,246,0.45)] hover:opacity-95 transition"
              >
                Launch Security Command Center
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl zervix-glass text-sm font-medium hover:border-cyan-400/50 transition"
              >
                How to Use & Guide
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
              <div className="zervix-glass rounded-xl p-3.5 flex items-center gap-3">
                <Cpu className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">100% Browser Engine</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Zero raw PII in database
                  </div>
                </div>
              </div>
              <div className="zervix-glass rounded-xl p-3.5 flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-violet-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">RFC-Safe TXT & CSV</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Preserves quotes & multiline
                  </div>
                </div>
              </div>
              <div className="zervix-glass rounded-xl p-3.5 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-fuchsia-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">ZERVIX AI Guardrails</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Dual PII preflight shield
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="zervix-gradient-border rounded-3xl p-8 w-full max-w-md flex flex-col items-center gap-6 shadow-[0_0_60px_rgba(139,92,246,0.16)]">
              <HolographicShield label="HOLOGRAPHIC PRIVACY CORE" />
              <div className="w-full space-y-2.5">
                <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-semibold">
                  6 Supported PII Categories
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <div
                      key={c.name}
                      className={`rounded-xl border px-3 py-2 bg-[var(--bg-secondary)]/80 ${c.color}`}
                    >
                      <div className="text-xs font-semibold">{c.name}</div>
                      <div className="text-[10px] font-mono opacity-80">{c.badge}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three Modes Strip */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="zervix-glass rounded-2xl p-6 space-y-2">
              <div className="flex items-center gap-2 text-violet-300 font-semibold text-sm">
                <EyeOff className="w-4 h-4" />
                Mode 1 — Full Mask
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Irreversibly replaces all detected sensitive entities with{" "}
                <code className="text-cyan-300 font-mono">[REDACTED]</code> for maximum
                confidentiality.
              </p>
            </div>
            <div className="zervix-glass rounded-2xl p-6 space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Mode 2 — Partial Mask
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Preserves minimal verification context such as last 4 digits or domain hints
                while masking sensitive characters.
              </p>
            </div>
            <div className="zervix-glass rounded-2xl p-6 space-y-2">
              <div className="flex items-center gap-2 text-fuchsia-300 font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                Mode 3 — Consistent Pseudonymization
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Maps repeated identical entities to session-scoped tokens like{" "}
                <code className="text-violet-300 font-mono">EMAIL_01</code> and{" "}
                <code className="text-violet-300 font-mono">PAN_01</code> locally in RAM.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
