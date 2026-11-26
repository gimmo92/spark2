import type { Metadata } from "next";
import { COMPANY_PAGES, CompanyArea } from "@spark/core";

// "La mia azienda" pages come from the core (COMPANY_PAGES): new ones appear here without changes
export function generateStaticParams() {
  return COMPANY_PAGES.map((p) => ({ slug: [p.slug] }));
}

export async function generateMetadata(props: PageProps<"/azienda/[...slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const page = COMPANY_PAGES.find((p) => p.slug === slug.join("/"));
  return { title: page ? `${page.title} · Spark` : "Spark" };
}

export default async function CompanyPage(props: PageProps<"/azienda/[...slug]">) {
  const { slug } = await props.params;
  return <CompanyArea slug={slug.join("/")} />;
}
