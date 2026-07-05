import { NextRequest } from "next/server";
import { getLlm } from "@/lib/llm";
import { getSupabase } from "@/lib/supabase";
import { buildContext, retrieve, type RetrievedChunk } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

const NO_CONTEXT_ANSWER =
  "Je ne trouve pas cette information dans le document.";

type ChatBody = {
  documentId?: string;
  question?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

function sseEvent(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalide." }), {
      status: 400,
    });
  }

  const { documentId, question } = body;
  if (!documentId || !question || question.trim().length < 2) {
    return new Response(
      JSON.stringify({ error: "documentId et question requis." }),
      { status: 400 },
    );
  }

  const history = (body.history ?? []).slice(-8);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: object) =>
        controller.enqueue(encoder.encode(sseEvent(payload)));

      try {
        const supabase = getSupabase();
        const { data: docRow } = await supabase
          .from("documents")
          .select("summary")
          .eq("id", documentId)
          .single();

        const chunks: RetrievedChunk[] = await retrieve(documentId, question);

        send({
          type: "sources",
          sources: chunks.map((c) => ({
            chunkIndex: c.chunkIndex,
            page: c.page,
            content: c.content,
            similarity: c.similarity,
          })),
        });

        if (chunks.length === 0 && !docRow?.summary) {
          for (const word of NO_CONTEXT_ANSWER.split(" ")) {
            send({ type: "delta", text: word + " " });
          }
          send({ type: "done" });
          controller.close();
          return;
        }

        const context = buildContext(chunks);
        const summaryBlock = docRow?.summary
          ? `Résumé du document (contexte général) :\n${docRow.summary}\n\n`
          : "";

        const system = `Tu es un assistant qui répond STRICTEMENT à partir du document fourni.

Le contexte contient un résumé du document et des extraits jugés les plus pertinents pour la question.

Règles impératives :
- Utilise en priorité les extraits ; le résumé sert de contexte global.
- N'ajoute jamais d'informations qui ne sont pas dans le document.
- Si l'information n'y figure vraiment pas, réponds exactement : "${NO_CONTEXT_ANSWER}".
- Cite le numéro d'extrait entre crochets quand c'est pertinent, ex : [Extrait 2].
- Reste concis, en français.`;

        const llm = getLlm();
        const messages = [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          {
            role: "user" as const,
            content: `${summaryBlock}${
              context ? `Extraits :\n\n${context}\n\n---\n\n` : ""
            }Question : ${question}`,
          },
        ];

        for await (const delta of llm.stream({
          system,
          messages,
          maxTokens: 800,
        })) {
          send({ type: "delta", text: delta });
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur inconnue.";
        send({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
