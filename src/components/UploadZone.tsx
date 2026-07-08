"use client";

import { useCallback, useRef, useState } from "react";
import type { UploadedDoc } from "@/app/page";

type Props = {
  onUploaded: (doc: UploadedDoc) => void;
};

export default function UploadZone({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erreur upload");
        onUploaded({ ...data, file } as UploadedDoc);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur upload");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragging
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-white hover:border-brand-400"
        }`}
      >
        <div className="text-3xl">📄</div>
        <p className="mt-3 text-base font-medium text-slate-900">
          {uploading ? "Analyse en cours…" : "Dépose un document"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          PDF, DOCX, TXT — jusqu'à 15 Mo
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </div>
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-6 rounded-xl bg-white p-5 text-sm text-slate-600 shadow-sm">
        <p className="font-medium text-slate-900">Comment ça marche</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
          <li>Ton document est extrait puis découpé en chunks</li>
          <li>
            Chaque chunk est transformé en vecteur par un modèle local
            (aucune API tierce pour les embeddings)
          </li>
          <li>Les vecteurs sont stockés dans pgvector (Supabase)</li>
          <li>
            Ta question déclenche une recherche sémantique, puis Claude répond
            en citant les passages exacts
          </li>
        </ol>
      </div>
    </div>
  );
}
