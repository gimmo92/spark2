import Link from "next/link";
import { notFound } from "next/navigation";
import { Construction } from "lucide-react";

const PAGES: Record<string, { title: string; module?: boolean }> = {
  "azienda/modifica": { title: "Modifica azienda" },
  "azienda/societa": { title: "Gestione Società" },
  "azienda/ruoli": { title: "Gestione Ruoli" },
  "azienda/organigramma": { title: "Organigramma" },
  "azienda/lettere": { title: "Gestione Lettere" },
  "mbo/obiettivi": { title: "Obiettivi" },
  "mbo/schede": { title: "Schede MBO" },
  "mbo/consuntivazione": { title: "Consuntivazione" },
  competenze: { title: "Competenze", module: true },
  valutazioni: { title: "Valutazioni", module: true },
  okr: { title: "OKR", module: true },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((k) => ({ slug: k.split("/") }));
}

export async function generateMetadata(props: PageProps<"/[...slug]">) {
  const { slug } = await props.params;
  const p = PAGES[slug.join("/")];
  return { title: p ? `${p.title} · Spark` : "Spark" };
}

export default async function Placeholder(props: PageProps<"/[...slug]">) {
  const { slug } = await props.params;
  const page = PAGES[slug.join("/")];
  if (!page) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-[17px] font-bold">{page.title}</h1>
      <div className="card grid place-items-center px-6 py-20 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Construction className="h-6 w-6" />
        </div>
        <p className="mt-4 text-[14px] font-semibold">
          {page.module ? "Modulo non attivo per la tua azienda" : "Sezione in costruzione"}
        </p>
        <p className="mt-1 max-w-sm text-[12.5px] text-muted">
          {page.module
            ? "Contatta il tuo referente Spark per attivare questo modulo."
            : "Questa pagina sarà disponibile a breve."}
        </p>
        <Link href="/azienda/utenti" className="mt-4 text-[12.5px] font-semibold text-brand hover:underline">
          Vai alla Lista Utenti
        </Link>
      </div>
    </div>
  );
}
