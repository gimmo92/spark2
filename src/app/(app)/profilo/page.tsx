import type { Metadata } from "next";

export const metadata: Metadata = { title: "Profilo · Spark" };

export default function ProfiloPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold">Profilo</h1>
      <div className="card flex flex-wrap items-center gap-5 p-6">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#22c3f5] to-[#2a7ef5] text-[22px] font-extrabold text-white">
          GB
        </div>
        <div>
          <p className="text-[20px] font-bold">Amministratore</p>
          <p className="text-[15px] text-muted">Rossi S.p.A. · Livello ADMIN</p>
        </div>
      </div>
    </div>
  );
}
