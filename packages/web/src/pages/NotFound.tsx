import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-6 mt-40 text-center">
      <h1 className="text-6xl font-bold text-accent mb-4">404</h1>
      <p className="text-lg text-muted mb-8">Page not found.</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg bg-surface border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-light transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
    </div>
  );
}
