"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { ZervixLogo } from "@/components/brand/ZervixLogo";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(80),
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Include at least one uppercase letter.")
    .regex(/[0-9]/, "Include at least one number."),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
  });

  async function onSubmit(values: RegisterValues) {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data?.error?.message ?? "Registration failed.");
        return;
      }
      try {
        window.sessionStorage.removeItem("zervix_welcome_ack");
      } catch {
        // Ignore storage errors
      }
      router.push("/welcome");
      router.refresh();
    } catch {
      setServerError("Network error while creating account.");
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12 bg-transparent">
      <div className="w-full max-w-md zervix-gradient-border rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(139,92,246,0.18)]">
        <div className="flex items-center gap-3 mb-6">
          <ZervixLogo size="lg" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">Create ZERVIX Account</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Zero-upload privacy workspace
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
            <label htmlFor="reg-name" className="block text-xs font-medium mb-1.5">
              Full name <span aria-hidden="true" className="text-cyan-400">*</span>
            </label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
              className="w-full min-h-[46px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="Priya Nair"
            />
            {errors.name ? (
              <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-xs font-medium mb-1.5">
              Email address <span aria-hidden="true" className="text-cyan-400">*</span>
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
              className="w-full min-h-[46px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="priya@company.org"
            />
            {errors.email ? (
              <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-xs font-medium mb-1.5">
              Password <span aria-hidden="true" className="text-cyan-400">*</span>
            </label>
            <p id="reg-pwd-hint" className="text-[11px] text-[var(--text-secondary)] mb-1.5">
              Minimum 8 characters, at least 1 uppercase letter and 1 number.
            </p>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-describedby="reg-pwd-hint"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
                className="w-full min-h-[46px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] pl-3.5 pr-11 text-sm focus:border-cyan-400 focus:outline-none"
                placeholder="Create a strong password"
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
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="text-cyan-400 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
