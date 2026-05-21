"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, ShieldCheck, Sparkles } from "lucide-react";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "documents";

export function UploadPdfCard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onUpload = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!file) {
        setError("Select a document file first.");
        return;
      }

      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv"
      ];

      if (!allowedTypes.includes(file.type)) {
        setError("Unsupported file format. Please upload PDF, DOCX, XLSX, or CSV.");
        return;
      }

      setIsUploading(true);
      const supabase = createClient();

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (userError || !user) {
        throw new Error("You must be logged in to upload documents.");
      }
      if (!session?.access_token) {
        throw new Error("Session expired. Please sign out and sign in again.");
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase frontend environment variables.");
      }

      // Force an authenticated JWT for storage upload so auth.uid() is available in RLS checks.
      const storageClient = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const filePath = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await storageClient.storage.from(STORAGE_BUCKET).upload(filePath, file, {
        upsert: false,
        contentType: file.type
      });

      if (uploadError) {
        if (uploadError.message.toLowerCase().includes("row-level security")) {
          throw new Error("Upload blocked by storage RLS. Ensure storage.sql has been applied in Supabase.");
        }
        if (uploadError.message.toLowerCase().includes("bucket")) {
          throw new Error("Storage bucket not found. Create a private bucket named 'documents'.");
        }
        throw new Error(uploadError.message);
      }

      const ingestResponse = await fetch(`${API_BASE_URL}/api/v1/documents/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`
        },
        body: JSON.stringify({
          user_id: user.id,
          bucket: STORAGE_BUCKET,
          file_path: filePath,
          title: file.name,
          mime_type: file.type
        })
      });

      if (!ingestResponse.ok) {
        const payload = (await ingestResponse.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || "Ingestion failed");
      }

      setSuccess("Upload complete. Document ingestion started and vectors were indexed.");
      setFile(null);
      router.refresh();
    } catch (uploadErr) {
      setError(uploadErr instanceof Error ? uploadErr.message : "Unexpected upload error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="overflow-hidden rounded-3xl glass-panel border-white/10 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-2xl text-white">Upload and Index</CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-slate-400">
              Upload your PDF, DOCX, XLSX, or CSV. The system will automatically chunk, index, summarize, and extract entities.
            </CardDescription>
          </div>
          <div className="hidden rounded-xl border border-indigo-500/30 bg-indigo-500/20 p-2 text-indigo-400 sm:block">
            <FileUp className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Label htmlFor="pdf" className="text-sm font-semibold text-slate-300">
              Document File
            </Label>
            {file ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                {file.name}
              </span>
            ) : null}
          </div>
          <Input
            id="pdf"
            type="file"
            accept=".pdf,.docx,.xlsx,.csv"
            className="h-11 bg-white/5 border-white/10 text-white file:text-white file:border-0 file:bg-transparent file:font-medium focus-visible:ring-indigo-500"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" onClick={onUpload} disabled={isUploading} className="glass-button h-11 rounded-xl px-6 bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
            <Sparkles className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading and indexing..." : "Upload and ingest"}
          </Button>
          <p className="inline-flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Private bucket + per-user access policy
          </p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null}
      </CardContent>
    </Card>
  );
}
