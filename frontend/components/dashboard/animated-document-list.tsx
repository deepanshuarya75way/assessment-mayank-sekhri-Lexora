"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Trash2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { API_BASE_URL } from "@/lib/api";

type Document = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

interface AnimatedDocumentListProps {
  initialDocuments: Document[];
}

export function AnimatedDocumentList({ initialDocuments }: AnimatedDocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (docId: string) => {
    // Basic confirmation
    if (!window.confirm("Are you sure you want to permanently delete this document and all its indexed data?")) {
      return;
    }

    try {
      setIsDeleting(docId);
      const supabase = createClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired.");
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/documents/${docId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.detail || "Failed to delete document.");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting document");
    } finally {
      setIsDeleting(null);
    }
  };

  const statusClassname: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    processing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    uploaded: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, scale: 0.95, height: 0, marginBottom: 0, transition: { duration: 0.2 } }
  };

  return (
    <div className="rounded-3xl border border-white/10 glass-panel p-6 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20 text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-bold text-white">Recent Documents</h3>
        </div>
      </div>

      <motion.div 
        className="space-y-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {documents.length ? (
            documents.map((document) => (
              <motion.div
                key={document.id}
                variants={itemVariants}
                exit="exit"
                layout
                className="group relative rounded-2xl border border-white/5 bg-white/5 p-4 transition-colors hover:border-indigo-500/50 hover:bg-white/10 overflow-hidden"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="pr-12">
                    <Link
                      href={`/dashboard/documents/${document.id}`}
                      className="text-lg font-medium text-white transition group-hover:text-indigo-300"
                    >
                      {document.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-400">Created: {new Date(document.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize shadow-sm ${statusClassname[document.status] ?? "bg-slate-800 text-slate-300 border-slate-700"}`}
                    >
                      <div className={`h-1.5 w-1.5 rounded-full ${document.status === 'completed' ? 'bg-emerald-400' : document.status === 'processing' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'}`}></div>
                      {document.status}
                    </span>
                    <button
                      onClick={() => handleDelete(document.id)}
                      disabled={isDeleting === document.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg text-rose-400 hover:bg-rose-500/20 focus:outline-none focus:opacity-100 disabled:opacity-50"
                      title="Delete Document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-slate-400 mb-4">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-base font-medium text-slate-300">No documents yet</p>
              <p className="mt-2 text-sm text-slate-500">Upload your first PDF above to start ingestion and chat.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
