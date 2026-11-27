"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { ZervixLogo } from "@/components/brand/ZervixLogo";

const MAX_DEMO_USES = 5;
const DEMO_USES_STORAGE_KEY = "zervix_demo_uses";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [demoUsed, setDemoUsed] = useState<number>(0);

  useEffect(() => {
    let active = true;
    let localCount = 0;
    try {
      const stored = Number(window.localStorage.getItem(DEMO_USES_STORAGE_KEY) ?? 0);
      if (Number.isFinite(stored) && stored > 0) {
        localCount = Math.min(MAX_DEMO_USES, Math.floor(stored));
      }
    } catch {
      // Ignore storage errors
    }

    fetch("/api/auth/demo-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        const serverCount =
          data && typeof data.used === "number"
            ? Math.min(MAX_DEMO_USES, data.used)
            : 0;
        const synced = Math.max(localCount, serverCount);
        setDemoUsed(synced);
        try {
          window.localStorage.setItem(DEMO_USES_STORAGE_KEY, String(synced));
        } catch {
          // Ignore storage errors
        }
      })
      .catch(() => {
        if (active && localCount > 0) {
          setDemoUsed(localCount);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error?.code === "DEMO_LIMIT_REACHED") {
          setDemoUsed(MAX_DEMO_USES);
          try {
            window.localStorage.setItem(DEMO_USES_STORAGE_KEY, String(MAX_DEMO_USES));
          } catch {
            // Ignore storage errors
          }
        }
        setServerError(data?.error?.message ?? "Unable to sign in.");
        return;
      }
      if (data?.demoUsage && typeof data.demoUsage.used === "number") {
        const nextCount = Math.min(MAX_DEMO_USES, data.demoUsage.used);
        setDemoUsed(nextCount);
        try {
          window.localStorage.setItem(DEMO_USES_STORAGE_KEY, String(nextCount));
        } catch {
          // Ignore storage errors
        }
      }
      const nextParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const welcomeUrl =
        nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
          ? `/welcome?next=${encodeURIComponent(nextParam)}`
          : "/welcome";
      try {
        window.sessionStorage.removeItem("zervix_welcome_ack");
      } catch {
        // Ignore storage errors
      }
      router.push(welcomeUrl);
      router.refresh();
    } catch {
      setServerError("Network error while signing in.");
    }
  }

  function fillDemo(email: string, password: string) {
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
  }

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12 bg-transparent">
      <div className="w-full max-w-md zervix-gradient-border rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(139,92,246,0.18)]">
        <div className="flex items-center gap-3 mb-6">
          <ZervixLogo size="lg" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">Sign in to ZERVIX</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Your Data. Your Privacy. Your Control.
            </p>
          </div>
        </div>

        {serverError ? (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200"
          >
            {serverError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium mb-1.5">
              Email address <span aria-hidden="true" className="text-cyan-400">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
              className="w-full min-h-[46px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="analyst@zervix.ai"
            />
            {errors.email ? (
              <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-xs font-medium">
                Password <span aria-hidden="true" className="text-cyan-400">*</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-cyan-400 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
                className="w-full min-h-[46px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] pl-3.5 pr-11 text-sm focus:border-cyan-400 focus:outline-none"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password ? (
              <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Evaluation Credentials (hidden once 5 uses are exhausted) */}
        {demoUsed < MAX_DEMO_USES ? (
          <div className="mt-6 p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                Demo Evaluation Account
              </div>
              <span className="text-[11px] font-mono text-violet-300">
                {MAX_DEMO_USES - demoUsed}/{MAX_DEMO_USES} left
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Limited to {MAX_DEMO_USES} sign-ins per user. Once finished, this demo option
              is removed.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fillDemo("demo@zervix.ai", "ZervixDemo#2026")}
                className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-400/30 text-violet-200 hover:bg-violet-500/25 transition cursor-pointer"
              >
                Use Demo Analyst
              </button>
            </div>
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
          New to ZERVIX?{" "}
          <Link href="/register" className="text-violet-400 font-semibold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
