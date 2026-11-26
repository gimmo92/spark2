"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { getSupabaseBrowser } from "../supabase/client";
import { SparkLogo } from "../shell/Sidebar";
import { tr } from "../i18n/i18n";
import { LocaleProvider, LocaleSwitch } from "../i18n/LocaleProvider";
import { PasswordInput } from "./PasswordInput";

const inputCls =
  "w-full rounded-lg border border-[#dfe3ea] bg-white px-3 py-2.5 text-[13.5px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15";

/** Set a new password after an invite or recovery link (the link already created a session). */
export function UpdatePasswordForm() {
  return (
    <LocaleProvider>
      <UpdatePassword />
    </LocaleProvider>
  );
}

function UpdatePassword() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined); // undefined = loading, null = no session
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no auth configured: nothing to load
      setEmail(null);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError(tr("La password deve avere almeno 8 caratteri."));
    if (password !== confirm) return setError(tr("Le due password non coincidono."));
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(tr(/same.*password|different from the old/i.test(err.message) ? "Scegli una password diversa dalla precedente." : err.message));
    // the recovery link only proves the mailbox: sign out and do the full password + code login
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login?reset=1");
  };

  return (
    <div className="card w-full max-w-[400px] p-7">
      <div className="flex items-center gap-2.5">
        <SparkLogo className="h-7 w-5" />
        <span className="text-[16px] font-semibold">Spark</span>
        <LocaleSwitch className="ml-auto" />
      </div>
      <h1 className="mt-6 text-[20px] font-bold leading-tight">{tr("Imposta la password")}</h1>

      {email === undefined ? (
        <div className="mt-5 h-40 animate-pulse rounded-lg bg-canvas" />
      ) : email === null ? (
        <>
          <p className="mt-3 text-[13px] text-muted">{tr("Il link è scaduto o è già stato usato.")}</p>
          <Link href="/login" className="mt-4 inline-block text-[13px] font-semibold text-brand hover:underline">{tr("Torna all'accesso")}</Link>
        </>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <p className="text-[13px] text-muted">{tr("Account:")}{" "}<span className="font-semibold text-ink">{email}</span>
          </p>
          {error && (
            <p role="alert" className="flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {tr(error)}
            </p>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Nuova password")}</span>
            <PasswordInput autoComplete="new-password" required minLength={8} autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Conferma password")}</span>
            <PasswordInput autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="btn-gradient flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[12px] font-extrabold uppercase tracking-tight text-white disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Salva password")}</button>
        </form>
      )}
    </div>
  );
}
