import { Github, BookOpen, FileCode2 } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-muted">
          <div>
            <h4 className="font-semibold text-foreground mb-2">Product</h4>
            <ul className="space-y-1">
              <li>
                <a href="/docs" className="hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                  <BookOpen size={14} />
                  API Docs
                </a>
              </li>
              <li>
                <a href="/docs" className="hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                  <FileCode2 size={14} />
                  Documentation
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-2">Open Source</h4>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://github.com/pavelja/recon-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                >
                  <Github size={14} />
                  GitHub
                </a>
              </li>
              <li className="text-muted/70">MIT License</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-border/50 text-sm text-muted/60 text-center">
          &copy; {new Date().getFullYear()} recon-web
        </div>
      </div>
    </footer>
  );
}
