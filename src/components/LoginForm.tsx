"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { AUTH_METHODS, authConfigured, safeNext } from "@/lib/supabase/env";
import { SparkLogo } from "./Sidebar";

const ERRORS: Record<string, string> = {
  provider: "Il provider di identità ha rifiutato l'accesso. Riprova o contatta l'amministratore.",
  missing_code: "Risposta di accesso non valida. Riprova.",
  exchange: "Sessione scaduta o non valida. Riprova ad accedere.",
  domain: "Questo account non appartiene a un dominio autorizzato.",
};

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden>
      <path fill="#f25022" d="M1 1h9v9H1z" />
      <path fill="#7fba00" d="M11 1h9v9h-9z" />
      <path fill="#00a4ef" d="M1 11h9v9H1z" />
      <path fill="#ffb900" d="M11 11h9v9h-9z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(ERRORS[params.get("error") ?? ""] ?? null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const sso = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = email.trim().toLowerCase().split("@")[1];
    if (!domain) return setError("Inserisci la tua email aziendale.");
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setBusy("sso");
    setError(null);
    const { error: err } = await supabase.auth.signInWithSSO({ domain, options: { redirectTo: redirectTo() } });
    if (err) {
      setBusy(null);
      setError(/not found|no sso provider/i.test(err.message) ? `Nessun SSO configurato per ${domain}.` : err.message);
    }
  };

  const oauth = async (provider: "azure" | "google") => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setBusy(provider);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo(), scopes: provider === "azure" ? "email" : undefined },
    });
    if (err) {
      setBusy(null);
      setError(err.message);
    }
  };

  const show = (m: string) => AUTH_METHODS.includes(m);
  const hasOauth = show("azure") || show("google");

  return (
    <div className="card w-full max-w-[400px] p-7">
      <div className="flex items-center gap-2.5">
        <SparkLogo className="h-7 w-5" />
        <span className="text-[16px] font-semibold">Spark</span>
      </div>
      <h1 className="mt-6 text-[20px] font-bold leading-tight">Accedi</h1>
      <p className="mt-1 text-[13px] text-muted">Usa l&apos;account della tua azienda.</p>

      {!authConfigured && (
        <p className="mt-5 flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Autenticazione non configurata: mancano le variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-5 flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {show("sso") && (
        <form onSubmit={sso} className="mt-5 space-y-2.5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">Email aziendale</span>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.cognome@azienda.it"
              className="w-full rounded-lg border border-[#dfe3ea] bg-white px-3 py-2.5 text-[13.5px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15"
            />
          </label>
          <button
            type="submit"
            disabled={!authConfigured || !!busy}
            className="btn-gradient flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-extrabold uppercase tracking-tight text-white disabled:opacity-50"
          >
            {busy === "sso" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Continua con SSO
          </button>
        </form>
      )}

      {show("sso") && hasOauth && (
        <div className="my-5 flex items-center gap-3 text-[11.5px] text-faint">
          <span className="h-px flex-1 bg-line" /> oppure <span className="h-px flex-1 bg-line" />
        </div>
      )}

      <div className={`space-y-2 ${show("sso") ? "" : "mt-5"}`}>
        {show("azure") && (
          <OAuthButton onClick={() => oauth("azure")} disabled={!authConfigured || !!busy} loading={busy === "azure"} icon={<MicrosoftLogo />}>
            Continua con Microsoft
          </OAuthButton>
        )}
        {show("google") && (
          <OAuthButton onClick={() => oauth("google")} disabled={!authConfigured || !!busy} loading={busy === "google"} icon={<GoogleLogo />}>
            Continua con Google
          </OAuthButton>
        )}
      </div>
    </div>
  );
}

function OAuthButton({
  children,
  icon,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#dfe3ea] bg-white py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
