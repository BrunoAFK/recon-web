import { useState, useCallback, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Shield,
  Globe,
  Globe2,
  Zap,
  Network,
  FileText,
  Database,
  Gauge,
  Terminal,
  Copy,
  Check,
} from "lucide-react";
import { useHandlers } from "@/hooks/use-scan";
import type { HandlerCategory } from "@/lib/api";

function isValidTarget(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return true;
  } catch {
    return false;
  }
}

const CATEGORY_ICONS: Record<HandlerCategory, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  dns: Globe2,
  network: Network,
  content: FileText,
  meta: Database,
  performance: Gauge,
};

const CATEGORY_LABELS: Record<HandlerCategory, string> = {
  security: "Security",
  dns: "DNS",
  network: "Network",
  content: "Content",
  meta: "Meta",
  performance: "Performance",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const handlers = useHandlers();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const target = url.trim();
    if (!isValidTarget(target)) {
      setError("Enter a valid URL or domain (e.g. example.com)");
      return;
    }
    setError("");
    navigate(`/results/${encodeURIComponent(target)}`);
  }

  // Group handlers by category
  const handlersByCategory = handlers.data?.reduce(
    (acc, h) => {
      if (!acc[h.category]) acc[h.category] = [];
      acc[h.category].push(h);
      return acc;
    },
    {} as Record<HandlerCategory, typeof handlers.data>,
  );

  return (
    <div className="flex flex-col items-center justify-center px-6 relative">
      {/* Hero */}
      <div className="mt-28 mb-10 text-center max-w-2xl animate-fade-in">
        <h1
          className="text-5xl sm:text-6xl font-bold tracking-tight mb-5 leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Scan any{" "}
          <span className="text-accent">website</span>
        </h1>
        <p className="text-lg text-muted max-w-md mx-auto leading-relaxed">
          Security, DNS, technologies, performance —{" "}
          {handlers.data ? handlers.data.length : "30+"} checks in one scan.
        </p>
      </div>

      {/* Search form */}
      <div className="w-full max-w-xl mb-8 animate-fade-in" style={{ animationDelay: "100ms" }}>
        <form onSubmit={handleSubmit}>
          <div className="relative flex items-center">
            <Search className="absolute left-5 h-5 w-5 text-muted pointer-events-none" />
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError("");
              }}
              placeholder="example.com"
              className="w-full rounded-2xl border border-border bg-surface py-5 pl-14 pr-28 text-base text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-3 rounded-xl bg-accent px-6 py-3 text-[15px] font-semibold text-background hover:bg-accent-hover transition-colors"
            >
              Scan
            </button>
          </div>
          {error && <p className="mt-3 text-[15px] text-danger pl-2">{error}</p>}
        </form>
      </div>

      <div className="mb-16" />

      {/* Feature highlights */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl w-full animate-fade-in"
        style={{ animationDelay: "200ms" }}
      >
        <FeatureCard
          icon={<Shield className="h-7 w-7 text-accent" />}
          title="Security Audit"
          description="Headers, TLS, HSTS, WAF detection, threat intelligence."
        />
        <FeatureCard
          icon={<Globe className="h-7 w-7 text-accent" />}
          title="Infrastructure"
          description="DNS records, WHOIS for 100+ TLDs, IP resolution."
        />
        <FeatureCard
          icon={<Zap className="h-7 w-7 text-accent" />}
          title="Tech & Performance"
          description="Tech stack detection, carbon footprint, response times."
        />
      </div>

      {/* CLI card */}
      <div
        className="mt-10 w-full max-w-4xl animate-fade-in"
        style={{ animationDelay: "250ms" }}
      >
        <div className="rounded-xl border border-border/40 bg-surface/40 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="shrink-0 hidden sm:block rounded-lg bg-accent/10 p-3">
              <Terminal className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className="text-lg font-semibold mb-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                CLI available
              </h3>
              <p className="text-[15px] text-muted leading-relaxed mb-4">
                Run scans from your terminal or CI pipeline. No setup needed — just Docker.
              </p>
              <CliCommand command="docker run --rm ghcr.io/brunoafk/recon-web/cli scan example.com" />
              <p className="text-xs text-muted mt-3">
                Supports JSON, JUnit XML output, threshold checks, and diff against previous scans.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* What We Check — full handler list */}
      {handlersByCategory && (
        <div
          className="mt-20 max-w-4xl w-full animate-fade-in"
          style={{ animationDelay: "300ms" }}
        >
          <h2
            className="text-2xl font-bold tracking-tight mb-8 text-center"
            style={{ fontFamily: "var(--font-display)" }}
          >
            What We Check
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {(Object.keys(CATEGORY_LABELS) as HandlerCategory[]).map((cat) => {
              const catHandlers = handlersByCategory[cat];
              if (!catHandlers || catHandlers.length === 0) return null;
              const Icon = CATEGORY_ICONS[cat];
              return (
                <div key={cat} className="rounded-xl border border-border/30 bg-surface/30 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-5 w-5 text-accent" />
                    <h3
                      className="text-base font-semibold"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {CATEGORY_LABELS[cat]}
                    </h3>
                    <span className="text-sm text-muted ml-auto">{catHandlers.length}</span>
                  </div>
                  <ul className="space-y-3">
                    {catHandlers.map((h) => (
                      <li key={h.name} className="text-sm">
                        <p className="font-medium">{h.displayName ?? h.name}</p>
                        <p className="text-muted mt-0.5 leading-snug">{h.shortDescription ?? h.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

function CliCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [command]);

  return (
    <div className="relative rounded-lg bg-background/60 border border-border/30 px-4 py-3 font-mono text-sm text-foreground overflow-x-auto group">
      <span className="text-muted select-none">$ </span>
      <span>{command}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-light/50 opacity-0 group-hover:opacity-100 transition-all"
        title="Copy to clipboard"
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-surface/40 p-6 text-center hover:border-border/80 transition-colors">
      <div className="mb-4 flex justify-center">{icon}</div>
      <h3
        className="text-base font-semibold mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>
      <p className="text-[15px] text-muted leading-relaxed">{description}</p>
    </div>
  );
}
