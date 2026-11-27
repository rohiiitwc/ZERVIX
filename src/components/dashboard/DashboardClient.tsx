"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  ShieldAlert,
  ShieldCheck,
  Fingerprint,
  Calendar,
  Plus,
  Download,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { ALL_PII_CATEGORIES, PII_CATEGORIES, PiiCategory } from "@/lib/pii/types";
import { HolographicShield } from "./HolographicShield";

type WidgetId =
  | "kpis"
  | "piiDistribution"
  | "detectionTrends"
  | "recentActivity"
  | "categoryBreakdown"
  | "holographicShield";

const WIDGET_LABELS: Record<WidgetId, string> = {
  kpis: "Top KPI Statistic Cards",
  piiDistribution: "PII Distribution Donut",
  detectionTrends: "Detection Trends Chart",
  recentActivity: "Recent Sanitization Activity",
  categoryBreakdown: "PII Category Circular Breakdown",
  holographicShield: "Holographic Security Shield",
};

interface ActivityItem {
  id: string;
  fileName: string;
  fileType: string;
  sanitizationMode: string;
  totalDetections: number;
  uniqueEntities: number;
  status: string;
  exportedFormat: string;
  createdAt: string;
}

interface AnalyticsPayload {
  totalDocuments: number;
  totalDetections: number;
  successfullySanitized: number;
  uniqueEntities: number;
  categoryTotals: Record<PiiCategory, number>;
  luhnValidCards: number;
  luhnInvalidCandidates: number;
  aadhaarValidFormat: number;
  containsSyntheticDemo: boolean;
  syntheticDemoCount: number;
  trends: Array<{
    date: string;
    documents: number;
    detections: number;
    sanitized: number;
  }>;
}

interface DashboardClientProps {
  initialWidgets: WidgetId[];
  userName: string;
}

export function DashboardClient({
  initialWidgets,
  userName,
}: DashboardClientProps) {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [modeFilter, setModeFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<WidgetId[]>(
    initialWidgets.length > 0
      ? initialWidgets
      : [
          "kpis",
          "piiDistribution",
          "detectionTrends",
          "recentActivity",
          "categoryBreakdown",
          "holographicShield",
        ]
  );

  const widgetDialogRef = useRef<HTMLDialogElement>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        range,
        page: String(page),
        pageSize: "6",
      });
      if (modeFilter !== "ALL") params.set("mode", modeFilter);
      const res = await fetch(`/api/activities?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Failed to load dashboard metrics.");
        return;
      }
      setItems(data.items ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setAnalytics(data.analytics ?? null);
    } catch {
      setError("Network error while loading dashboard records.");
    } finally {
      setLoading(false);
    }
  }, [range, modeFilter, page]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      range,
      page: String(page),
      pageSize: "6",
    });
    if (modeFilter !== "ALL") params.set("mode", modeFilter);
    fetch(`/api/activities?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error?.message ?? "Failed to load dashboard metrics.");
          return;
        }
        setError(null);
        setItems(data.items ?? []);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setAnalytics(data.analytics ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Network error while loading dashboard records.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range, modeFilter, page]);

  async function toggleWidget(id: WidgetId) {
    const next = widgets.includes(id)
      ? widgets.filter((w) => w !== id)
      : [...widgets, id];
    setWidgets(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboardWidgets: next }),
    });
  }

  async function exportActivityAudit(
    row: ActivityItem,
    format: "csv" | "json"
  ) {
    setExportingId(`${row.id}:${format}`);
    setError(null);
    try {
      const res = await fetch(
        `/api/audits?activityId=${encodeURIComponent(row.id)}&format=${format}`
      );
      if (!res.ok) {
        setError("Failed to export audit report.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const safeBase =
        row.fileName
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .replace(/^-+|-+$/g, "") || "audit";
      const a = document.createElement("a");
      a.href = url;
      a.download = `zervix-audit-${safeBase}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error while exporting audit report.");
    } finally {
      setExportingId(null);
    }
  }

  const hasWidget = (id: WidgetId) => widgets.includes(id);

  const donutData = ALL_PII_CATEGORIES.map((cat) => ({
    name: PII_CATEGORIES[cat].shortLabel,
    value: analytics?.categoryTotals[cat] ?? 0,
    color: PII_CATEGORIES[cat].color,
  })).filter((d) => d.value > 0);

  const radialData = ALL_PII_CATEGORIES.map((cat) => ({
    name: PII_CATEGORIES[cat].shortLabel,
    count: analytics?.categoryTotals[cat] ?? 0,
    fill: PII_CATEGORIES[cat].color,
  }));

  const sparklineData =
    analytics && analytics.trends.length > 0
      ? analytics.trends
      : [
          { date: "T-2", documents: 0, detections: 0, sanitized: 0 },
          { date: "T-1", documents: 0, detections: 0, sanitized: 0 },
          { date: "Now", documents: 0, detections: 0, sanitized: 0 },
        ];

  const kpiCards = [
    {
      title: "Documents Processed",
      value: analytics?.totalDocuments ?? 0,
      icon: FileText,
      color: "#8B5CF6",
      sparkKey: "documents" as const,
      subtitle:
        analytics && analytics.totalDocuments > 0
          ? `${range === "all" ? "All time" : `Last ${range}`}`
          : "No documents yet",
    },
    {
      title: "PII Detected",
      value: analytics?.totalDetections ?? 0,
      icon: ShieldAlert,
      color: "#D946EF",
      sparkKey: "detections" as const,
      subtitle: `${analytics?.luhnValidCards ?? 0} Luhn-valid cards`,
    },
    {
      title: "Successfully Sanitized",
      value: analytics?.successfullySanitized ?? 0,
      icon: ShieldCheck,
      color: "#22C55E",
      sparkKey: "sanitized" as const,
      subtitle:
        analytics && analytics.totalDocuments > 0
          ? `${Math.round(
              (analytics.successfullySanitized / analytics.totalDocuments) * 100
            )}% completion rate`
          : "Zero-upload local processing",
    },
    {
      title: "Unique Entities",
      value: analytics?.uniqueEntities ?? 0,
      icon: Fingerprint,
      color: "#22D3EE",
      sparkKey: "detections" as const,
      subtitle: "Deduplicated per session",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-2xl font-bold tracking-tight">
            Security Command Center
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Welcome back, {userName}. Real-time metadata derived strictly from your
            local browser sanitization sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0 w-full lg:w-auto">
          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-cyan-400/45 px-3 py-1.5 whitespace-nowrap"
          >
            <Calendar className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <label htmlFor="dash-range" className="sr-only">
              Date Range Filter
            </label>
            <select
              id="dash-range"
              value={range}
              onChange={(e) => {
                setRange(e.target.value as "7d" | "30d" | "90d" | "all");
                setPage(1);
              }}
              className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none cursor-pointer"
            >
              <option value="7d" className="bg-[#101120]">Last 7 days</option>
              <option value="30d" className="bg-[#101120]">Last 30 days</option>
              <option value="90d" className="bg-[#101120]">Last 90 days</option>
              <option value="all" className="bg-[#101120]">All time</option>
            </select>
          </motion.div>

          <motion.button
            type="button"
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            onClick={() => widgetDialogRef.current?.showModal()}
            className="group inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-medium hover:border-violet-400/60 hover:shadow-[0_0_16px_rgba(139,92,246,0.2)] whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-violet-400 transition-transform duration-200 group-hover:rotate-90" />
            Add Widget
          </motion.button>

          <motion.div
            whileHover={{ y: -1.5, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="ml-auto sm:ml-0"
          >
            <Link
              href="/workspace"
              className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white px-4 py-2 text-xs font-semibold shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(34,211,238,0.45)] hover:opacity-95 whitespace-nowrap"
            >
              Sanitize Document
              <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Synthetic Demo Notice if present */}
      {analytics?.containsSyntheticDemo ? (
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-cyan-200">
            <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
            <span>
              Includes <strong>{analytics.syntheticDemoCount}</strong> clearly labeled{" "}
              <code className="font-mono">[SYNTHETIC DEMO]</code> metadata records for
              demonstration. Process your own TXT/CSV in the Workspace to record live
              activity.
            </span>
          </div>
          <Link
            href="/workspace"
            className="text-cyan-300 font-semibold hover:underline"
          >
            Open Workspace →
          </Link>
        </div>
      ) : null}

      {/* Error State */}
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/40 bg-red-500/15 p-4 flex items-center justify-between gap-4 text-sm text-red-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : null}

      {/* Top 4 KPI Cards */}
      {hasWidget("kpis") ? (
        <section aria-label="Key Statistics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="zervix-gradient-border rounded-2xl p-5 flex flex-col justify-between gap-3 hover:shadow-[0_0_28px_rgba(139,92,246,0.16)] transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-[var(--text-secondary)]">
                      {card.title}
                    </div>
                    <div className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums">
                      {loading ? "—" : card.value.toLocaleString()}
                    </div>
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${card.color}22`, border: `1px solid ${card.color}44` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.color }} aria-hidden="true" />
                  </div>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {card.subtitle}
                  </span>
                  <div className="w-24 h-10 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparklineData}>
                        <Area
                          type="monotone"
                          dataKey={card.sparkKey}
                          stroke={card.color}
                          strokeWidth={2}
                          fill={card.color}
                          fillOpacity={0.18}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* Main Analytics Section: 2 Columns */}
      {(hasWidget("piiDistribution") || hasWidget("detectionTrends")) ? (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {hasWidget("piiDistribution") ? (
            <div className="lg:col-span-5 zervix-glass rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-violet-300">
                  PII Distribution
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Breakdown across all 6 detected entity categories
                </p>
              </div>

              {donutData.length === 0 ? (
                <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
                  No PII detections recorded in this date range. Run a sample document
                  in the Sanitization Workspace to populate this chart.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 my-4">
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={3}
                        >
                          {donutData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#15162A",
                            borderColor: "rgba(139,92,246,0.4)",
                            borderRadius: "12px",
                            fontSize: "12px",
                            color: "#F8FAFC",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <ul className="space-y-2 text-xs">
                    {ALL_PII_CATEGORIES.map((cat) => {
                      const count = analytics?.categoryTotals[cat] ?? 0;
                      return (
                        <li key={cat} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: PII_CATEGORIES[cat].color }}
                            />
                            {PII_CATEGORIES[cat].shortLabel}
                          </span>
                          <span className="font-mono font-semibold text-[var(--text-primary)]">
                            {count}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {hasWidget("detectionTrends") ? (
            <div
              className={`${
                hasWidget("piiDistribution") ? "lg:col-span-7" : "lg:col-span-12"
              } zervix-glass rounded-2xl p-6`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-300">
                    Detection Trends
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Documents processed, PII detections, and completed sanitizations
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" /> Docs
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22D3EE]" /> PII
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" /> Sanitized
                  </span>
                </div>
              </div>

              {analytics && analytics.trends.length === 0 ? (
                <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
                  Trend timeline will appear automatically after your first sanitization
                  run.
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.trends ?? []}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        stroke="#94A3B8"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#15162A",
                          borderColor: "rgba(34,211,238,0.4)",
                          borderRadius: "12px",
                          fontSize: "12px",
                          color: "#F8FAFC",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="documents"
                        name="Documents"
                        stroke="#8B5CF6"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="detections"
                        name="PII Detections"
                        stroke="#22D3EE"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sanitized"
                        name="Sanitized"
                        stroke="#22C55E"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Bottom Section: Recent Activity Table + Category Distribution & Holographic Shield */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {hasWidget("recentActivity") ? (
          <div className="lg:col-span-8 zervix-glass rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                  Recent Sanitization Activity
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Metadata-only processing history (raw files never leave your browser)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="dash-mode-filter" className="sr-only">
                  Filter by Sanitization Mode
                </label>
                <select
                  id="dash-mode-filter"
                  value={modeFilter}
                  onChange={(e) => {
                    setModeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs focus:outline-none"
                >
                  <option value="ALL">All Modes</option>
                  <option value="FULL_MASK">Full Mask</option>
                  <option value="PARTIAL_MASK">Partial Mask</option>
                  <option value="PSEUDONYMIZE">Pseudonymize</option>
                </select>
              </div>
            </div>

            {items.length === 0 && !loading ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  No sanitization activity recorded yet for this filter.
                </p>
                <Link
                  href="/workspace"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/25 border border-violet-400/40 text-xs font-semibold text-violet-200 hover:bg-violet-600/35"
                >
                  Process Your First Document
                </Link>
              </div>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-label="Recent Sanitization Activity Table"
                className="zervix-table-wrap rounded-xl border border-[var(--border-subtle)]"
              >
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase text-[11px]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">File Name</th>
                      <th className="py-3 px-4 font-semibold">Date & Time</th>
                      <th className="py-3 px-4 font-semibold">Mode</th>
                      <th className="py-3 px-4 font-semibold">Detections</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Export</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {items.map((row) => (
                      <tr key={row.id} className="hover:bg-white/[0.03] transition">
                        <td className="py-3 px-4 font-medium text-[var(--text-primary)] max-w-[220px] truncate">
                          {row.fileName}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block whitespace-nowrap px-2.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-violet-200 text-[11px]">
                            {row.sanitizationMode.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-cyan-300">
                          {row.totalDetections}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <motion.button
                              type="button"
                              whileHover={{ y: -1, scale: 1.03 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={exportingId === `${row.id}:csv`}
                              onClick={() => void exportActivityAudit(row, "csv")}
                              title="Download audit report as CSV"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                            >
                              <Download className="w-3 h-3" />
                              CSV
                            </motion.button>
                            <motion.button
                              type="button"
                              whileHover={{ y: -1, scale: 1.03 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={exportingId === `${row.id}:json`}
                              onClick={() => void exportActivityAudit(row, "json")}
                              title="Download audit report as JSON"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-400/35 text-[11px] font-medium text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
                            >
                              <Download className="w-3 h-3" />
                              JSON
                            </motion.button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 ? (
              <div className="flex items-center justify-between pt-2 text-xs text-[var(--text-secondary)]">
                <span>
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Right Column: Category Breakdown + Holographic Shield */}
        <div
          className={`${
            hasWidget("recentActivity") ? "lg:col-span-4" : "lg:col-span-12"
          } space-y-6`}
        >
          {hasWidget("categoryBreakdown") ? (
            <div className="zervix-glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-fuchsia-300">
                PII Category Distribution
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Radial density across active privacy detectors
              </p>
              <div className="h-56 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="22%"
                    outerRadius="95%"
                    barSize={10}
                    data={radialData}
                  >
                    <RadialBar background={{ fill: "rgba(255,255,255,0.04)" }} dataKey="count" cornerRadius={6} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#15162A",
                        borderColor: "rgba(217,70,239,0.4)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "#F8FAFC",
                      }}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {hasWidget("holographicShield") ? (
            <div className="zervix-gradient-border rounded-2xl p-6 flex flex-col items-center text-center gap-3">
              <HolographicShield compact label="PRIVACY SHIELD VERIFIED" />
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Documents remain inside browser memory. Only non-sensitive audit
                metadata is persisted to PostgreSQL.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Customize Widgets Native Modal */}
      <dialog
        ref={widgetDialogRef}
        aria-labelledby="widget-modal-title"
        closedby="any"
        className="m-auto w-[min(440px,calc(100vw-2rem))] rounded-2xl zervix-elevated p-6 text-[var(--text-primary)] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h1 id="widget-modal-title" className="text-base font-bold">
            Customize Dashboard Widgets
          </h1>
          <button
            type="button"
            onClick={() => widgetDialogRef.current?.close()}
            aria-label="Close widget modal"
            className="p-1.5 rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Toggle dashboard modules below. Preferences persist to your PostgreSQL profile.
        </p>
        <div className="space-y-2.5">
          {(Object.keys(WIDGET_LABELS) as WidgetId[]).map((id) => {
            const checked = widgets.includes(id);
            return (
              <label
                key={id}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] cursor-pointer text-xs font-medium"
              >
                <span>{WIDGET_LABELS[id]}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => void toggleWidget(id)}
                  className="w-4 h-4"
                />
              </label>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={() => widgetDialogRef.current?.close()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </dialog>
    </div>
  );
}
