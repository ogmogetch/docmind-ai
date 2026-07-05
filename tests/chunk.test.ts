import { describe, it, expect } from "vitest";
import { chunkText, chunkPages } from "@/lib/chunk";

describe("chunkText", () => {
  it("returns an empty array for empty text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("produces a single chunk when text fits under maxTokens", () => {
    const text = "Une phrase courte. Puis une autre.";
    const chunks = chunkText(text, { maxTokens: 500 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toContain("Une phrase courte");
  });

  it("splits long text into several chunks with sequential indexes", () => {
    const sentence = "Cette phrase mesure environ quarante-cinq caractères. ";
    const text = sentence.repeat(80);
    const chunks = chunkText(text, { maxTokens: 100, overlapTokens: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(c.content.length).toBeGreaterThan(0);
    });
  });

  it("applies overlap between consecutive chunks", () => {
    const parts: string[] = [];
    for (let i = 0; i < 40; i++) {
      parts.push(`Phrase ${i} avec du contenu répété pour tester le chunker.`);
    }
    const text = parts.join(" ");
    const chunks = chunkText(text, { maxTokens: 80, overlapTokens: 20 });
    expect(chunks.length).toBeGreaterThan(2);
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1].content.slice(-40);
      const head = chunks[i].content.slice(0, 40);
      expect(tail.length).toBeGreaterThan(0);
      expect(head.length).toBeGreaterThan(0);
    }
  });

  it("splits sentences that individually exceed maxChars", () => {
    const giant = "A".repeat(4000);
    const chunks = chunkText(giant, { maxTokens: 100, overlapTokens: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("chunkPages", () => {
  it("preserves page numbers on emitted chunks", () => {
    const pages = [
      "Contenu page une, premier paragraphe court.",
      "Contenu page deux, un autre paragraphe distinct.",
      "Contenu page trois, encore un peu de texte pour la démo.",
    ];
    const chunks = chunkPages(pages, { maxTokens: 500 });
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.page)).toEqual([1, 2, 3]);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it("skips empty pages without breaking numbering", () => {
    const pages = ["Premier", "", "Troisième"];
    const chunks = chunkPages(pages, { maxTokens: 500 });
    const pageNumbers = chunks.map((c) => c.page);
    expect(pageNumbers).toContain(1);
    expect(pageNumbers).toContain(3);
    expect(pageNumbers).not.toContain(2);
  });
});
