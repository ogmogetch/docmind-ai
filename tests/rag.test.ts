import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RetrievedChunk } from "@/lib/rag";

vi.mock("@/lib/embeddings", () => ({
  embed: vi.fn(async (q: string) => Array.from({ length: 8 }, () => q.length)),
  EMBEDDING_DIMENSIONS: 384,
}));

const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ rpc }),
  hasSupabaseCreds: () => true,
}));

beforeEach(() => {
  rpc.mockReset();
});

describe("buildContext", () => {
  it("returns an empty string when there are no chunks", async () => {
    const { buildContext } = await import("@/lib/rag");
    expect(buildContext([])).toBe("");
  });

  it("labels each extract with page or chunk index", async () => {
    const { buildContext } = await import("@/lib/rag");
    const chunks: RetrievedChunk[] = [
      { chunkIndex: 3, page: 2, content: "Alpha", similarity: 0.9 },
      { chunkIndex: 4, page: null, content: "Beta", similarity: 0.8 },
    ];
    const ctx = buildContext(chunks);
    expect(ctx).toContain("[Extrait 1 — Page 2]");
    expect(ctx).toContain("Alpha");
    expect(ctx).toContain("[Extrait 2 — Chunk 4]");
    expect(ctx).toContain("Beta");
    expect(ctx.split("---")).toHaveLength(2);
  });
});

describe("retrieve", () => {
  it("calls the pgvector RPC and filters by minimum similarity", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { id: 1, chunk_index: 0, page: 1, content: "high", similarity: 0.9 },
        { id: 2, chunk_index: 1, page: 1, content: "mid", similarity: 0.3 },
        { id: 3, chunk_index: 2, page: 2, content: "low", similarity: 0.1 },
      ],
      error: null,
    });

    const { retrieve } = await import("@/lib/rag");
    const chunks = await retrieve("doc-uuid", "question", {
      topK: 5,
      minSimilarity: 0.25,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [rpcName, args] = rpc.mock.calls[0];
    expect(rpcName).toBe("match_document_chunks");
    expect(args).toMatchObject({
      p_document_id: "doc-uuid",
      p_match_count: 5,
    });
    expect(Array.isArray(args.p_query_embedding)).toBe(true);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe("high");
    expect(chunks[1].content).toBe("mid");
  });

  it("returns an empty array when the RPC yields no rows", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const { retrieve } = await import("@/lib/rag");
    const chunks = await retrieve("doc-uuid", "question");
    expect(chunks).toEqual([]);
  });

  it("falls back to top rows when nothing clears the similarity floor", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { id: 1, chunk_index: 0, page: 1, content: "weak-1", similarity: 0.10 },
        { id: 2, chunk_index: 1, page: 1, content: "weak-2", similarity: 0.09 },
        { id: 3, chunk_index: 2, page: 2, content: "weak-3", similarity: 0.05 },
      ],
      error: null,
    });
    const { retrieve } = await import("@/lib/rag");
    const chunks = await retrieve("doc-uuid", "question", {
      minSimilarity: 0.9,
      fallbackTopK: 2,
    });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe("weak-1");
    expect(chunks[1].content).toBe("weak-2");
  });

  it("throws when the RPC returns an error", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    const { retrieve } = await import("@/lib/rag");
    await expect(retrieve("doc", "q")).rejects.toThrow(/boom/);
  });
});
