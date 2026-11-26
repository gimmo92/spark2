import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/PlaceholderPage";

const PAGES: Record<string, { title: string; module?: boolean }> = {
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

  return <PlaceholderPage title={page.title} module={page.module} />;
}
