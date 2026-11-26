"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authConfigured } from "../supabase/env";
import { AuthCard, EmailField, Notice, authInputCls, authPrimaryCls } from "./LoginForm";
import { tr } from "../i18n/i18n";
import { LocaleProvider } from "../i18n/LocaleProvider";
import { PasswordInput } from "./PasswordInput";

const ERRORS: Record<string, string> = {
  invalid_code: "Email o codice di registrazione non validi. Controlla l'email di invito.",
  exists: "Esiste già un account con questa email. Accedi oppure usa “Password dimenticata?”.",
  weak: "Password troppo debole: usa almeno 8 caratteri.",
  email: "Inserisci un indirizzo email valido.",
  config: "Registrazione non configurata. Contatta l'amministratore.",
};

/** First access: users pre-loaded by the admin choose their own password. */
export function RegisterForm() {
  return (
    <LocaleProvider>
      <RegisterSteps />
    </LocaleProvider>
  );
}

function RegisterSteps() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(ERRORS.weak);
    if (password !== confirm) return setError(tr("Le due password non coincidono."));
    setBusy(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
    setBusy(false);
    if (!res.ok || !data.ok) return setError(tr(ERRORS[data.error ?? ""] ?? data.message ?? "Registrazione non riuscita. Riprova."));
    router.replace("/login?registered=1");
  };

  return (
    <AuthCard title={tr("Registrazione")} subtitle={tr("Inserisci il codice che hai ricevuto via email e scegli la tua password.")}>
      {error && <Notice kind="error">{tr(error)}</Notice>}
      <form onSubmit={submit} className="mt-5 space-y-3">
        <EmailField value={email} onChange={setEmail} />
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Codice di registrazione")}</span>
          <input
            required
            autoComplete="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-1234"
            className={`${authInputCls} font-mono font-semibold tracking-[0.15em] uppercase`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Password")}</span>
          <PasswordInput autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={authInputCls} />
          <span className="mt-1 block text-[11.5px] text-faint">{tr("Almeno 8 caratteri.")}</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Conferma password")}</span>
          <PasswordInput autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={authInputCls} />
        </label>
        <button type="submit" disabled={!authConfigured || busy} className={authPrimaryCls}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Crea account")}</button>
      </form>
      <p className="mt-5 text-center text-[12.5px] text-muted">{tr("Hai già un account?")}{" "}<Link href="/login" className="font-semibold text-brand hover:underline">{tr("Accedi")}</Link>
      </p>
    </AuthCard>
  );
}
