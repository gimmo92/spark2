import "server-only";

export const sendgridConfigured = () => Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Send the registration invite (code + prefilled link) through the SendGrid v3 API. */
export async function sendInviteEmail({ to, name, code, link }: { to: string; name?: string; code: string; link: string }) {
  const hello = name ? `Ciao ${name.split(" ")[0]},` : "Ciao,";
  const text = `${hello}

sei stato invitato su Spark, la piattaforma per obiettivi e MBO.

Il tuo codice di registrazione è: ${code}

Completa la registrazione e scegli la tua password qui:
${link}

Se non ti aspettavi questo invito, ignora questa email.`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1f2a3c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;padding:32px">
<tr><td style="font-size:18px;font-weight:bold;color:#1673e6">⚡ Spark</td></tr>
<tr><td style="padding-top:20px;font-size:15px;line-height:1.5">${esc(hello)}<br>sei stato invitato su Spark, la piattaforma per obiettivi e MBO.</td></tr>
<tr><td style="padding-top:20px;font-size:13px;color:#6b7486">Il tuo codice di registrazione</td></tr>
<tr><td style="padding-top:6px"><div style="display:inline-block;background:#e8f1fd;color:#1673e6;font-family:'Courier New',monospace;font-size:24px;font-weight:bold;letter-spacing:4px;padding:10px 16px;border-radius:8px">${esc(code)}</div></td></tr>
<tr><td style="padding-top:24px"><a href="${esc(link)}" style="display:inline-block;background:#1673e6;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:8px">Completa la registrazione</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#a3abba">Se non ti aspettavi questo invito, ignora questa email.</td></tr>
</table></td></tr></table></body></html>`;

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, ...(name ? { name } : {}) }] }],
      from: { email: process.env.SENDGRID_FROM, name: process.env.SENDGRID_FROM_NAME ?? "Spark" },
      subject: "Il tuo invito a Spark",
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
      tracking_settings: { click_tracking: { enable: false } }, // keep the registration link readable
    }),
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
