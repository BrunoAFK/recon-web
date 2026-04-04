import { useState, useEffect, createContext, useContext } from "react";
import {
  themes,
  getTheme,
  getStoredThemeId,
  storeThemeId,
  applyTheme,
  type Theme,
} from "@/lib/themes";

interface ThemeContext {
  theme: Theme;
  setTheme: (id: string) => void;
  themes: Theme[];
}

const Ctx = createContext<ThemeContext>({
  theme: themes[0],
  setTheme: () => {},
  themes,
});

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    getTheme(getStoredThemeId()),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes when "auto" is active
  useEffect(() => {
    if (theme.id !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme(theme);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [theme]);

  function setTheme(id: string) {
    const t = getTheme(id);
    storeThemeId(id);
    setThemeState(t);
  }

  return (
    <Ctx.Provider value={{ theme, setTheme, themes }}>{children}</Ctx.Provider>
  );
}
