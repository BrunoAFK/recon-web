import { Link } from "react-router-dom";
import { Github, BookOpen, Globe, Terminal } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border/50 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2 text-foreground mb-3">
              <Globe className="h-4 w-4 text-accent" />
              <span className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
                recon-web
              </span>
            </Link>
            <p className="text-muted text-xs leading-relaxed">
              Open-source website reconnaissance and security analysis tool.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Product</h4>
            <ul className="space-y-2 text-muted">
              <li>
                <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              </li>
              <li>
                <Link to="/history" className="hover:text-foreground transition-colors">History</Link>
              </li>
              <li>
                <a href="/docs" className="hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                  <BookOpen size={12} />
                  API Docs
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">Resources</h4>
            <ul className="space-y-2 text-muted">
              <li>
                <Link to="/settings" className="hover:text-foreground transition-colors">Settings</Link>
              </li>
              <li>
                <a
                  href="https://github.com/BrunoAFK/recon-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                >
                  <Github size={12} />
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* CLI */}
          <div>
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-3">CLI</h4>
            <div className="rounded-md bg-background/50 border border-border/30 px-2.5 py-2 font-mono text-[11px] text-muted break-all">
              <Terminal className="h-3 w-3 inline mr-1 text-accent" />
              docker run --rm ghcr.io/brunoafk/recon-web/cli scan
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted/50">
          <span>&copy; {new Date().getFullYear()} recon-web</span>
          <span>GPL-2.0 License</span>
        </div>
      </div>
    </footer>
  );
}
