"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  X,
  Trash2,
  ShieldAlert,
  Sparkles,
  User as UserIcon,
  Loader2,
} from "lucide-react";
import { checkPromptForPii } from "@/lib/pii/preflight";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  model?: string;
}

const SUGGESTED_QUESTIONS = [
  "How does PII detection work?",
  "What is the Luhn algorithm?",
  "Explain the three sanitization modes.",
  "How do I sanitize a CSV file?",
  "Are my documents uploaded to a server?",
  "How do I download an audit report?",
];

interface FloatingAssistantProps {
  embedded?: boolean;
  appContext?: string;
}

export function FloatingAssistant({
  embedded = false,
  appContext,
}: FloatingAssistantProps) {
  const [open, setOpen] = useState(embedded);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "model",
      text: "Hello! I am ZERVIX AI ASSISTANT. Ask me about local PII detection, Luhn/Verhoeff validation, sanitization modes, CSV handling, or audit exports. Never paste real sensitive documents or PII here.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preflightWarning, setPreflightWarning] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgSeqRef = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  async function sendQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    setApiError(null);
    setPreflightWarning(null);

    // Client-side PII preflight check before sending anything to the server
    const check = checkPromptForPii(trimmed);
    if (check.blocked) {
      setPreflightWarning(
        check.reason ??
          "Privacy Guard blocked this message because sensitive data was detected."
      );
      return;
    }

    msgSeqRef.current += 1;
    const userMsg: ChatMessage = {
      id: `u-${msgSeqRef.current}`,
      role: "user",
      text: trimmed,
    };

    const historyToSend = messages
      .filter((m) => m.id !== "welcome")
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: historyToSend,
          appContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg =
          data?.error?.message ?? "Unable to get response from ZERVIX AI Assistant.";
        if (data?.error?.code === "PII_PREFLIGHT_BLOCKED") {
          setPreflightWarning(msg);
        } else {
          setApiError(msg);
        }
        return;
      }

      msgSeqRef.current += 1;
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${msgSeqRef.current}`,
          role: "model",
          text: data.reply,
          model: data.model,
        },
      ]);
    } catch {
      setApiError("Network error while contacting ZERVIX AI Assistant.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendQuestion(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Honor IME composition before Enter submit
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendQuestion(input);
    }
  }

  function clearHistory() {
    setPreflightWarning(null);
    setApiError(null);
    setMessages([
      {
        id: "welcome",
        role: "model",
        text: "Conversation cleared. Ask any general question about ZERVIX privacy controls, PII categories, or workflows.",
      },
    ]);
  }

  const panel = (
    <div
      className={
        embedded
          ? "zervix-glass rounded-2xl flex flex-col h-[640px] max-h-[75vh] overflow-hidden shadow-2xl"
          : "fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(580px,calc(100dvh-5rem))] zervix-elevated rounded-2xl flex flex-col overflow-hidden shadow-[0_20px_70px_rgba(5,5,9,0.85)]"
      }
      role={embedded ? undefined : "dialog"}
      aria-label="ZERVIX AI Assistant"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-gradient-to-r from-violet-600/20 via-[#15162A] to-cyan-500/15">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.5)]">
            <Bot className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              ZERVIX AI ASSISTANT
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Product Help • Dual PII Preflight Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearHistory}
            title="Clear conversation"
            aria-label="Clear conversation"
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {!embedded ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Minimize assistant"
              aria-label="Close AI Assistant"
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex gap-1.5 overflow-x-auto shrink-0">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void sendQuestion(q)}
            disabled={loading}
            className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-200 hover:bg-violet-500/20 hover:border-cyan-400/40 transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        aria-live="polite"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${
              m.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                m.role === "user"
                  ? "bg-violet-600/30 border border-violet-400/40 text-violet-200"
                  : "bg-cyan-500/20 border border-cyan-400/35 text-cyan-300"
              }`}
            >
              {m.role === "user" ? (
                <UserIcon className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </div>
            <div
              className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-gradient-to-br from-violet-600/80 to-purple-600/80 text-white"
                  : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              }`}
            >
              {m.text}
              {m.model ? (
                <div className="mt-1.5 text-[10px] text-cyan-400/80">
                  ZERVIX AI
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-cyan-300 pl-9">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            <span>Thinking with ZERVIX AI...</span>
          </div>
        ) : null}
      </div>

      {/* Warnings & Errors */}
      {preflightWarning ? (
        <div
          role="alert"
          className="mx-3 mb-2 p-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 flex items-start gap-2"
        >
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{preflightWarning}</span>
        </div>
      ) : null}

      {apiError ? (
        <div
          role="alert"
          className="mx-3 mb-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200"
        >
          {apiError}
        </div>
      ) : null}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 flex items-end gap-2"
      >
        <label htmlFor="zervix-ai-input" className="sr-only">
          Ask ZERVIX AI Assistant
        </label>
        <textarea
          id="zervix-ai-input"
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (preflightWarning) setPreflightWarning(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask about PII detection, Luhn, CSVs... (no raw PII)"
          className="flex-1 resize-none rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-cyan-400/60 focus:outline-none min-h-[42px] max-h-28"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send question"
          className="h-[42px] px-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-medium text-sm flex items-center justify-center gap-1.5 hover:opacity-95 disabled:opacity-45 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );

  if (embedded) return panel;

  return (
    <>
      {open ? panel : null}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open ZERVIX AI Assistant"
          className="fixed bottom-5 right-5 z-40 group flex items-center gap-2.5 rounded-full px-4 py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white shadow-[0_0_28px_rgba(139,92,246,0.55)] hover:shadow-[0_0_36px_rgba(34,211,238,0.65)] transition"
        >
          <Bot className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-semibold hidden sm:inline">
            ZERVIX AI
          </span>
          <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
        </button>
      ) : null}
    </>
  );
}
