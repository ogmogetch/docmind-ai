import { embed } from "@/lib/embeddings";
import { getSupabase } from "@/lib/supabase";

export type RetrievedChunk = {
  chunkIndex: number;
  page: number | null;
  content: string;
  similarity: number;
};

export type RetrievalOptions = {
  topK?: number;
  minSimilarity?: number;
};

export async function retrieve(
  documentId: string,
  question: string,
  options: RetrievalOptions = {},
): Promise<RetrievedChunk[]> {
  const topK = options.topK ?? 5;
  const minSimilarity = options.minSimilarity ?? 0.25;

  const queryEmbedding = await embed(question);
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("match_document_chunks", {
    p_document_id: documentId,
    p_query_embedding: queryEmbedding,
    p_match_count: topK,
  });

  if (error) {
    throw new Error(`Retrieval error: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: number;
    chunk_index: number;
    page: number | null;
    content: string;
    similarity: number;
  }>;

  return rows
    .filter((r) => r.similarity >= minSimilarity)
    .map((r) => ({
      chunkIndex: r.chunk_index,
      page: r.page,
      content: r.content,
      similarity: r.similarity,
    }));
}

export function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map((c, i) => {
      const label = c.page ? `Page ${c.page}` : `Chunk ${c.chunkIndex}`;
      return `[Extrait ${i + 1} — ${label}]\n${c.content}`;
    })
    .join("\n\n---\n\n");
}
