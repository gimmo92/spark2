import "server-only";

/**
 * Every Spark email (invites, login codes, password reset) is sent by the core through the
 * SendGrid v3 API, so client Supabase projects need no SMTP or email templates.
 */
export const sendgridConfigured = () => Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Block = { p: string } | { code: string; label: string } | { button: string; href: string } | { note: string };

function layout(blocks: Block[]) {
  const rows = blocks
    .map((b) => {
      if ("p" in b) return `<tr><td style="padding-top:20px;font-size:15px;line-height:1.5">${esc(b.p).replace(/\n/g, "<br>")}</td></tr>`;
      if ("code" in b)
        return `<tr><td style="padding-top:20px;font-size:13px;color:#6b7486">${esc(b.label)}</td></tr>
<tr><td style="padding-top:6px"><div style="display:inline-block;background:#e8f1fd;color:#1673e6;font-family:'Courier New',monospace;font-size:24px;font-weight:bold;letter-spacing:4px;padding:10px 16px;border-radius:8px">${esc(b.code)}</div></td></tr>`;
      if ("button" in b)
        return `<tr><td style="padding-top:24px"><a href="${esc(b.href)}" style="display:inline-block;background:#1673e6;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:8px">${esc(b.button)}</a></td></tr>`;
      return `<tr><td style="padding-top:24px;font-size:12px;color:#a3abba">${esc(b.note)}</td></tr>`;
    })
    .join("\n");
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1f2a3c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;padding:32px">
<tr><td style="font-size:18px;font-weight:bold;color:#1673e6">⚡ Spark</td></tr>
${rows}
</table></td></tr></table></body></html>`;
}

async function send({ to, name, subject, text, blocks }: { to: string; name?: string; subject: string; text: string; blocks: Block[] }) {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, ...(name ? { name } : {}) }] }],
      from: { email: process.env.SENDGRID_FROM, name: process.env.SENDGRID_FROM_NAME ?? "Spark" },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: layout(blocks) },
      ],
      tracking_settings: { click_tracking: { enable: false } }, // keep links readable and unmodified
    }),
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Registration invite: code + prefilled link. */
export async function sendInviteEmail({ to, name, code, link }: { to: string; name?: string; code: string; link: string }) {
  const hello = name ? `Ciao ${name.split(" ")[0]},` : "Ciao,";
  await send({
    to,
    name,
    subject: "Il tuo invito a Spark",
    text: `${hello}\n\nsei stato invitato su Spark, la piattaforma per obiettivi e MBO.\n\nIl tuo codice di registrazione è: ${code}\n\nCompleta la registrazione e scegli la tua password qui:\n${link}\n\nSe non ti aspettavi questo invito, ignora questa email.`,
    blocks: [
      { p: `${hello}\nsei stato invitato su Spark, la piattaforma per obiettivi e MBO.` },
      { label: "Il tuo codice di registrazione", code },
      { button: "Completa la registrazione", href: link },
      { note: "Se non ti aspettavi questo invito, ignora questa email." },
    ],
  });
}

/** Second login step: the 6-digit code. */
export async function sendLoginCodeEmail({ to, code }: { to: string; code: string }) {
  await send({
    to,
    subject: `${code} è il tuo codice di accesso a Spark`,
    text: `Il tuo codice di accesso a Spark è: ${code}\n\nInseriscilo nella pagina di accesso per completare il login. Scade tra un'ora.\n\nSe non stai accedendo tu, qualcuno conosce la tua password: cambiala subito.`,
    blocks: [
      { p: "Ecco il codice per completare l'accesso a Spark." },
      { label: "Codice di accesso", code },
      { note: "Scade tra un'ora. Se non stai accedendo tu, qualcuno conosce la tua password: cambiala subito." },
    ],
  });
}

/** Password reset link. */
export async function sendPasswordResetEmail({ to, link }: { to: string; link: string }) {
  await send({
    to,
    subject: "Reimposta la tua password di Spark",
    text: `Hai chiesto di reimpostare la password di Spark.\n\nScegli una nuova password qui:\n${link}\n\nSe non l'hai chiesto tu, ignora questa email: la password attuale resta valida.`,
    blocks: [
      { p: "Hai chiesto di reimpostare la password di Spark." },
      { button: "Scegli una nuova password", href: link },
      { note: "Se non l'hai chiesto tu, ignora questa email: la password attuale resta valida." },
    ],
  });
}
