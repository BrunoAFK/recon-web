import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { KeyRound } from "lucide-react";

export default function Login() {
  const [token, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const { setToken } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();

    if (!trimmed) {
      setError("Please enter a token");
      return;
    }

    setToken(trimmed);
    navigate("/");
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 mt-32">
      <div className="mb-8 text-center">
        <KeyRound className="h-10 w-10 text-accent mx-auto mb-4" />
        <h1 className="text-3xl font-bold tracking-tight mb-2">Authentication</h1>
        <p className="text-muted text-sm">Enter your API token to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <input
          type="password"
          value={token}
          onChange={(e) => {
            setTokenInput(e.target.value);
            if (error) setError("");
          }}
          placeholder="Bearer token..."
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors mb-3"
          autoFocus
        />
        {error && <p className="mb-3 text-sm text-red-400 pl-1">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
        >
          Log in
        </button>
      </form>
    </div>
  );
}
