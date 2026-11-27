export type ThemePreference = "DARK" | "LIGHT" | "SYSTEM";
export type EffectiveTheme = "dark" | "light";

const STORAGE_KEY = "zervix-color-scheme";

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "DARK";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)?.toLowerCase();
    if (raw === "light") return "LIGHT";
    if (raw === "dark") return "DARK";
    if (raw === "system") return "SYSTEM";
  } catch {
    // Ignore storage access errors
  }
  return "DARK";
}

export function resolveEffectiveTheme(mode: ThemePreference): EffectiveTheme {
  if (mode === "LIGHT") return "light";
  if (mode === "DARK") return "dark";
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function applyTheme(mode: ThemePreference): EffectiveTheme {
  const effective = resolveEffectiveTheme(mode);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = effective;
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute("content", effective);
    }
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode.toLowerCase());
    } catch {
      // Ignore storage access errors
    }
    window.dispatchEvent(
      new CustomEvent("zervix:theme-updated", { detail: { theme: mode, effective } })
    );
  }
  return effective;
}
