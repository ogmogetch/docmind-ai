"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props = {
  file: File;
};

export default function PdfPreview({ file }: Props) {
  const [data, setData] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setPageCount(0);
    setPage(1);
    file.arrayBuffer().then((buf) => {
      if (!cancelled) setData(new Uint8Array(buf));
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    function measure() {
      const el = document.getElementById("pdf-preview-wrap");
      if (el) setWidth(Math.max(320, Math.min(el.clientWidth - 24, 900)));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const fileProp = useMemo(() => (data ? { data } : null), [data]);

  return (
    <div
      id="pdf-preview-wrap"
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-600">
        <span className="truncate">{file.name}</span>
        {pageCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-slate-300 px-2 py-0.5 disabled:opacity-40"
            >
              ‹
            </button>
            <span>
              {page} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded border border-slate-300 px-2 py-0.5 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto bg-slate-100 p-3">
        {fileProp ? (
          <Document
            file={fileProp}
            onLoadSuccess={({ numPages }) => setPageCount(numPages)}
            loading={
              <p className="p-6 text-center text-sm text-slate-500">
                Chargement du PDF…
              </p>
            }
            error={
              <p className="p-6 text-center text-sm text-red-600">
                Impossible d'afficher ce PDF.
              </p>
            }
          >
            <Page
              pageNumber={page}
              width={width}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          </Document>
        ) : (
          <p className="p-6 text-center text-sm text-slate-500">
            Lecture du fichier…
          </p>
        )}
      </div>
    </div>
  );
}
