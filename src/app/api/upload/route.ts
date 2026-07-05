import { NextRequest, NextResponse } from "next/server";
import { extract, isSupported } from "@/lib/extract";
import { chunkPages, chunkText } from "@/lib/chunk";
import { embedBatch } from "@/lib/embeddings";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (>${MAX_BYTES / 1024 / 1024} Mo).` },
        { status: 413 },
      );
    }
    if (!isSupported(file.type, file.name)) {
      return NextResponse.json(
        {
          error: `Type non supporté : ${file.name} (${file.type || "type inconnu"}). Formats acceptés : PDF, DOCX, TXT, MD.`,
        },
        { status: 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await extract(buffer, file.type, file.name);

    if (!doc.text || doc.text.length < 20) {
      return NextResponse.json(
        {
          error:
            "Impossible d'extraire du texte. Le fichier est peut-être scanné (image) ou vide.",
        },
        { status: 422 },
      );
    }

    const chunks = doc.pages
      ? chunkPages(doc.pages)
      : chunkText(doc.text);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Le document n'a produit aucun chunk." },
        { status: 422 },
      );
    }

    const vectors = await embedBatch(chunks.map((c) => c.content));

    const supabase = getSupabase();
    const { data: inserted, error: insertErr } = await supabase
      .from("documents")
      .insert({
        filename: doc.filename,
        mime_type: doc.mimeType,
        raw_text: doc.text.slice(0, 100_000),
        page_count: doc.pages?.length ?? null,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error(insertErr);
      return NextResponse.json(
        { error: "Erreur lors de la sauvegarde du document." },
        { status: 500 },
      );
    }

    const rows = chunks.map((c, i) => ({
      document_id: inserted.id,
      chunk_index: c.index,
      page: c.page ?? null,
      content: c.content,
      embedding: vectors[i],
    }));

    const { error: chunkErr } = await supabase.from("document_chunks").insert(rows);
    if (chunkErr) {
      console.error(chunkErr);
      await supabase.from("documents").delete().eq("id", inserted.id);
      return NextResponse.json(
        { error: "Erreur lors de la sauvegarde des chunks." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      documentId: inserted.id,
      filename: doc.filename,
      chunkCount: chunks.length,
      pageCount: doc.pages?.length ?? null,
      preview: doc.text.slice(0, 500),
    });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Erreur inconnue lors de l'upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
