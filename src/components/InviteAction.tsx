"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Mail, MailCheck, Send } from "lucide-react";
import { fullName, type User } from "@/lib/data";
import type { InviteDTO } from "@/lib/invites";
import { useStore } from "@/lib/store";
import { GhostButton, Modal, PrimaryButton, Tooltip } from "./ui";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

export function useInviteFor(user: User): InviteDTO | undefined {
  const { invites } = useStore();
  return invites[user.email.toLowerCase()];
}

/** Confirm + send (or re-send) the registration email. */
function InviteDialog({ user, invite, onClose }: { user: User; invite?: InviteDTO; onClose: () => void }) {
  const { sendInvite, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const r = await sendInvite(user.email, fullName(user));
    setBusy(false);
    if (!r.ok) return setError(r.message ?? "Invio non riuscito.");
    notify(`Invito inviato a ${user.email}`);
    onClose();
  };

  return (
    <Modal
      title={invite ? "Reinviare l'invito?" : "Inviare l'invito di registrazione?"}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <GhostButton onClick={onClose}>Annulla</GhostButton>
          <PrimaryButton onClick={send} disabled={busy} className="flex items-center gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {invite ? "Reinvia" : "Invia invito"}
          </PrimaryButton>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">
        <span className="font-semibold text-ink">{fullName(user)}</span> riceverà a <span className="font-semibold text-ink">{user.email}</span>{" "}
        un&apos;email con il codice di registrazione e il link per scegliere la password.
        {invite && <> Il codice resta lo stesso ({invite.code}), già inviato il {fmtDate(invite.sent_at)}.</>}
      </p>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700">{error}</p>}
    </Modal>
  );
}

/** Row action: letter icon for users who haven't registered yet; disappears once they have. */
export function InviteIconButton({ user }: { user: User }) {
  const { invitesStatus, invitesMessage, notify } = useStore();
  const invite = useInviteFor(user);
  const [open, setOpen] = useState(false);

  if (invite?.registered_at) return <span className="h-7 w-7" aria-hidden />; // keep column alignment

  const label = invite ? `Reinvia invito (inviato il ${fmtDate(invite.sent_at)})` : "Invia invito di registrazione";
  return (
    <>
      <Tooltip label={label}>
        <button
          type="button"
          aria-label={label}
          onClick={() => (invitesStatus === "unavailable" ? notify(invitesMessage ?? "Inviti non disponibili") : setOpen(true))}
          className={`relative grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-brand-soft hover:text-brand ${
            invite ? "text-brand" : "text-[#6c7486]"
          }`}
        >
          {invite ? <MailCheck className="h-4 w-4" strokeWidth={2.2} /> : <Mail className="h-4 w-4" strokeWidth={2.2} />}
        </button>
      </Tooltip>
      {open && <InviteDialog user={user} invite={invite} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Profile card: registration status, the code (kept after registration) and the send/resend action. */
export function RegistrationCard({ user }: { user: User }) {
  const { invitesStatus, invitesMessage } = useStore();
  const invite = useInviteFor(user);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const status = invite?.registered_at
    ? { label: "Registrato", cls: "bg-emerald-50 text-emerald-700", detail: `il ${fmtDate(invite.registered_at)}` }
    : invite
      ? { label: "Invitato", cls: "bg-brand-soft text-brand", detail: `invito inviato il ${fmtDate(invite.sent_at)}` }
      : { label: "Non invitato", cls: "bg-[#eef1f5] text-[#5b6476]", detail: "nessun invito inviato" };

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-[12px] font-bold uppercase tracking-wide text-muted">Accesso alla piattaforma</h2>
      {invitesStatus === "loading" ? (
        <div className="h-20 animate-pulse rounded-lg bg-canvas" />
      ) : invitesStatus === "unavailable" ? (
        <p className="text-[12.5px] text-muted">{invitesMessage}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-[3px] text-[11px] font-bold ${status.cls}`}>{status.label}</span>
            <span className="text-[12px] text-muted">{status.detail}</span>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-faint">Codice di registrazione</p>
            {invite ? (
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded-md bg-canvas px-2.5 py-1 font-mono text-[15px] font-bold tracking-[0.15em]">{invite.code}</code>
                <Tooltip label={copied ? "Copiato" : "Copia codice"}>
                  <button
                    type="button"
                    aria-label="Copia codice"
                    onClick={() => {
                      navigator.clipboard?.writeText(invite.code).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </Tooltip>
              </div>
            ) : (
              <p className="mt-1 text-[13px] text-muted">—</p>
            )}
          </div>
          {!invite?.registered_at && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline"
            >
              <Mail className="h-3.5 w-3.5" /> {invite ? "Reinvia invito" : "Invia invito di registrazione"}
            </button>
          )}
        </div>
      )}
      {open && <InviteDialog user={user} invite={invite} onClose={() => setOpen(false)} />}
    </div>
  );
}
