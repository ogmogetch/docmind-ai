import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getClaude, CLAUDE_MODEL } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_INPUT_CHARS = 60_000;

export async function POST(req: NextRequest) {
  try {
    const { documentId } = (await req.json()) as { documentId?: string };
    if (!documentId) {
      return NextResponse.json({ error: "documentId requis." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, filename, summary, raw_text")
      .eq("id", documentId)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: "Document introuvable." },
        { status: 404 },
      );
    }

    if (doc.summary) {
      return NextResponse.json({ summary: doc.summary, cached: true });
    }

    const truncated = doc.raw_text.slice(0, MAX_INPUT_CHARS);

    const claude = getClaude();
    const response = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Tu es un assistant qui résume des documents. Voici le document "${doc.filename}".

Rédige un résumé clair et structuré en français (5 à 8 phrases) qui couvre :
- de quoi parle le document
- les points clés
- les informations chiffrées importantes s'il y en a

N'invente rien. Reste strictement dans le contenu fourni.

--- DOCUMENT ---
${truncated}`,
        },
      ],
    });

    const summary = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    await supabase
      .from("documents")
      .update({ summary })
      .eq("id", documentId);

    return NextResponse.json({ summary, cached: false });
  } catch (err) {
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
