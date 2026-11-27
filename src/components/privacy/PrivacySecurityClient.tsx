"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  Lock,
  Cpu,
  Bot,
  Database,
  CheckCircle2,
} from "lucide-react";

interface SecurityCheck {
  id: string;
  title: string;
  status: "VERIFIED_ACTIVE" | "NOT_CONFIGURED" | "DEGRADED";
  detail: string;
}

const DOC_FLOW = [
  "USER BROWSER",
  "LOCAL DOCUMENT PROCESSING",
  "PII DETECTION ENGINE",
  "SANITIZATION ENGINE",
  "SANITIZED DOWNLOAD",
];

const AI_FLOW = [
  "USER QUESTION",
  "SERVER-SIDE API",
  "PII VALIDATION",
  "ZERVIX AI ENGINE",
  "AI RESPONSE",
];

export function PrivacySecurityClient() {
  const [checks, setChecks] = useState<SecurityCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/privacy-status")
      .then((r) => r.json())
      .then((d) => setChecks(d.checks ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Privacy & Security Center
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Verified runtime status of ZERVIX privacy boundaries, encryption, session
          hardening, and zero-upload data flows.
        </p>
      </div>

      {/* Architecture Flow Diagrams */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="zervix-gradient-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
            <Cpu className="w-4 h-4" />
            Document Processing Flow (Zero-Upload)
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Original documents stay strictly in browser RAM and never traverse the
            network or enter the AI pipeline.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            {DOC_FLOW.map((step, i) => (
              <div key={step} className="flex flex-col items-center">
                <div className="w-full rounded-xl bg-[var(--bg-secondary)] border border-cyan-400/30 px-4 py-2.5 text-center text-xs font-mono font-semibold text-cyan-200">
                  {step}
                </div>
                {i < DOC_FLOW.length - 1 ? (
                  <ArrowDown className="w-4 h-4 text-violet-400 my-1" aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="zervix-gradient-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
            <Bot className="w-4 h-4" />
            AI Assistant Flow (Dual PII Preflight)
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Product-help questions pass client and server PII preflight checks before
            reaching ZERVIX AI with a server-only credential.
          </p>
          <div className="flex flex-col gap-2.5 pt-2">
            {AI_FLOW.map((step, i) => (
              <div key={step} className="flex flex-col items-center">
                <div className="w-full rounded-xl bg-[var(--bg-secondary)] border border-violet-400/30 px-4 py-2.5 text-center text-xs font-mono font-semibold text-violet-200">
                  {step}
                </div>
                {i < AI_FLOW.length - 1 ? (
                  <ArrowDown className="w-4 h-4 text-cyan-400 my-1" aria-hidden="true" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verified Control Status Grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="w-4 h-4 text-cyan-400" />
          Live Verified Implementation Controls
        </div>

        {loading ? (
          <div className="text-xs text-[var(--text-secondary)]">
            Running live verification checks...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checks.map((c) => {
              const badge =
                c.status === "VERIFIED_ACTIVE"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                  : c.status === "NOT_CONFIGURED"
                    ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
                    : "bg-red-500/15 text-red-300 border-red-400/30";
              return (
                <div key={c.id} className="zervix-glass rounded-2xl p-5 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {c.status === "VERIFIED_ACTIVE" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      {c.title}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${badge}`}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {c.detail}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Honest Scope Disclaimer */}
      <section className="zervix-glass rounded-2xl p-5 flex items-start gap-3 text-xs text-[var(--text-secondary)]">
        <Database className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-[var(--text-primary)]">
            Verification & Compliance Scope
          </div>
          <p>
            ZERVIX verifies technical privacy controls implemented in this codebase
            (client-side redaction, metadata-only PostgreSQL schema, HTTP-only sessions,
            server-side AI credentials). ZERVIX does not claim formal third-party GDPR,
            CCPA, HIPAA, or SOC 2 certification without an independent external audit.
          </p>
        </div>
        <ArrowRight className="w-4 h-4 shrink-0 hidden sm:block opacity-40" />
      </section>
    </div>
  );
}
