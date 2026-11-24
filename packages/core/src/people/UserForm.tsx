"use client";

import { useOrg, useSparkConfig } from "../shell/SparkProvider";
import { useState } from "react";
import { useAccess } from "../access/useAccess";
import { fullName, slugEmail, type User } from "./data";
import { useCore } from "../shell/SparkProvider";
import { Field, GhostButton, Modal, PrimaryButton, inputCls } from "../ui/ui";
import { tr } from "../i18n/i18n";

type Draft = Omit<User, "id" | "createdAt">;

export function UserFormModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const { teamNames: TEAMS, companyForTeam, buForTeam, emailDomains } = useOrg();
  const { users, addUser, updateUser, notify } = useCore();
  const { userFields = [] } = useSparkConfig();
  const { levels, allowed, isAdmin, adminLevel } = useAccess();
  const canSetLevel = allowed("people.level");
  const levelOptions = levels.filter((l) => isAdmin || l.id !== adminLevel);
  const managers = users.filter((u) => u.id !== user?.id && u.status === "attivo").sort((a, b) => a.lastName.localeCompare(b.lastName));
  const [d, setD] = useState<Draft>(
    user ?? {
      firstName: "",
      lastName: "",
      email: "",
      level: "UTENTE",
      team: TEAMS[0] ?? "",
      company: companyForTeam(TEAMS[0] ?? ""),
      role: "",
      status: "attivo",
    },
  );
  const [emailTouched, setEmailTouched] = useState(!!user);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((prev) => {
      const next = { ...prev, [k]: v };
      if (!emailTouched && emailDomains[0] && (k === "firstName" || k === "lastName") && next.firstName && next.lastName)
        next.email = slugEmail(next.firstName, next.lastName, emailDomains[0]);
      if (k === "team") next.company = companyForTeam(v as string);
      return next;
    });

  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!d.firstName.trim()) errors.firstName = "Inserisci il nome";
  if (!d.lastName.trim()) errors.lastName = "Inserisci il cognome";
  if (!/^\S+@\S+\.\S+$/.test(d.email)) errors.email = "Email non valida";
  else if (users.some((u) => u.email.toLowerCase() === d.email.toLowerCase() && u.id !== user?.id)) errors.email = "Email già registrata";
  if (!d.role.trim()) errors.role = "Inserisci il ruolo";
  const show = (k: keyof Draft) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    if (user) {
      updateUser(user.id, d);
      notify(tr("Utente aggiornato"));
    } else {
      addUser(d);
      notify(tr("{0} {1} aggiunto", [d.firstName, d.lastName]));
    }
    onClose();
  };

  return (
    <Modal
      title={user ? tr("Modifica utente") : tr("Nuovo utente")}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={save}>{user ? tr("Salva modifiche") : tr("Crea utente")}</PrimaryButton>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label={tr("Nome")} error={show("firstName")}>
          <input autoFocus className={inputCls} value={d.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label={tr("Cognome")} error={show("lastName")}>
          <input className={inputCls} value={d.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={tr("Email")} error={show("email")}>
            <input
              type="email"
              className={inputCls}
              value={d.email}
              onChange={(e) => {
                setEmailTouched(true);
                set("email", e.target.value);
              }}
              placeholder={tr("nome.cognome@tryspark.co")}
            />
          </Field>
        </div>
        <Field label={tr("Livello di accesso")}>
          <select
            className={`${inputCls} disabled:bg-canvas disabled:text-muted`}
            value={d.level}
            disabled={!canSetLevel}
            title={canSetLevel ? undefined : tr("Il tuo livello di accesso non permette di cambiarlo")}
            onChange={(e) => set("level", e.target.value as Draft["level"])}
          >
            {(canSetLevel ? levelOptions : levels).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr("Team")}>
          <select className={inputCls} value={d.team} onChange={(e) => set("team", e.target.value)}>
            <option value="">{tr("Nessun team")}</option>
            {TEAMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={tr("Responsabile")}>
            <select className={inputCls} value={d.managerId ?? ""} onChange={(e) => set("managerId", e.target.value || undefined)}>
              <option value="">{tr("Nessun responsabile")}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {fullName(m)} · {m.role}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {userFields.map((f) => (
          <Field key={f.key} label={tr(f.label)}>
            <span className="relative block">
              <input
                type={f.type === "number" ? "number" : "text"}
                className={`${inputCls} ${f.type === "number" ? "text-right tabular-nums" : ""} ${f.suffix ? "pr-12" : ""}`}
                value={d.extra?.[f.key] ?? ""}
                placeholder={tr(f.placeholder)}
                maxLength={f.maxLength}
                onChange={(e) => {
                  const raw = f.upper ? e.target.value.toUpperCase() : e.target.value;
                  const extra = { ...(d.extra ?? {}) };
                  if (raw === "") delete extra[f.key];
                  else extra[f.key] = f.type === "number" ? Number(raw) : raw;
                  set("extra", Object.keys(extra).length ? extra : undefined);
                }}
              />
              {f.suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">{f.suffix}</span>}
            </span>
          </Field>
        ))}
        <div className="sm:col-span-2">
          <Field label={tr("Ruolo")} error={show("role")}>
            <input className={inputCls} value={d.role} onChange={(e) => set("role", e.target.value)} placeholder={tr("es. Production Dept. Supervisor")} />
          </Field>
        </div>
        <p className="text-[12px] text-muted sm:col-span-2">{tr("Società:")}{" "}<span className="font-semibold text-ink">{d.company}</span>
          {buForTeam(d.team) && (
            <>{" "}{tr("· BU:")}{" "}<span className="font-semibold text-ink">{buForTeam(d.team)}</span>
            </>
          )}
        </p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
