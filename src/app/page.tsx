"use client";

import { useState } from "react";
import UploadZone from "@/components/UploadZone";

export type UploadedDoc = {
  documentId: string;
  filename: string;
  chunkCount: number;
  pageCount: number | null;
  preview: string;
};

export default function HomePage() {
  const [doc, setDoc] = useState<UploadedDoc | null>(null);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">DocMind</h1>
            <p className="text-xs text-slate-500">
              Analyse de documents · RAG local · Claude
            </p>
          </div>
          {doc && (
            <button
              onClick={() => setDoc(null)}
              className="text-sm text-brand-600 hover:underline"
            >
              Nouveau document
            </button>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-8">
        {!doc ? (
          <UploadZone onUploaded={setDoc} />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              {doc.filename}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {doc.chunkCount} chunks stockés
              {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
              {" · "}document id : <code className="text-xs">{doc.documentId}</code>
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
              Aperçu du texte extrait
            </p>
            <pre className="mt-2 max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
              {doc.preview}
              {doc.preview.length >= 500 && "…"}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}
