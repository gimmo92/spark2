"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, Mail, TriangleAlert } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { AUTH_METHODS, authConfigured, safeNext } from "@/lib/supabase/env";
import { SparkLogo } from "./Sidebar";

const ERRORS: Record<string, string> = {
  provider: "L'accesso è stato rifiutato. Se non hai ancora un account, chiedi all'amministratore di invitarti.",
  missing_code: "Link di accesso non valido. Riprova.",
  exchange: "Link scaduto o già usato. Richiedine uno nuovo.",
  domain: "Questo account non appartiene a un dominio autorizzato.",
  link: "Link scaduto o già usato. Richiedine uno nuovo.",
};

const inputCls =
  "w-full rounded-lg border border-[#dfe3ea] bg-white px-3 py-2.5 text-[13.5px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15";
const primaryCls =
  "btn-gradient flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-extrabold uppercase tracking-tight text-white disabled:opacity-50";

type Mode = "password" | "otp" | "reset";

/** Map Supabase auth errors to Italian, without revealing whether an account exists. */
function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "Email o password non corretti.";
  if (/email not confirmed/i.test(message)) return "Account non ancora attivato: usa il link nell'email di invito.";
  if (/token has expired|invalid.*otp|otp.*expired|token.*invalid/i.test(message)) return "Codice non valido o scaduto.";
  if (/rate limit|too many/i.test(message)) return "Troppi tentativi. Riprova tra qualche minuto.";
  if (/signups? not allowed|user not found/i.test(message)) return "Account non abilitato. Chiedi all'amministratore di invitarti.";
  return message;
}

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
  const show = (m: string) => AUTH_METHODS.includes(m);

  const [mode, setMode] = useState<Mode>(show("password") ? "password" : "otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(ERRORS[params.get("error") ?? ""] ?? null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const callbackUrl = (to = next) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;
  const done = () => window.location.assign(next); // full navigation so the proxy sees the new session cookies

  const run = async (key: string, fn: () => Promise<void>) => {
    if (!getSupabaseBrowser()) return;
    setBusy(key);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const signInPassword = (e: React.FormEvent) => {
    e.preventDefault();
    run("password", async () => {
      const { error: err } = await getSupabaseBrowser()!.auth.signInWithPassword({ email: email.trim(), password });
      if (err) setError(friendly(err.message));
      else done();
    });
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    run("otp-send", async () => {
      const { error: err } = await getSupabaseBrowser()!.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false }, // never create accounts from the login page
      });
      // Unknown addresses get the same answer as known ones, so the form can't be used to probe accounts.
      if (err && !/signups? not allowed|user not found/i.test(err.message)) return setError(friendly(err.message));
      setCodeSent(true);
      setCooldown(60);
      setInfo(`Se ${email.trim()} è abilitato, riceverai un codice a 6 cifre.`);
    });
  };

  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    run("otp-verify", async () => {
      const { error: err } = await getSupabaseBrowser()!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (err) setError(friendly(err.message));
      else done();
    });
  };

  const sendReset = (e: React.FormEvent) => {
    e.preventDefault();
    run("reset", async () => {
      const { error: err } = await getSupabaseBrowser()!.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: callbackUrl("/auth/update-password"),
      });
      if (err && /rate limit|too many/i.test(err.message)) return setError(friendly(err.message));
      setInfo(`Se ${email.trim()} è registrato, riceverai un link per reimpostare la password.`);
    });
  };

  const sso = () => {
    const domain = email.trim().toLowerCase().split("@")[1];
    if (!domain) return setError("Inserisci la tua email aziendale.");
    run("sso", async () => {
      const { error: err } = await getSupabaseBrowser()!.auth.signInWithSSO({ domain, options: { redirectTo: callbackUrl() } });
      if (err) setError(/not found|no sso provider/i.test(err.message) ? `Nessun SSO configurato per ${domain}.` : friendly(err.message));
    });
  };

  const oauth = (provider: "azure" | "google") =>
    run(provider, async () => {
      const { error: err } = await getSupabaseBrowser()!.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl(), scopes: provider === "azure" ? "email" : undefined },
      });
      if (err) setError(friendly(err.message));
    });

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setCodeSent(false);
    setCode("");
  };

  const disabled = !authConfigured || !!busy;
  const tabs = (["password", "otp"] as const).filter((m) => show(m));
  const hasOthers = show("sso") || show("azure") || show("google");
  const emailField = (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">Email</span>
      <input
        type="email"
        autoComplete="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="nome.cognome@azienda.it"
        className={inputCls}
        readOnly={mode === "otp" && codeSent}
      />
    </label>
  );

  return (
    <div className="card w-full max-w-[400px] p-7">
      <div className="flex items-center gap-2.5">
        <SparkLogo className="h-7 w-5" />
        <span className="text-[16px] font-semibold">Spark</span>
      </div>
      <h1 className="mt-6 text-[20px] font-bold leading-tight">{mode === "reset" ? "Reimposta password" : "Accedi"}</h1>
      <p className="mt-1 text-[13px] text-muted">
        {mode === "reset" ? "Ti invieremo un link per scegliere una nuova password." : "Accesso riservato agli utenti abilitati sulla piattaforma."}
      </p>

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
      {info && (
        <p role="status" className="mt-5 flex gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-[12.5px] text-brand">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          {info}
        </p>
      )}

      {mode !== "reset" && tabs.length > 1 && (
        <div className="mt-5 grid grid-cols-2 rounded-lg bg-canvas p-1" role="tablist">
          {tabs.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`rounded-md py-1.5 text-[12.5px] font-semibold transition-colors ${mode === m ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {m === "password" ? "Password" : "Codice via email"}
            </button>
          ))}
        </div>
      )}

      {mode === "password" && (
        <form onSubmit={signInPassword} className="mt-4 space-y-3">
          {emailField}
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Password</span>
              <button type="button" onClick={() => switchMode("reset")} className="text-[11.5px] font-semibold text-brand hover:underline">
                Password dimenticata?
              </button>
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>
          <button type="submit" disabled={disabled} className={primaryCls}>
            {busy === "password" && <Loader2 className="h-4 w-4 animate-spin" />}
            Accedi
          </button>
        </form>
      )}

      {mode === "otp" &&
        (!codeSent ? (
          <form onSubmit={sendCode} className="mt-4 space-y-3">
            {emailField}
            <button type="submit" disabled={disabled} className={primaryCls}>
              {busy === "otp-send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Invia codice
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-4 space-y-3">
            {emailField}
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">Codice</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                pattern="[0-9]{6,10}"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className={`${inputCls} text-center text-[18px] font-semibold tracking-[0.4em] tabular-nums`}
              />
            </label>
            <button type="submit" disabled={disabled || code.length < 6} className={primaryCls}>
              {busy === "otp-verify" && <Loader2 className="h-4 w-4 animate-spin" />}
              Accedi
            </button>
            <div className="flex items-center justify-between text-[12px]">
              <button type="button" onClick={() => switchMode("otp")} className="font-semibold text-muted hover:text-ink">
                Cambia email
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || !!busy}
                onClick={() => sendCode()}
                className="font-semibold text-brand hover:underline disabled:text-faint disabled:no-underline"
              >
                {cooldown > 0 ? `Invia di nuovo tra ${cooldown}s` : "Invia di nuovo"}
              </button>
            </div>
          </form>
        ))}

      {mode === "reset" && (
        <form onSubmit={sendReset} className="mt-5 space-y-3">
          {emailField}
          <button type="submit" disabled={disabled} className={primaryCls}>
            {busy === "reset" && <Loader2 className="h-4 w-4 animate-spin" />}
            Invia link
          </button>
          <button
            type="button"
            onClick={() => switchMode("password")}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Torna all&apos;accesso
          </button>
        </form>
      )}

      {mode !== "reset" && hasOthers && (
        <>
          {tabs.length > 0 && (
            <div className="my-5 flex items-center gap-3 text-[11.5px] text-faint">
              <span className="h-px flex-1 bg-line" /> oppure <span className="h-px flex-1 bg-line" />
            </div>
          )}
          <div className="space-y-2">
            {show("sso") && (
              <OAuthButton
                onClick={() => {
                  if (!email.trim()) {
                    setError("Inserisci la tua email aziendale e poi premi SSO.");
                    return;
                  }
                  sso();
                }}
                disabled={disabled}
                loading={busy === "sso"}
                icon={<KeyRound className="h-4 w-4 text-brand" />}
              >
                Continua con SSO aziendale
              </OAuthButton>
            )}
            {show("azure") && (
              <OAuthButton onClick={() => oauth("azure")} disabled={disabled} loading={busy === "azure"} icon={<MicrosoftLogo />}>
                Continua con Microsoft
              </OAuthButton>
            )}
            {show("google") && (
              <OAuthButton onClick={() => oauth("google")} disabled={disabled} loading={busy === "google"} icon={<GoogleLogo />}>
                Continua con Google
              </OAuthButton>
            )}
          </div>
        </>
      )}
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
