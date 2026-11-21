"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, TriangleAlert } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authConfigured, safeNext } from "@/lib/supabase/env";
import { SparkLogo } from "./Sidebar";

/** Errors from ?error= (email links) and from the /api/auth routes. */
const ERRORS: Record<string, string> = {
  credentials: "Email o password non corretti.",
  code: "Codice non valido o scaduto.",
  expired: "Tempo scaduto: inserisci di nuovo email e password.",
  rate: "Troppi tentativi. Riprova tra qualche minuto.",
  send: "Non è stato possibile inviare il codice. Riprova.",
  config: "Accesso non configurato correttamente. Contatta l'amministratore.",
  link: "Link scaduto o già usato. Richiedine uno nuovo.",
  exchange: "Link scaduto o già usato. Richiedine uno nuovo.",
  missing_code: "Link non valido. Riprova.",
  provider: "Accesso rifiutato.",
  domain: "Questo account non appartiene a un dominio autorizzato.",
};

export const authInputCls =
  "w-full rounded-lg border border-[#dfe3ea] bg-white px-3 py-2.5 text-[13.5px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15";
export const authPrimaryCls =
  "btn-gradient flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-extrabold uppercase tracking-tight text-white disabled:opacity-50";

type Step = "credentials" | "code" | "reset";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
  return { ok: res.ok && !!data.ok, error: data.error ?? "unknown", message: data.message };
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card w-full max-w-[400px] p-7">
      <div className="flex items-center gap-2.5">
        <SparkLogo className="h-7 w-5" />
        <span className="text-[16px] font-semibold">Spark</span>
      </div>
      <h1 className="mt-6 text-[20px] font-bold leading-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      {!authConfigured && (
        <p className="mt-5 flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Autenticazione non configurata: mancano le variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </p>
      )}
      {children}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "error" | "info" | "success"; children: React.ReactNode }) {
  const styles = { error: "bg-red-50 text-red-700", info: "bg-brand-soft text-brand", success: "bg-emerald-50 text-emerald-700" };
  const Icon = kind === "error" ? TriangleAlert : kind === "success" ? CheckCircle2 : Mail;
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`mt-5 flex gap-2 rounded-lg px-3 py-2.5 text-[12.5px] ${styles[kind]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(ERRORS[params.get("error") ?? ""] ?? null);
  const [info, setInfo] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    params.get("registered") ? "Registrazione completata. Ora accedi." : params.get("reset") ? "Password aggiornata. Ora accedi." : null,
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const clear = () => {
    setError(null);
    setInfo(null);
    setSuccess(null);
  };

  /** Step 1 (and "send again"): password check on the server, which then emails the code. */
  const sendCredentials = async (e?: React.FormEvent) => {
    e?.preventDefault();
    clear();
    setBusy("credentials");
    const r = await post("/api/auth/login", { email, password });
    setBusy(null);
    if (!r.ok) return setError(ERRORS[r.error] ?? ERRORS.credentials);
    setStep("code");
    setCode("");
    setCooldown(60);
    setInfo(`Abbiamo inviato un codice a ${email.trim().toLowerCase()}.`);
  };

  /** Step 2: code check on the server, which opens the session. */
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
    setBusy("code");
    const r = await post("/api/auth/verify", { code });
    if (!r.ok) {
      setBusy(null);
      if (r.error === "expired") setStep("credentials");
      return setError(ERRORS[r.error] ?? ERRORS.code);
    }
    window.location.assign(next); // full navigation: the proxy now sees the session + 2-step cookie
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    clear();
    setBusy("reset");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
    });
    setBusy(null);
    if (err && /rate limit|too many/i.test(err.message)) return setError(ERRORS.rate);
    setInfo(`Se ${email.trim()} è registrato, riceverai un link per reimpostare la password.`);
  };

  const disabled = !authConfigured || !!busy;

  if (step === "reset")
    return (
      <AuthCard title="Reimposta password" subtitle="Ti invieremo un link per scegliere una nuova password.">
        {error && <Notice kind="error">{error}</Notice>}
        {info && <Notice kind="info">{info}</Notice>}
        <form onSubmit={sendReset} className="mt-5 space-y-3">
          <EmailField value={email} onChange={setEmail} />
          <button type="submit" disabled={disabled} className={authPrimaryCls}>
            {busy === "reset" && <Loader2 className="h-4 w-4 animate-spin" />}
            Invia link
          </button>
          <BackButton
            onClick={() => {
              clear();
              setStep("credentials");
            }}
          />
        </form>
      </AuthCard>
    );

  if (step === "code")
    return (
      <AuthCard title="Verifica il codice" subtitle="Per sicurezza, ogni accesso richiede anche un codice via email.">
        {error && <Notice kind="error">{error}</Notice>}
        {info && <Notice kind="info">{info}</Notice>}
        <form onSubmit={verify} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">Codice</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className={`${authInputCls} text-center text-[18px] font-semibold tracking-[0.4em] tabular-nums`}
            />
          </label>
          <button type="submit" disabled={disabled || code.length < 6} className={authPrimaryCls}>
            {busy === "code" && <Loader2 className="h-4 w-4 animate-spin" />}
            Accedi
          </button>
          <div className="flex items-center justify-between text-[12px]">
            <BackButton
              label="Cambia account"
              onClick={() => {
                clear();
                setStep("credentials");
              }}
            />
            <button
              type="button"
              disabled={cooldown > 0 || !!busy}
              onClick={() => sendCredentials()}
              className="font-semibold text-brand hover:underline disabled:text-faint disabled:no-underline"
            >
              {cooldown > 0 ? `Invia di nuovo tra ${cooldown}s` : "Invia di nuovo"}
            </button>
          </div>
        </form>
      </AuthCard>
    );

  return (
    <AuthCard title="Accedi" subtitle="Accesso riservato agli utenti abilitati sulla piattaforma.">
      {success && <Notice kind="success">{success}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={sendCredentials} className="mt-5 space-y-3">
        <EmailField value={email} onChange={setEmail} />
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Password</span>
            <button
              type="button"
              onClick={() => {
                clear();
                setStep("reset");
              }}
              className="text-[11.5px] font-semibold text-brand hover:underline"
            >
              Password dimenticata?
            </button>
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputCls}
          />
        </label>
        <button type="submit" disabled={disabled} className={authPrimaryCls}>
          {busy === "credentials" && <Loader2 className="h-4 w-4 animate-spin" />}
          Continua
        </button>
      </form>
      <p className="mt-5 text-center text-[12.5px] text-muted">
        Primo accesso?{" "}
        <Link href="/registrazione" className="font-semibold text-brand hover:underline">
          Crea la tua password
        </Link>
      </p>
    </AuthCard>
  );
}

export function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">Email</span>
      <input
        type="email"
        autoComplete="email"
        required
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="nome.cognome@azienda.it"
        className={authInputCls}
      />
    </label>
  );
}

function BackButton({ onClick, label = "Torna all'accesso" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
