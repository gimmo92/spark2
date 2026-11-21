"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authConfigured } from "@/lib/supabase/env";
import { AuthCard, EmailField, Notice, authInputCls, authPrimaryCls } from "./LoginForm";

const ERRORS: Record<string, string> = {
  not_allowed: "Questo indirizzo non è abilitato alla piattaforma. Contatta l'amministratore.",
  exists: "Esiste già un account con questa email. Accedi oppure usa “Password dimenticata?”.",
  weak: "Password troppo debole: usa almeno 8 caratteri.",
  email: "Inserisci un indirizzo email valido.",
  config: "Registrazione non configurata. Contatta l'amministratore.",
};

/** First access: users pre-loaded by the admin choose their own password. */
export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(ERRORS.weak);
    if (password !== confirm) return setError("Le due password non coincidono.");
    setBusy(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
    setBusy(false);
    if (!res.ok || !data.ok) return setError(ERRORS[data.error ?? ""] ?? data.message ?? "Registrazione non riuscita. Riprova.");
    router.replace("/login?registered=1");
  };

  return (
    <AuthCard title="Crea la tua password" subtitle="Solo per gli utenti già abilitati dall'amministratore.">
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={submit} className="mt-5 space-y-3">
        <EmailField value={email} onChange={setEmail} />
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">Password</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={authInputCls} />
          <span className="mt-1 block text-[11.5px] text-faint">Almeno 8 caratteri.</span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">Conferma password</span>
          <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={authInputCls} />
        </label>
        <button type="submit" disabled={!authConfigured || busy} className={authPrimaryCls}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Crea account
        </button>
      </form>
      <p className="mt-5 text-center text-[12.5px] text-muted">
        Hai già un account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Accedi
        </Link>
      </p>
    </AuthCard>
  );
}
