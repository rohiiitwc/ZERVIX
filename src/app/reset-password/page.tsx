"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ZervixLogo } from "@/components/brand/ZervixLogo";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Password reset failed.");
        return;
      }
      setSuccess(data.message);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Network error while resetting password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md zervix-gradient-border rounded-3xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <ZervixLogo size="lg" />
        <div>
          <h1 className="text-xl font-bold">Set New Password</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Enter your reset token and new credentials
          </p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-200">
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reset-token" className="block text-xs font-medium mb-1.5">
            Reset Token
          </label>
          <input
            id="reset-token"
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full min-h-[46px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3.5 text-sm font-mono focus:border-cyan-400 focus:outline-none"
            placeholder="Paste your 64-character reset token"
          />
        </div>

        <div>
          <label htmlFor="reset-new-pwd" className="block text-xs font-medium mb-1.5">
            New Password
          </label>
          <input
            id="reset-new-pwd"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[46px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3.5 text-sm focus:border-cyan-400 focus:outline-none"
            placeholder="8+ chars, uppercase & number"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Update Password
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
        <Link href="/login" className="text-cyan-400 hover:underline">
          Return to Sign In
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12 bg-transparent">
      <Suspense fallback={<div className="text-xs text-[var(--text-secondary)]">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
