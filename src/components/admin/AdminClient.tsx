"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Users,
  Activity,
  Server,
  Sliders,
  Lock,
} from "lucide-react";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  lastLoginAt: string | null;
  createdAt: string;
  _count: { activities: number; auditLogs: number };
}

interface SecurityEventRow {
  id: string;
  eventType: string;
  severity: string;
  description: string;
  ipAddress: string | null;
  createdAt: string;
  user: { email: string } | null;
}

interface SettingRow {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
}

interface OverviewPayload {
  health: {
    database: string;
    geminiConfigured: boolean;
    geminiModel: string;
    smtpConfigured: boolean;
    uptimeSeconds: number;
  };
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalDocumentsProcessed: number;
    totalPiiDetections: number;
    totalUniqueEntities: number;
  };
  securityEvents: SecurityEventRow[];
  settings: SettingRow[];
}

export function AdminClient({ currentAdminId }: { currentAdminId: string }) {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [ovRes, usrRes] = await Promise.all([
      fetch("/api/admin/overview"),
      fetch("/api/admin/users"),
    ]);
    if (ovRes.ok) setData(await ovRes.json());
    if (usrRes.ok) {
      const u = await usrRes.json();
      setUsers(u.users ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/admin/overview"), fetch("/api/admin/users")])
      .then(async ([ovRes, usrRes]) => {
        if (cancelled) return;
        if (ovRes.ok) setData(await ovRes.json());
        if (usrRes.ok) {
          const u = await usrRes.json();
          setUsers(u.users ?? []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleUserStatus(u: AdminUserRow) {
    const nextStatus = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, status: nextStatus }),
    });
    if (res.ok) {
      setMessage(`Updated ${u.email} to ${nextStatus}.`);
      await loadAll();
    }
  }

  async function updateSetting(key: string, value: string) {
    const res = await fetch("/api/admin/overview", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) {
      setMessage(`Updated setting ${key}.`);
      await loadAll();
    }
  }

  if (loading) {
    return <div className="text-xs text-[var(--text-secondary)]">Loading admin telemetry...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-cyan-400" />
            Administration Console
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Role-protected system health, account metadata, security telemetry, and
            configuration. Administrators cannot access user documents or raw PII.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/15 border border-violet-400/30 text-xs text-violet-200">
          <Lock className="w-3.5 h-3.5" />
          Zero Document Access Enforced
        </span>
      </div>

      {message ? (
        <div role="status" className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-xs text-cyan-200">
          {message}
        </div>
      ) : null}

      {/* Health & Metadata Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="zervix-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Server className="w-4 h-4 text-emerald-400" />
            Application Health
          </div>
          <div className="text-lg font-bold mt-1 text-emerald-300">
            DB: {data?.health.database ?? "UNKNOWN"}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            ZERVIX AI: {data?.health.geminiConfigured ? "Active" : "Not configured"} •
            SMTP: {data?.health.smtpConfigured ? "Ready" : "Not configured"}
          </div>
        </div>

        <div className="zervix-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Users className="w-4 h-4 text-violet-400" />
            Accounts
          </div>
          <div className="text-2xl font-bold mt-1 font-mono">
            {data?.overview.activeUsers ?? 0} / {data?.overview.totalUsers ?? 0}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">Active / Total users</div>
        </div>

        <div className="zervix-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Activity className="w-4 h-4 text-cyan-400" />
            Processed Metadata
          </div>
          <div className="text-2xl font-bold mt-1 font-mono text-cyan-300">
            {data?.overview.totalDocumentsProcessed ?? 0}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">Total document runs</div>
        </div>

        <div className="zervix-glass rounded-2xl p-5">
          <div className="text-xs text-[var(--text-secondary)]">Global PII Counts</div>
          <div className="text-2xl font-bold mt-1 font-mono text-fuchsia-300">
            {data?.overview.totalPiiDetections ?? 0}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            {data?.overview.totalUniqueEntities ?? 0} unique entities
          </div>
        </div>
      </section>

      {/* User Management */}
      <section className="zervix-glass rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold">User Management (Account Metadata Only)</h3>
        <div className="zervix-table-wrap rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Runs</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-medium">{u.name}</td>
                  <td className="py-3 px-4 text-[var(--text-secondary)]">{u.email}</td>
                  <td className="py-3 px-4">{u.role}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">{u._count.activities}</td>
                  <td className="py-3 px-4 text-right">
                    {u.id !== currentAdminId ? (
                      <button
                        type="button"
                        onClick={() => void toggleUserStatus(u)}
                        className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] hover:border-cyan-400/50"
                      >
                        {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-[var(--text-secondary)]">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* System Configuration & Security Events */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="zervix-glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sliders className="w-4 h-4 text-violet-400" />
            System Configuration
          </div>
          <div className="space-y-3">
            {(data?.settings ?? []).map((s) => (
              <SettingEditorRow key={s.id} setting={s} onSave={updateSetting} />
            ))}
          </div>
        </div>

        <div className="zervix-glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
            Recent Security Events
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(data?.securityEvents ?? []).map((ev) => (
              <div
                key={ev.id}
                className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-cyan-300">
                    {ev.eventType}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-200">
                    {ev.severity}
                  </span>
                </div>
                <p className="text-[var(--text-secondary)]">{ev.description}</p>
                <div className="text-[10px] text-[var(--text-secondary)] opacity-75">
                  {ev.user?.email ?? "Anonymous"} • {ev.ipAddress ?? "—"} •{" "}
                  {new Date(ev.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingEditorRow({
  setting,
  onSave,
}: {
  setting: SettingRow;
  onSave: (key: string, val: string) => Promise<void>;
}) {
  const [val, setVal] = useState(setting.value);
  return (
    <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-violet-300">
          {setting.key}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)]">{setting.category}</span>
      </div>
      {setting.description ? (
        <p className="text-[11px] text-[var(--text-secondary)]">{setting.description}</p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          aria-label={`Value for ${setting.key}`}
          className="flex-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-mono"
        />
        <button
          type="button"
          onClick={() => void onSave(setting.key, val)}
          className="px-3 py-1 rounded-lg bg-violet-600/30 border border-violet-400/40 text-xs font-medium hover:bg-violet-600/45"
        >
          Save
        </button>
      </div>
    </div>
  );
}
