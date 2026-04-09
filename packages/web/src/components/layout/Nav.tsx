import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Globe, Clock, Palette, Check, Settings } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

interface NavProps {
  /** Optional slot for user menu (e.g. auth dropdown). If omitted, shows simple settings link. */
  userMenu?: React.ReactNode;
}

export default function Nav({ userMenu }: NavProps = {}) {
  const [showThemes, setShowThemes] = useState(false);
  const { theme, setTheme, themes } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close theme dropdown on click outside
  useEffect(() => {
    if (!showThemes) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowThemes(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showThemes]);

  return (
    <nav className="border-b border-border/50 bg-surface/60 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-foreground hover:text-accent transition-colors"
        >
          <Globe className="h-5 w-5 text-accent" />
          <span
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            recon-web
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink to="/history" icon={Clock} label="History" />
          <NavLink to="/settings" icon={Settings} label="Settings" />

          {/* Theme switcher */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowThemes(!showThemes)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-light/50 transition-colors"
              title="Change theme"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">{theme.name}</span>
            </button>

            {showThemes && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-surface p-3 shadow-2xl animate-fade-in z-50">
                <div className="space-y-1.5">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTheme(t.id);
                        setShowThemes(false);
                      }}
                      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                        theme.id === t.id
                          ? "border-accent bg-accent/10"
                          : "border-transparent hover:border-border/50 hover:bg-surface-light/30"
                      }`}
                    >
                      <div className="flex gap-1 shrink-0">
                        <span
                          className="w-3 h-3 rounded-full border border-border/30"
                          style={{ backgroundColor: t.vars["--color-background"] }}
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-border/30"
                          style={{ backgroundColor: t.vars["--color-accent"] }}
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-border/30"
                          style={{ backgroundColor: t.vars["--color-foreground"] }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-sm text-muted">{t.description}</p>
                      </div>
                      {theme.id === t.id && (
                        <Check className="h-4 w-4 text-accent shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User menu slot — pro injects auth dropdown here */}
          {userMenu}
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-light/50 transition-colors"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
