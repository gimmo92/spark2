import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profilo · Spark" };

export default function ProfiloPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-[17px] font-bold">Profilo</h1>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#22c3f5] to-[#2a7ef5] text-[17px] font-extrabold text-white">
          GB
        </div>
        <div>
          <p className="text-[16px] font-bold">Amministratore</p>
          <p className="text-[13px] text-muted">Valmec S.p.A. · Livello ADMIN</p>
        </div>
      </div>
    </div>
  );
}
