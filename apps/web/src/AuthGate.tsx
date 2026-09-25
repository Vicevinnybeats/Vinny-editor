import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, authApi } from "./api";

type AuthState = "checking" | "authed" | "unauthed";

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authApi
      .status()
      .then((res) => setState(res.authenticated ? "authed" : "unauthed"))
      .catch(() => setState("unauthed"));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.login(passphrase);
      setState("authed");
    } catch (err) {
      if (err instanceof ApiError) {
        setError("Incorrect passphrase.");
      } else {
        setError("Can't reach the server - make sure `npm run server` is running.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "checking") {
    return <div className="auth-screen">Checking session...</div>;
  }

  if (state === "unauthed") {
    return (
      <div className="auth-screen">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1>Vinny Editor</h1>
          <p>Enter the passphrase to continue.</p>
          <input
            type="password"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase"
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={submitting || !passphrase}>
            {submitting ? "Checking..." : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
