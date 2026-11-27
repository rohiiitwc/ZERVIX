"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { ZervixLogo } from "@/components/brand/ZervixLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    emailConfigured: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Unable to process reset request.");
        return;
      }
      setResult({
        message: data.message,
        emailConfigured: Boolean(data.emailConfigured),
      });
    } catch {
      setError("Network error while submitting request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12 bg-transparent">
      <div className="w-full max-w-md zervix-gradient-border rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <ZervixLogo size="lg" />
          <div>
            <h1 className="text-xl font-bold">Reset Password</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Request a cryptographic password reset token
            </p>
          </div>
        </div>

        {error ? (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mb-4 p-3.5 rounded-xl bg-violet-500/15 border border-violet-400/35 text-xs text-[var(--text-primary)] space-y-2">
            <p>{result.message}</p>
            {!result.emailConfigured ? (
              <p className="text-[11px] text-cyan-300">
                Required SMTP configuration: <code>SMTP_HOST</code>,{" "}
                <code>SMTP_PORT</code>, <code>SMTP_USER</code>,{" "}
                <code>SMTP_PASS</code>, and <code>SMTP_FROM</code> in{" "}
                <code>.env.local</code>.
              </p>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-xs font-medium mb-1.5">
              Account Email
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[46px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="you@organization.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Request Reset Link
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <Link href="/login" className="text-cyan-400 hover:underline">
            Back to Sign In
          </Link>
          <Link href="/reset-password" className="text-violet-400 hover:underline">
            Have a token?
          </Link>
        </div>
      </div>
    </div>
  );
}
