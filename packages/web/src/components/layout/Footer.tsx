import { Link } from "react-router-dom";
import { Github, Globe } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border/50 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          {/* Brand */}
          <Link to="/" className="inline-flex items-center gap-2 text-foreground hover:text-accent transition-colors">
            <Globe className="h-4 w-4 text-accent" />
            <span className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
              recon-web
            </span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-5 text-xs">
            <a href="/docs" className="hover:text-foreground transition-colors">
              Docs
            </a>
            <a
              href="https://github.com/BrunoAFK/recon-web"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <Github size={12} />
              GitHub
            </a>
          </div>

          {/* Copyright */}
          <span className="text-xs text-muted/50">
            &copy; {new Date().getFullYear()}{" "}
            <a
              href="https://pavelja.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Bruno Pavelja
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
