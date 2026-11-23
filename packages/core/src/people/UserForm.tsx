"use client";

import { useOrg } from "../shell/SparkProvider";
import { useState } from "react";
import { ACCESS_LEVELS, slugEmail, type User } from "./data"
import { useCore } from "../shell/SparkProvider";
import { Field, GhostButton, Modal, PrimaryButton, inputCls } from "../ui/ui";

type Draft = Omit<User, "id" | "createdAt">;

export function UserFormModal({ user, onClose }: { user?: User; onClose: () => void }) {
  const { teamNames: TEAMS, companyForTeam, emailDomains } = useOrg();
  const { users, addUser, updateUser, notify } = useCore();
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
  else if (users.some((u) => u.email.toLowerCase() === d.email.toLowerCase() && u.id !== user?.id))
    errors.email = "Email già registrata";
  if (!d.role.trim()) errors.role = "Inserisci il ruolo";
  const show = (k: keyof Draft) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    if (user) {
      updateUser(user.id, d);
      notify("Utente aggiornato");
    } else {
      addUser(d);
      notify(`${d.firstName} ${d.lastName} aggiunto`);
    }
    onClose();
  };

  return (
    <Modal
      title={user ? "Modifica utente" : "Nuovo utente"}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Annulla</GhostButton>
          <PrimaryButton onClick={save}>{user ? "Salva modifiche" : "Crea utente"}</PrimaryButton>
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
        <Field label="Nome" error={show("firstName")}>
          <input autoFocus className={inputCls} value={d.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Cognome" error={show("lastName")}>
          <input className={inputCls} value={d.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email" error={show("email")}>
            <input
              type="email"
              className={inputCls}
              value={d.email}
              onChange={(e) => {
                setEmailTouched(true);
                set("email", e.target.value);
              }}
              placeholder="nome.cognome@tryspark.co"
            />
          </Field>
        </div>
        <Field label="Livello di accesso">
          <select className={inputCls} value={d.level} onChange={(e) => set("level", e.target.value as Draft["level"])}>
            {ACCESS_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l.charAt(0) + l.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Team">
          <select className={inputCls} value={d.team} onChange={(e) => set("team", e.target.value)}>
            <option value="">Nessun team</option>
            {TEAMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ruolo" error={show("role")}>
            <input
              className={inputCls}
              value={d.role}
              onChange={(e) => set("role", e.target.value)}
              placeholder="es. Production Dept. Supervisor"
            />
          </Field>
        </div>
        <p className="text-[12px] text-muted sm:col-span-2">
          Società: <span className="font-semibold text-ink">{d.company}</span>
        </p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
