import { Briefcase, ArrowLeft, Bot, FileText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddDocumentToWorkspace } from "./add-document";
import { WorkspaceActions } from "./workspace-actions";
import { WorkspaceTabs } from "./workspace-tabs";
import { API_BASE_URL } from "@/lib/api";

export default async function WorkspacePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return notFound();
  }

  // Get workspace info
  const { data: workspaceData } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!workspaceData) {
    return notFound();
  }

  // Get documents in this workspace
  let workspaceDocuments = [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/workspaces/${params.id}/documents/${user.id}`, { cache: "no-store" });
    if (res.ok) {
      workspaceDocuments = await res.json();
    }
  } catch (e) {
    console.error(e);
  }

  // Get chat history
  const { data: chatHistory } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("workspace_id", params.id)
    .order("created_at", { ascending: true });

  const typedHistory = (chatHistory || []).map((msg) => ({
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
    created_at: msg.created_at,
  }));

  // Fetch all user documents to allow adding them to the workspace
  const { data: allDocs } = await supabase
    .from("documents")
    .select("id, title, status")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const availableDocs = (allDocs || []).filter(
    (doc) => !workspaceDocuments.find((wd: any) => wd.id === doc.id)
  );

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link href="/dashboard/workspaces" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Workspaces
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
               <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                 <Briefcase className="h-7 w-7" />
               </div>
               <div>
                 <WorkspaceActions workspaceId={params.id} userId={user.id} initialName={workspaceData.name} />
                 <p className="mt-1 text-slate-400">Workspace</p>
               </div>
            </div>
            <AddDocumentToWorkspace workspaceId={params.id} userId={user.id} availableDocs={availableDocs} />
          </div>
        </div>

        <WorkspaceTabs 
          userId={user.id} 
          workspace={workspaceData} 
          initialMessages={typedHistory} 
          workspaceDocuments={workspaceDocuments} 
        />
      </div>
    </div>
  );
}
