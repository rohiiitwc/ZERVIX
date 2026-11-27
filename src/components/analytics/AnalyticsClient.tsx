"use client";

import { useState, useEffect } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  Filter,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Download,
  FileSpreadsheet,
  FileJson,
  Loader2,
} from "lucide-react";
import { ALL_PII_CATEGORIES, PII_CATEGORIES, PiiCategory } from "@/lib/pii/types";

interface AnalyticsActivity {
  id: string;
  fileName: string;
  fileType: string;
  sanitizationMode: string;
  totalDetections: number;
  uniqueEntities: number;
  luhnValidCards: number;
  luhnInvalidCandidates: number;
  aadhaarValidFormat: number;
  durationMs: number;
  status: string;
  createdAt: string;
}

interface AnalyticsSummary {
  totalDocuments: number;
  totalDetections: number;
  successfullySanitized: number;
  uniqueEntities: number;
  categoryTotals: Record<PiiCategory, number>;
  luhnValidCards: number;
  luhnInvalidCandidates: number;
  aadhaarValidFormat: number;
  trends: Array<{
    date: string;
    documents: number;
    detections: number;
    sanitized: number;
  }>;
}

export function AnalyticsClient() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("ALL");
  const [mode, setMode] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AnalyticsActivity[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [resetSpin, setResetSpin] = useState(0);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sp = new URLSearchParams({
      range: "all",
      page: String(page),
      pageSize: "10",
    });
    if (dateFrom) sp.set("dateFrom", dateFrom);
    if (dateTo) sp.set("dateTo", dateTo);
    if (category !== "ALL") sp.set("category", category);
    if (mode !== "ALL") sp.set("mode", mode);
    if (status !== "ALL") sp.set("status", status);

    fetch(`/api/activities?${sp.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!cancelled && res.ok) {
          setItems(data.items ?? []);
          setTotalPages(data.pagination?.totalPages ?? 1);
          setAnalytics(data.analytics ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, category, mode, status, page]);

  function resetFilters() {
    setResetSpin((s) => s + 1);
    setDateFrom("");
    setDateTo("");
    setCategory("ALL");
    setMode("ALL");
    setStatus("ALL");
    setPage(1);
  }

  async function handleExport(format: "csv" | "json", activityId?: string) {
    const key = `${activityId ?? "all"}:${format}`;
    setExportingKey(key);
    setExportError(null);
    try {
      const sp = new URLSearchParams({ format });
      if (activityId) {
        sp.set("activityId", activityId);
      } else {
        if (dateFrom) sp.set("dateFrom", dateFrom);
        if (dateTo) sp.set("dateTo", dateTo);
      }
      const res = await fetch(`/api/audits?${sp.toString()}`);
      if (!res.ok) {
        setExportError("Failed to export analytics report.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = activityId
        ? `zervix-analytics-${activityId.slice(0, 8)}.${format}`
        : `zervix-analytics-report.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Network error while exporting analytics report.");
    } finally {
      setExportingKey(null);
    }
  }

  const barData = ALL_PII_CATEGORIES.map((cat) => ({
    name: PII_CATEGORIES[cat].shortLabel,
    count: analytics?.categoryTotals[cat] ?? 0,
    color: PII_CATEGORIES[cat].color,
  }));

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Detection Analytics</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Aggregated from your stored non-sensitive metadata records. ZERVIX never
              invents accuracy scores or synthetic compliance ratings.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              disabled={exportingKey !== null}
              onClick={() => void handleExport("csv")}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-500/20 border border-violet-400/40 px-4 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/30 disabled:opacity-50 cursor-pointer"
            >
              {exportingKey === "all:csv" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Export CSV
            </button>
            <button
              type="button"
              disabled={exportingKey !== null}
              onClick={() => void handleExport("json")}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50 cursor-pointer"
            >
              {exportingKey === "all:json" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4" />
              )}
              Export JSON
            </button>
          </div>
        </motion.div>

        {exportError ? (
          <div role="alert" className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200">
            {exportError}
          </div>
        ) : null}

        {/* Filters */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="zervix-glass rounded-2xl p-4 hover:border-violet-400/35"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-300 mb-3">
            <Filter className="w-4 h-4" />
            Filter Metadata Analytics
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label htmlFor="an-from" className="block text-[11px] text-[var(--text-secondary)] mb-1">
                From Date
              </label>
              <input
                id="an-from"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs focus:border-cyan-400/60 focus:shadow-[0_0_12px_rgba(34,211,238,0.16)] focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="an-to" className="block text-[11px] text-[var(--text-secondary)] mb-1">
                To Date
              </label>
              <input
                id="an-to"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs focus:border-cyan-400/60 focus:shadow-[0_0_12px_rgba(34,211,238,0.16)] focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="an-cat" className="block text-[11px] text-[var(--text-secondary)] mb-1">
                PII Category
              </label>
              <select
                id="an-cat"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs focus:border-cyan-400/60 focus:shadow-[0_0_12px_rgba(34,211,238,0.16)] focus:outline-none transition cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {ALL_PII_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {PII_CATEGORIES[c].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="an-mode" className="block text-[11px] text-[var(--text-secondary)] mb-1">
                Sanitization Mode
              </label>
              <select
                id="an-mode"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs focus:border-cyan-400/60 focus:shadow-[0_0_12px_rgba(34,211,238,0.16)] focus:outline-none transition cursor-pointer"
              >
                <option value="ALL">All Modes</option>
                <option value="FULL_MASK">Full Mask</option>
                <option value="PARTIAL_MASK">Partial Mask</option>
                <option value="PSEUDONYMIZE">Pseudonymize</option>
              </select>
            </div>

            <div>
              <label htmlFor="an-status" className="block text-[11px] text-[var(--text-secondary)] mb-1">
                Status
              </label>
              <select
                id="an-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2 text-xs focus:border-cyan-400/60 focus:shadow-[0_0_12px_rgba(34,211,238,0.16)] focus:outline-none transition cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PARTIAL">Partial</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <motion.button
              type="button"
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-medium hover:border-cyan-400/50 hover:shadow-[0_0_14px_rgba(34,211,238,0.16)]"
            >
              <motion.span
                animate={{ rotate: resetSpin * -360 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              </motion.span>
              Reset
            </motion.button>
          </div>
        </motion.section>

        {/* Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Documents Processed",
              value: loading ? "—" : analytics?.totalDocuments ?? 0,
              colorClass: "",
              delay: 0.08,
            },
            {
              label: "Total PII Occurrences",
              value: loading ? "—" : analytics?.totalDetections ?? 0,
              colorClass: "text-cyan-300",
              delay: 0.13,
            },
            {
              label: "Unique Entities",
              value: loading ? "—" : analytics?.uniqueEntities ?? 0,
              colorClass: "text-violet-300",
              delay: 0.18,
            },
          ].map((card) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{
                duration: 0.28,
                delay: card.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="zervix-glass rounded-2xl p-5 hover:border-violet-400/45 hover:shadow-[0_0_24px_rgba(139,92,246,0.16)]"
            >
              <div className="text-xs text-[var(--text-secondary)]">{card.label}</div>
              <motion.div
                key={`${card.label}-${String(card.value)}`}
                initial={{ opacity: 0.5, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`text-2xl font-bold mt-1 font-mono ${card.colorClass}`}
              >
                {card.value}
              </motion.div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.28, delay: 0.23, ease: [0.16, 1, 0.3, 1] }}
            className="zervix-glass rounded-2xl p-5 hover:border-cyan-400/45 hover:shadow-[0_0_24px_rgba(34,211,238,0.14)]"
          >
            <div className="text-xs text-[var(--text-secondary)]">Validation Breakdown</div>
            <div className="mt-1.5 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                Luhn-valid card candidates: {analytics?.luhnValidCards ?? 0}
              </div>
              <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <AlertCircle className="w-3.5 h-3.5" />
                Non-Luhn rejected: {analytics?.luhnInvalidCandidates ?? 0}
              </div>
            </div>
          </motion.div>
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="zervix-glass rounded-2xl p-6 hover:border-violet-400/35"
          >
            <h3 className="text-sm font-semibold mb-4">Category Distribution</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#15162A",
                      borderColor: "rgba(139,92,246,0.4)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#F8FAFC",
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {barData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.27, ease: [0.16, 1, 0.3, 1] }}
            className="zervix-glass rounded-2xl p-6 hover:border-cyan-400/35"
          >
            <h3 className="text-sm font-semibold mb-4">Detection & Sanitization Trends</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.trends ?? []}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#15162A",
                      borderColor: "rgba(34,211,238,0.4)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#F8FAFC",
                    }}
                  />
                  <Line type="monotone" dataKey="documents" stroke="#8B5CF6" strokeWidth={2} />
                  <Line type="monotone" dataKey="detections" stroke="#22D3EE" strokeWidth={2} />
                  <Line type="monotone" dataKey="sanitized" stroke="#22C55E" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </section>

        {/* Processing History Table */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="zervix-glass rounded-2xl p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold">Processing History</h3>
          {items.length === 0 && !loading ? (
            <p className="text-xs text-[var(--text-secondary)] py-8 text-center">
              No processing records match these filters.
            </p>
          ) : (
            <div className="zervix-table-wrap rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Detections</th>
                    <th className="py-3 px-4">Unique</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 font-medium max-w-[220px] truncate">
                        {item.fileName}
                      </td>
                      <td className="py-3 px-4">{item.fileType}</td>
                      <td className="py-3 px-4">{item.sanitizationMode.replace(/_/g, " ")}</td>
                      <td className="py-3 px-4 font-mono text-cyan-300">{item.totalDetections}</td>
                      <td className="py-3 px-4 font-mono text-violet-300">{item.uniqueEntities}</td>
                      <td className="py-3 px-4 font-mono">{item.durationMs} ms</td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={exportingKey !== null}
                            onClick={() => void handleExport("csv", item.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50 cursor-pointer"
                            title="Export CSV audit"
                          >
                            <Download className="w-3 h-3" />
                            CSV
                          </button>
                          <button
                            type="button"
                            disabled={exportingKey !== null}
                            onClick={() => void handleExport("json", item.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 border border-violet-400/35 text-[11px] font-medium text-violet-200 hover:bg-violet-500/25 disabled:opacity-50 cursor-pointer"
                            title="Export JSON audit"
                          >
                            <Download className="w-3 h-3" />
                            JSON
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-40 hover:border-cyan-400/50"
                >
                  Previous
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] disabled:opacity-40 hover:border-cyan-400/50"
                >
                  Next
                </motion.button>
              </div>
            </div>
          ) : null}
        </motion.section>
      </div>
    </MotionConfig>
  );
}
