"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  KeyRound,
  Bell,
  Shield,
  Laptop,
  Loader2,
  CheckCircle2,
  Check,
  Trash2,
} from "lucide-react";
import { ALL_PII_CATEGORIES, PII_CATEGORIES, PiiCategory, RedactionMode } from "@/lib/pii/types";
import { applyTheme, ThemePreference } from "@/lib/theme";

interface SessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export function SettingsClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarColor, setAvatarColor] = useState("#8B5CF6");
  const [theme, setTheme] = useState<"DARK" | "LIGHT" | "SYSTEM">("DARK");
  const [defaultMode, setDefaultMode] = useState<RedactionMode>("PARTIAL_MASK");
  const [enabledCategories, setEnabledCategories] =
    useState<PiiCategory[]>(ALL_PII_CATEGORIES);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [auditDigest, setAuditDigest] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("FREE_COMMUNITY");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setName(d.user.name);
          setEmail(d.user.email);
          setAvatarColor(d.user.avatarColor ?? "#8B5CF6");
        }
        if (d.preferences) {
          const loadedTheme = (d.preferences.theme ?? "DARK") as ThemePreference;
          setTheme(loadedTheme);
          applyTheme(loadedTheme);
          setDefaultMode(d.preferences.defaultRedactionMode ?? "PARTIAL_MASK");
          setEnabledCategories(d.preferences.enabledCategories ?? ALL_PII_CATEGORIES);
          setEmailNotifications(Boolean(d.preferences.emailNotifications));
          setSecurityAlerts(Boolean(d.preferences.securityAlerts));
          setAuditDigest(Boolean(d.preferences.auditDigest));
        }
        if (d.subscription) {
          setSubscriptionTier(d.subscription.tier);
        }
        setSessions(d.sessions ?? []);
        setCurrentSessionId(d.currentSessionId ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleThemeSelect(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    setError(null);
    applyTheme(nextTheme);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message ?? "Failed to save theme preference.");
        return;
      }
      setFeedback("Theme preference updated.");
      router.refresh();
    } catch {
      setError("Network error while saving theme preference.");
    }
  }

  async function savePreferences(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          avatarColor,
          theme,
          defaultRedactionMode: defaultMode,
          enabledCategories,
          emailNotifications,
          securityAlerts,
          auditDigest,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Failed to update settings.");
        return;
      }
      applyTheme(theme);
      window.dispatchEvent(
        new CustomEvent("zervix:user-updated", { detail: { name, avatarColor } })
      );
      setFeedback("Profile and privacy preferences saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarColorSelect(color: string) {
    setAvatarColor(color);
    setError(null);
    window.dispatchEvent(
      new CustomEvent("zervix:user-updated", { detail: { avatarColor: color } })
    );
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarColor: color }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message ?? "Failed to save avatar color.");
        return;
      }
      setFeedback("Avatar accent color updated.");
      router.refresh();
    } catch {
      setError("Network error while saving avatar color.");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passwordChange: { currentPassword, newPassword },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Password change failed.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setFeedback("Password updated successfully.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeSession(sessionId: string) {
    const res = await fetch("/api/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setFeedback("Session revoked.");
    }
  }

  function toggleCategory(cat: PiiCategory) {
    setEnabledCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.length === 1 ? prev : prev.filter((c) => c !== cat);
      }
      return [...prev, cat];
    });
  }

  if (loading) {
    return <div className="text-xs text-[var(--text-secondary)]">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings & Profile</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Manage your ZERVIX identity, theme, default privacy rules, notifications,
          and active HTTP-only sessions.
        </p>
      </div>

      {feedback ? (
        <div role="status" className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {feedback}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      {/* Profile & Preferences Form */}
      <form onSubmit={savePreferences} className="space-y-6">
        <section className="zervix-glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
            <User className="w-4 h-4" />
            User Profile & Appearance
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="set-name" className="block text-xs font-medium mb-1">
                Full Name
              </label>
              <input
                id="set-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="set-email" className="block text-xs font-medium mb-1">
                Email Address
              </label>
              <input
                id="set-email"
                type="email"
                disabled
                value={email}
                className="w-full rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)] px-3 py-2.5 text-sm text-[var(--text-secondary)]"
              />
            </div>

            <div>
              <label htmlFor="set-theme" className="block text-xs font-medium mb-1">
                Theme Preference
              </label>
              <select
                id="set-theme"
                value={theme}
                onChange={(e) => void handleThemeSelect(e.target.value as ThemePreference)}
                className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2.5 text-sm cursor-pointer"
              >
                <option value="DARK">Dark (Default ZERVIX)</option>
                <option value="LIGHT">Light Mode</option>
                <option value="SYSTEM">System Preference</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white font-semibold text-xs shadow-md transition-colors duration-200"
                style={{ backgroundColor: avatarColor }}
                title="Avatar Preview"
              >
                {(name || "Z")
                  .split(" ")
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <span className="text-xs text-[var(--text-secondary)]">Avatar Accent:</span>
              <div className="flex items-center gap-2" role="group" aria-label="Avatar Accent Colors">
                {["#8B5CF6", "#22D3EE", "#3B82F6", "#D946EF", "#22C55E"].map((c) => {
                  const selected = avatarColor.toUpperCase() === c.toUpperCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => void handleAvatarColorSelect(c)}
                      aria-label={`Select color ${c}`}
                      aria-pressed={selected}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
                        selected
                          ? "border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                          : "border-white/15 hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {selected ? <Check className="w-3.5 h-3.5 text-white drop-shadow" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-[var(--text-secondary)]">
              Active Plan:{" "}
              <strong className="text-cyan-300">
                {subscriptionTier.replace(/_/g, " ")}
              </strong>
            </div>
          </div>
        </section>

        {/* Privacy Defaults */}
        <section className="zervix-glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
            <Shield className="w-4 h-4" />
            Default Privacy & Sanitization Preferences
          </div>

          <div>
            <label htmlFor="set-mode" className="block text-xs font-medium mb-1">
              Default Redaction Mode
            </label>
            <select
              id="set-mode"
              value={defaultMode}
              onChange={(e) => setDefaultMode(e.target.value as RedactionMode)}
              className="w-full max-w-xs rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs"
            >
              <option value="FULL_MASK">Full Mask ([REDACTED])</option>
              <option value="PARTIAL_MASK">Partial Mask</option>
              <option value="PSEUDONYMIZE">Consistent Pseudonymization</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-medium mb-2">Default Enabled Categories</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PII_CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={enabledCategories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                  />
                  <span>{PII_CATEGORIES[cat].label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Notification Preferences */}
        <section className="zervix-glass rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-300">
            <Bell className="w-4 h-4" />
            Notification Preferences
          </div>
          <label className="flex items-center justify-between text-xs p-3 rounded-xl bg-[var(--bg-secondary)]">
            <span>Workspace & sanitization completion alerts</span>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-xs p-3 rounded-xl bg-[var(--bg-secondary)]">
            <span>Security & PII preflight warning notifications</span>
            <input
              type="checkbox"
              checked={securityAlerts}
              onChange={(e) => setSecurityAlerts(e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between text-xs p-3 rounded-xl bg-[var(--bg-secondary)]">
            <span>Audit summary digest preference</span>
            <input
              type="checkbox"
              checked={auditDigest}
              onChange={(e) => setAuditDigest(e.target.checked)}
            />
          </label>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Preferences
          </button>
        </div>
      </form>

      {/* Password Change */}
      <form onSubmit={changePassword} className="zervix-glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-300">
          <KeyRound className="w-4 h-4" />
          Change Password
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cur-pwd" className="block text-xs font-medium mb-1">
              Current Password
            </label>
            <input
              id="cur-pwd"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="new-pwd" className="block text-xs font-medium mb-1">
              New Password (8+ chars, uppercase & number)
            </label>
            <input
              id="new-pwd"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-xl border border-violet-400/40 bg-violet-500/20 text-xs font-semibold text-violet-200 hover:bg-violet-500/30"
        >
          Update Password
        </button>
      </form>

      {/* Active Sessions */}
      <section className="zervix-glass rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
          <Laptop className="w-4 h-4" />
          Active Sessions ({sessions.length})
        </div>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs"
            >
              <div>
                <div className="font-medium">
                  {s.id === currentSessionId ? "Current Session" : "Active Session"} •{" "}
                  <span className="font-mono text-cyan-300">{s.ipAddress ?? "127.0.0.1"}</span>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate max-w-md">
                  {s.userAgent ?? "Browser"} • Expires{" "}
                  {new Date(s.expiresAt).toLocaleString()}
                </div>
              </div>
              {s.id !== currentSessionId ? (
                <button
                  type="button"
                  onClick={() => void revokeSession(s.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revoke
                </button>
              ) : (
                <span className="text-[11px] text-emerald-400 font-semibold">
                  Active Now
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
