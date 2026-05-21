import { FileText, Sparkles, UploadCloud, FileSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UploadPdfCard } from "@/components/dashboard/upload-pdf-card";
import { AnimatedDashboardContainer } from "@/components/dashboard/animated-dashboard-container";
import { AnimatedDocumentList } from "@/components/dashboard/animated-document-list";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: documents } = await supabase
    .from("documents")
    .select("id,title,status,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const totalDocuments = documents?.length ?? 0;
  const completedDocuments = documents?.filter((document) => document.status === "completed").length ?? 0;
  const processingDocuments = documents?.filter((document) => document.status === "processing").length ?? 0;

  const header = (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 glass-panel p-7 sm:p-9 shadow-2xl">
      <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-indigo-500/20 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-cyan-500/20 blur-[80px]" />
      <div className="relative z-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5" />
          Command Center
        </p>
        <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">Welcome back to Lexora</h2>
        <p className="mt-3 max-w-2xl text-slate-400">
          Upload PDFs, run hybrid indexing, and explore document-grounded answers powered by sparse + dense
          retrieval.
        </p>
        <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 py-2 px-4 shadow-sm text-sm text-slate-300 backdrop-blur-md">
          Signed in as: <span className="font-semibold text-white ml-2">{user?.email ?? "unknown user"}</span>
        </div>
      </div>
    </div>
  );

  const kpis = [
    <div key="docs" className="h-full rounded-2xl border border-white/10 glass-panel p-5 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Total docs</p>
        <FileText className="h-4 w-4 text-slate-500" />
      </div>
      <p className="text-4xl font-bold text-white">{totalDocuments}</p>
    </div>,
    <div key="indexed" className="h-full rounded-2xl border border-white/10 glass-panel p-5 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/70">Indexed</p>
        <FileSearch className="h-4 w-4 text-emerald-500/70" />
      </div>
      <p className="text-4xl font-bold text-emerald-400">{completedDocuments}</p>
    </div>,
    <div key="processing" className="h-full rounded-2xl border border-white/10 glass-panel p-5 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/70">Processing</p>
        <UploadCloud className="h-4 w-4 text-amber-500/70" />
      </div>
      <p className="text-4xl font-bold text-amber-400">{processingDocuments}</p>
    </div>
  ];

  return (
    <AnimatedDashboardContainer 
      header={header}
      kpis={kpis}
      upload={
        <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-lg">
          <UploadPdfCard />
        </div>
      }
      list={<AnimatedDocumentList initialDocuments={documents || []} />}
    />
  );
}
