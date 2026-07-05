"use client";

import { useEffect, useState } from "react";
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
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) {
      setSummary(null);
      setSummaryError(null);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    setSummary(null);
    setSummaryError(null);
    (async () => {
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentId: doc.documentId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Erreur résumé");
        setSummary(data.summary);
      } catch (err) {
        if (!cancelled) {
          setSummaryError(err instanceof Error ? err.message : "Erreur résumé");
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

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
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                {doc.filename}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {doc.chunkCount} chunks
                {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
              </p>
            </div>

            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                Résumé automatique
              </p>
              {summaryLoading && (
                <p className="mt-3 text-sm text-slate-600">
                  Génération du résumé…
                </p>
              )}
              {summaryError && (
                <p className="mt-3 text-sm text-red-700">{summaryError}</p>
              )}
              {summary && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
                  {summary}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Aperçu du texte extrait
              </p>
              <pre className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                {doc.preview}
                {doc.preview.length >= 500 && "…"}
              </pre>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
