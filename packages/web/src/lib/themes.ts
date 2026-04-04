export interface Theme {
  id: string;
  name: string;
  description: string;
  vars: Record<string, string>;
}

const midnightVars: Record<string, string> = {
  "--color-background": "#06080d",
  "--color-surface": "#131a23",
  "--color-surface-light": "#1d2632",
  "--color-border": "#3a4452",
  "--color-foreground": "#f0f6fc",
  "--color-muted": "#8b949e",
  "--color-accent": "#58a6ff",
  "--color-accent-hover": "#79c0ff",
  "--color-success": "#3fb950",
  "--color-danger": "#f85149",
  "--color-warning": "#d29922",
  "--font-sans": "'JetBrains Mono', 'Fira Code', monospace",
  "--font-display": "'Space Grotesk', 'Inter', sans-serif",
};

const arcticVars: Record<string, string> = {
  "--color-background": "#f8fafc",
  "--color-surface": "#ffffff",
  "--color-surface-light": "#f1f5f9",
  "--color-border": "#e2e8f0",
  "--color-foreground": "#0f172a",
  "--color-muted": "#64748b",
  "--color-accent": "#2563eb",
  "--color-accent-hover": "#3b82f6",
  "--color-success": "#16a34a",
  "--color-danger": "#dc2626",
  "--color-warning": "#ca8a04",
  "--font-sans": "'DM Sans', 'Inter', sans-serif",
  "--font-display": "'DM Sans', sans-serif",
};

export const themes: Theme[] = [
  {
    id: "auto",
    name: "Auto",
    description: "Follow system dark/light preference",
    vars: {}, // resolved dynamically
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep dark with cyan accents",
    vars: midnightVars,
  },
  {
    id: "phosphor",
    name: "Phosphor",
    description: "Retro terminal green-on-black",
    vars: {
      "--color-background": "#0a0a0a",
      "--color-surface": "#171717",
      "--color-surface-light": "#212121",
      "--color-border": "#3a3a3a",
      "--color-foreground": "#00ff88",
      "--color-muted": "#338855",
      "--color-accent": "#00ffaa",
      "--color-accent-hover": "#66ffcc",
      "--color-success": "#00ff66",
      "--color-danger": "#ff3333",
      "--color-warning": "#ffaa00",
      "--font-sans": "'IBM Plex Mono', 'Courier New', monospace",
      "--font-display": "'IBM Plex Mono', monospace",
    },
  },
  {
    id: "arctic",
    name: "Arctic",
    description: "Clean light with sharp blues",
    vars: arcticVars,
  },
];

const STORAGE_KEY = "recon-web-theme";

export function getStoredThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "auto";
  } catch {
    return "auto";
  }
}

export function storeThemeId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

/** Resolve "auto" to the actual theme based on system preference. */
export function resolveAutoTheme(): Theme {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark
    ? { ...themes.find((t) => t.id === "midnight")!, id: "auto" }
    : { ...themes.find((t) => t.id === "arctic")!, id: "auto" };
}

export function applyTheme(theme: Theme): void {
  const resolved = theme.id === "auto" ? resolveAutoTheme() : theme;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(resolved.vars)) {
    root.style.setProperty(key, value);
  }
}

export function getTheme(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0];
}
