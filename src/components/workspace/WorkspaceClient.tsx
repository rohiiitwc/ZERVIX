"use client";

import { useState, useRef } from "react";
import { motion, MotionConfig, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Play,
  RotateCcw,
  Copy,
  Check,
  Download,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  Clock,
} from "lucide-react";
import {
  ALL_PII_CATEGORIES,
  CsvSanitizationResult,
  DetectedEntity,
  PII_CATEGORIES,
  PiiCategory,
  RedactionMode,
  SanitizationResult,
} from "@/lib/pii/types";
import { sanitizeDocumentText } from "@/lib/pii/sanitizer";
import { sanitizeCsvDocument } from "@/lib/pii/csv";
import { SYNTHETIC_SAMPLES } from "@/lib/pii/samples";

function HighlightedText({
  text,
  entities,
  mode,
}: {
  text: string;
  entities: DetectedEntity[];
  mode: "original" | "sanitized";
}) {
  if (!text) {
    return (
      <span className="text-[var(--text-secondary)] italic">
        No document content yet.
      </span>
    );
  }

  if (entities.length === 0) {
    return <>{text}</>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  const sorted = [...entities].sort((a, b) =>
    mode === "original" ? a.start - b.start : a.sanitizedStart - b.sanitizedStart
  );

  sorted.forEach((entity, index) => {
    const start = mode === "original" ? entity.start : entity.sanitizedStart;
    const end = mode === "original" ? entity.end : entity.sanitizedEnd;
    if (start > cursor) {
      parts.push(<span key={`plain-${index}`}>{text.slice(cursor, start)}</span>);
    }
    const meta = PII_CATEGORIES[entity.category];
    parts.push(
      <mark
        key={entity.id}
        title={`${meta.label} (${entity.validationStatus})`}
        className="rounded px-1 py-0.5 font-mono text-[12px] font-semibold"
        style={{
          backgroundColor: meta.badgeBg,
          color: meta.color,
          border: `1px solid ${meta.color}55`,
        }}
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });

  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}

export function WorkspaceClient({
  defaultMode = "PARTIAL_MASK",
  defaultCategories = ALL_PII_CATEGORIES,
}: {
  defaultMode?: RedactionMode;
  defaultCategories?: PiiCategory[];
}) {
  const [fileName, setFileName] = useState("Pasted Document");
  const [fileType, setFileType] = useState<"TXT" | "CSV" | "TEXT">("TEXT");
  const [rawInput, setRawInput] = useState("");
  const [mode, setMode] = useState<RedactionMode>(defaultMode);
  const [enabledCategories, setEnabledCategories] =
    useState<PiiCategory[]>(defaultCategories);
  const [dragActive, setDragActive] = useState(false);

  const [textResult, setTextResult] = useState<SanitizationResult | null>(null);
  const [csvResult, setCsvResult] = useState<CsvSanitizationResult | null>(null);
  const [csvViewMode, setCsvViewMode] = useState<"table" | "raw">("table");
  const [activityId, setActivityId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSpin, setResetSpin] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingActivityPromiseRef = useRef<Promise<string | null> | null>(null);

  function toggleCategory(cat: PiiCategory) {
    setEnabledCategories((prev) => {
      if (prev.includes(cat)) {
        if (prev.length === 1) return prev; // Keep at least 1 active
        return prev.filter((c) => c !== cat);
      }
      return [...prev, cat];
    });
  }

  async function handleFileLoad(file: File) {
    setErrorMsg(null);
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("File exceeds recommended 15 MB browser workspace limit.");
      return;
    }
    const lower = file.name.toLowerCase();
    const isCsv = lower.endsWith(".csv");
    const isTxt = lower.endsWith(".txt") || lower.endsWith(".log") || !isCsv;
    const text = await file.text();
    setFileName(file.name);
    setFileType(isCsv ? "CSV" : isTxt ? "TXT" : "TEXT");
    setRawInput(text);
    setTextResult(null);
    setCsvResult(null);
    setActivityId(null);
    setStatusMessage(`Loaded "${file.name}" locally inside your browser (${file.size} bytes).`);
  }

  function loadSample(sampleId: string) {
    const sample = SYNTHETIC_SAMPLES.find((s) => s.id === sampleId);
    if (!sample) return;
    setErrorMsg(null);
    setFileName(sample.fileName);
    setFileType(sample.fileType);
    setRawInput(sample.content);
    setTextResult(null);
    setCsvResult(null);
    setActivityId(null);
    setStatusMessage(`Loaded synthetic sample "${sample.label}" locally.`);
  }

  async function processDocument() {
    setErrorMsg(null);
    setStatusMessage(null);
    if (!rawInput.trim()) {
      setErrorMsg("Upload a TXT/CSV file, paste text, or load a synthetic sample first.");
      return;
    }

    const byteSize = new Blob([rawInput]).size;

    if (fileType === "CSV") {
      const res = sanitizeCsvDocument(rawInput, {
        mode,
        enabledCategories,
      });
      setCsvResult(res);
      setTextResult(null);
      await persistMetadataOnly({
        fileName,
        fileType: "CSV",
        fileSizeBytes: byteSize,
        rowCount: res.rowCount,
        sanitizationMode: mode,
        enabledCategories,
        summary: res.summary,
      });
    } else {
      const res = sanitizeDocumentText(rawInput, {
        mode,
        enabledCategories,
      });
      setTextResult(res);
      setCsvResult(null);
      await persistMetadataOnly({
        fileName,
        fileType,
        fileSizeBytes: byteSize,
        rowCount: 0,
        sanitizationMode: mode,
        enabledCategories,
        summary: res.summary,
      });
    }
  }

  function persistMetadataOnly(payload: {
    fileName: string;
    fileType: "TXT" | "CSV" | "TEXT";
    fileSizeBytes: number;
    rowCount: number;
    sanitizationMode: RedactionMode;
    enabledCategories: PiiCategory[];
    summary: SanitizationResult["summary"];
  }) {
    const task = (async (): Promise<string | null> => {
      try {
        // Privacy Guarantee: ONLY metadata & counts are transmitted — NEVER raw text or PII values!
        const res = await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: payload.fileName,
            fileType: payload.fileType,
            fileSizeBytes: payload.fileSizeBytes,
            rowCount: payload.rowCount,
            sanitizationMode: payload.sanitizationMode,
            enabledCategories: payload.enabledCategories,
            totalDetections: payload.summary.totalDetections,
            uniqueEntities: payload.summary.uniqueEntities,
            categoryCounts: payload.summary.categoryCounts,
            luhnValidCards: payload.summary.luhnValidCards,
            luhnInvalidCandidates: payload.summary.luhnInvalidCandidates,
            aadhaarValidFormat: payload.summary.aadhaarValidFormat,
            durationMs: payload.summary.durationMs,
            status: "COMPLETED",
            exportedFormat: "NONE",
          }),
        });
        const data = await res.json();
        if (res.ok && data.activity?.id) {
          setActivityId(data.activity.id);
          setStatusMessage(
            "Document sanitized locally in browser. Non-sensitive audit metadata saved."
          );
          return data.activity.id as string;
        }
        setStatusMessage("Document sanitized locally in browser.");
        return null;
      } catch {
        setStatusMessage("Document sanitized locally in browser.");
        return null;
      }
    })();

    pendingActivityPromiseRef.current = task;
    return task;
  }

  async function recordExportFormat(exportedFormat: "COPY" | "TXT" | "CSV") {
    const targetId = activityId ?? (await pendingActivityPromiseRef.current);
    if (!targetId) return;
    await fetch(`/api/activities/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exportedFormat }),
    });
  }

  const sanitizedOutputText =
    fileType === "CSV"
      ? csvResult?.serializedCsv ?? ""
      : textResult?.sanitizedText ?? "";

  async function copySanitized() {
    if (!sanitizedOutputText) return;
    await navigator.clipboard.writeText(sanitizedOutputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    await recordExportFormat("COPY");
  }

  async function downloadSanitized(ext: "txt" | "csv") {
    if (!sanitizedOutputText) return;
    const mime =
      ext === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
    const blob = new Blob([sanitizedOutputText], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = fileName.replace(/\.(txt|csv|log)$/i, "") || "sanitized-document";
    a.href = url;
    a.download = `${baseName}-sanitized.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    await recordExportFormat(ext === "csv" ? "CSV" : "TXT");
  }

  function resetWorkspace() {
    setResetSpin((s) => s + 1);
    setFileName("Pasted Document");
    setFileType("TEXT");
    setRawInput("");
    setTextResult(null);
    setCsvResult(null);
    setActivityId(null);
    pendingActivityPromiseRef.current = null;
    setErrorMsg(null);
    setStatusMessage("Workspace and local pseudonymization session cleared.");
  }

  const activeSummary =
    fileType === "CSV" ? csvResult?.summary : textResult?.summary;

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Sanitization Workspace
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Zero-upload local PII detection and redaction for TXT, CSV, and pasted
              text.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-xs text-emerald-300">
            <Cpu className="w-4 h-4 shrink-0" />
            <span>100% Browser Local Execution</span>
          </div>
        </motion.div>

        {/* Upload + Sample + Controls */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Input & File Upload */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 zervix-glass rounded-2xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">1. Input Document</h3>
              <div className="flex flex-wrap gap-2">
                {SYNTHETIC_SAMPLES.map((s) => (
                  <motion.button
                    key={s.id}
                    type="button"
                    whileHover={{ y: -1, scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 420, damping: 24 }}
                    onClick={() => loadSample(s.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-400/30 text-violet-200 hover:bg-violet-500/25 hover:border-cyan-400/45"
                  >
                    {s.fileType === "CSV" ? (
                      <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1.5" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 inline mr-1.5" />
                    )}
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFileLoad(file);
              }}
              className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${
                dragActive
                  ? "border-cyan-400 bg-cyan-500/10 scale-[1.01]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:border-violet-400/50"
              }`}
            >
              <Upload className="w-6 h-6 mx-auto text-cyan-400 mb-2" />
              <p className="text-xs text-[var(--text-primary)] font-medium">
                Drag & drop a <code className="text-cyan-300">.txt</code> or{" "}
                <code className="text-cyan-300">.csv</code> file here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-violet-400 underline font-semibold"
                >
                  browse local files
                </button>
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                Active source: <strong className="text-[var(--text-primary)]">{fileName}</strong> ({fileType})
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.log,text/plain,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileLoad(file);
                }}
              />
            </div>

            {/* Paste Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="workspace-input" className="text-xs font-medium">
                  Or paste document text / CSV rows directly
                </label>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-[var(--text-secondary)]">Format:</span>
                  {(["TEXT", "TXT", "CSV"] as const).map((t) => (
                    <motion.button
                      key={t}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setFileType(t)}
                      className={`px-2 py-0.5 rounded transition ${
                        fileType === t
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {t}
                    </motion.button>
                  ))}
                </div>
              </div>
              <textarea
                id="workspace-input"
                rows={7}
                value={rawInput}
                onChange={(e) => {
                  setRawInput(e.target.value);
                  setTextResult(null);
                  setCsvResult(null);
                }}
                placeholder="Paste sensitive logs, customer exports, or CSV data here..."
                className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 text-xs font-mono text-[var(--text-primary)] focus:border-cyan-400 focus:shadow-[0_0_16px_rgba(34,211,238,0.16)] focus:outline-none transition"
              />
            </div>
          </motion.div>

          {/* Right: Categories, Modes & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 zervix-glass rounded-2xl p-5 flex flex-col justify-between gap-5"
          >
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  2. PII Detection Categories
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PII_CATEGORIES.map((cat) => {
                    const meta = PII_CATEGORIES[cat];
                    const active = enabledCategories.includes(cat);
                    return (
                      <motion.label
                        key={cat}
                        whileHover={{ y: -1.5, scale: 1.01 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 420, damping: 26 }}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          active
                            ? "bg-[var(--bg-elevated)] border-violet-400/45 text-[var(--text-primary)] shadow-[0_0_14px_rgba(139,92,246,0.14)]"
                            : "bg-[var(--bg-secondary)]/50 border-transparent text-[var(--text-secondary)] hover:border-white/10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleCategory(cat)}
                          className="w-4 h-4"
                        />
                        <motion.span
                          animate={{ scale: active ? 1.15 : 0.85, opacity: active ? 1 : 0.45 }}
                          transition={{ type: "spring", stiffness: 450, damping: 22 }}
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="truncate font-medium">{meta.label}</span>
                      </motion.label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">3. Sanitization Mode</h3>
                <div className="space-y-2">
                  {[
                    {
                      id: "FULL_MASK" as const,
                      title: "Full Mask",
                      desc: "Replaces every detected entity with [REDACTED]",
                    },
                    {
                      id: "PARTIAL_MASK" as const,
                      title: "Partial Mask",
                      desc: "Preserves minimal verification digits/prefix",
                    },
                    {
                      id: "PSEUDONYMIZE" as const,
                      title: "Consistent Pseudonymization",
                      desc: "Session-scoped EMAIL_01 / PAN_01 / CARD_01 tokens",
                    },
                  ].map((m) => {
                    const selected = mode === m.id;
                    return (
                      <motion.label
                        key={m.id}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        className="relative flex items-start gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 cursor-pointer overflow-hidden"
                      >
                        {selected ? (
                          <motion.span
                            layoutId="zervix-workspace-mode-pill"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            aria-hidden="true"
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600/20 via-purple-600/15 to-cyan-500/10 border border-cyan-400/55 shadow-[0_0_20px_rgba(34,211,238,0.16)]"
                          />
                        ) : null}
                        <input
                          type="radio"
                          name="redaction-mode"
                          checked={selected}
                          onChange={() => setMode(m.id)}
                          className="relative z-10 mt-0.5"
                        />
                        <div className="relative z-10">
                          <div className="text-xs font-semibold">{m.title}</div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {m.desc}
                          </div>
                        </div>
                      </motion.label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <motion.button
                type="button"
                whileHover={{ y: -1.5, scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                onClick={() => void processDocument()}
                className="group flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-sm font-semibold shadow-[0_0_24px_rgba(139,92,246,0.4)] hover:shadow-[0_0_32px_rgba(34,211,238,0.48)] hover:opacity-95"
              >
                <Play className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                Process Document
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ y: -1, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                onClick={resetWorkspace}
                className="min-h-[44px] px-4 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-xs font-medium hover:border-red-400/50"
              >
                <motion.span
                  animate={{ rotate: resetSpin * -360 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center"
                >
                  <RotateCcw className="w-4 h-4" />
                </motion.span>
                Reset
              </motion.button>
            </div>
          </motion.div>
        </section>

        {/* Alerts */}
        <AnimatePresence>
          {errorMsg ? (
            <motion.div
              key="ws-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              role="alert"
              className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          ) : null}

          {statusMessage ? (
            <motion.div
              key="ws-status"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              role="status"
              className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-xs text-cyan-200 flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{statusMessage}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Summary & Export Bar */}
        {activeSummary ? (
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="zervix-gradient-border rounded-2xl p-5 space-y-4"
          >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-[var(--text-secondary)]">Detections:</span>{" "}
                <strong className="font-mono text-cyan-300">
                  {activeSummary.totalDetections}
                </strong>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Unique Entities:</span>{" "}
                <strong className="font-mono text-violet-300">
                  {activeSummary.uniqueEntities}
                </strong>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Mode:</span>{" "}
                <strong className="text-[var(--text-primary)]">
                  {mode.replace(/_/g, " ")}
                </strong>
              </div>
              <div className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono">{activeSummary.durationMs} ms</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copySanitized()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs font-medium hover:border-cyan-400/50"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy Sanitized"}
              </button>
              <button
                type="button"
                onClick={() => void downloadSanitized("txt")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/20 border border-violet-400/40 text-xs font-medium text-violet-200 hover:bg-violet-500/30"
              >
                <Download className="w-3.5 h-3.5" />
                Download TXT
              </button>
              {fileType === "CSV" ? (
                <button
                  type="button"
                  onClick={() => void downloadSanitized("csv")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </button>
              ) : null}
            </div>
          </div>

          {/* Category Counts + Luhn / Aadhaar Validation Status */}
          <div className="flex flex-wrap gap-2">
            {ALL_PII_CATEGORIES.map((cat) => {
              const count = activeSummary.categoryCounts[cat];
              const meta = PII_CATEGORIES[cat];
              return (
                <span
                  key={cat}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium border"
                  style={{
                    backgroundColor: meta.badgeBg,
                    color: meta.color,
                    borderColor: `${meta.color}44`,
                  }}
                >
                  {meta.shortLabel}: {count}
                </span>
              );
            })}
          </div>

          <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap gap-4 border-t border-[var(--border-subtle)] pt-3">
            <span>
              Luhn-valid card candidates:{" "}
              <strong className="text-emerald-400">{activeSummary.luhnValidCards}</strong>{" "}
              (Rejected non-Luhn candidates:{" "}
              <strong className="text-[var(--text-primary)]">
                {activeSummary.luhnInvalidCandidates}
              </strong>
              )
            </span>
            <span>
              Aadhaar format candidates:{" "}
              <strong className="text-purple-300">{activeSummary.aadhaarValidFormat}</strong>{" "}
              — format/checksum checks never verify official issuance.
            </span>
          </div>
        </motion.section>
      ) : null}

      {/* Live Document Comparison Panels */}
      {textResult ? (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <div className="zervix-glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-red-300">
                Original Document (Detected PII Highlighted)
              </h3>
              <span className="text-[11px] text-[var(--text-secondary)]">
                Local Browser Memory Only
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 text-xs font-mono leading-relaxed min-h-[240px]">
              <HighlightedText
                text={textResult.originalText}
                entities={textResult.entities}
                mode="original"
              />
            </pre>
          </div>

          <div className="zervix-glass rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-300">
                Sanitized Document (Replacements Highlighted)
              </h3>
              <span className="text-[11px] text-cyan-300">
                Safe for Export
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 text-xs font-mono leading-relaxed min-h-[240px]">
              <HighlightedText
                text={textResult.sanitizedText}
                entities={textResult.entities}
                mode="sanitized"
              />
            </pre>
          </div>
        </motion.section>
      ) : null}

      {csvResult ? (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Live CSV Comparison ({csvResult.rowCount} rows × {csvResult.columnCount}{" "}
              columns)
            </h3>
            <div className="flex rounded-xl border border-[var(--border-subtle)] overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setCsvViewMode("table")}
                className={`px-3 py-1.5 ${
                  csvViewMode === "table"
                    ? "bg-violet-600/30 text-white"
                    : "bg-[var(--bg-card)] text-[var(--text-secondary)]"
                }`}
              >
                Table Comparison
              </button>
              <button
                type="button"
                onClick={() => setCsvViewMode("raw")}
                className={`px-3 py-1.5 ${
                  csvViewMode === "raw"
                    ? "bg-violet-600/30 text-white"
                    : "bg-[var(--bg-card)] text-[var(--text-secondary)]"
                }`}
              >
                Serialized CSV
              </button>
            </div>
          </div>

          {csvViewMode === "table" ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Original CSV Table */}
              <div className="zervix-glass rounded-2xl p-4 space-y-2">
                <div className="text-xs font-semibold text-red-300">
                  Original CSV Cells
                </div>
                <div className="zervix-table-wrap rounded-xl border border-[var(--border-subtle)]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[var(--bg-secondary)]">
                      <tr>
                        {csvResult.headers.map((h, i) => (
                          <th key={i} className="p-2.5 border-b border-[var(--border-subtle)] font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {csvResult.originalRows.slice(0, 50).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => {
                            const match = csvResult.cellResults.find(
                              (c) => c.rowIndex === rIdx && c.colIndex === cIdx
                            );
                            return (
                              <td key={cIdx} className="p-2.5 font-mono whitespace-pre-wrap align-top">
                                {match ? (
                                  <HighlightedText
                                    text={cell}
                                    entities={match.entities}
                                    mode="original"
                                  />
                                ) : (
                                  cell
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sanitized CSV Table */}
              <div className="zervix-glass rounded-2xl p-4 space-y-2">
                <div className="text-xs font-semibold text-emerald-300">
                  Sanitized CSV Cells
                </div>
                <div className="zervix-table-wrap rounded-xl border border-[var(--border-subtle)]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[var(--bg-secondary)]">
                      <tr>
                        {csvResult.headers.map((h, i) => (
                          <th key={i} className="p-2.5 border-b border-[var(--border-subtle)] font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {csvResult.sanitizedRows.slice(0, 50).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => {
                            const match = csvResult.cellResults.find(
                              (c) => c.rowIndex === rIdx && c.colIndex === cIdx
                            );
                            return (
                              <td key={cIdx} className="p-2.5 font-mono whitespace-pre-wrap align-top">
                                {match ? (
                                  <HighlightedText
                                    text={cell}
                                    entities={match.entities}
                                    mode="sanitized"
                                  />
                                ) : (
                                  cell
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="zervix-glass rounded-2xl p-4 space-y-2">
                <div className="text-xs font-semibold text-red-300">Original Raw CSV</div>
                <pre className="whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-secondary)] p-4 text-xs font-mono">
                  {rawInput}
                </pre>
              </div>
              <div className="zervix-glass rounded-2xl p-4 space-y-2">
                <div className="text-xs font-semibold text-emerald-300">
                  Sanitized Serialized CSV (PapaParse RFC-4180)
                </div>
                <pre className="whitespace-pre-wrap break-words rounded-xl bg-[var(--bg-secondary)] p-4 text-xs font-mono">
                  {csvResult.serializedCsv}
                </pre>
              </div>
            </div>
          )}
        </motion.section>
      ) : null}
    </div>
    </MotionConfig>
  );
}
