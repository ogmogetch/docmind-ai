import { describe, it, expect } from "vitest";
import { extract, isSupported } from "@/lib/extract";

describe("isSupported", () => {
  it("accepts PDF, DOCX, TXT and MD", () => {
    expect(isSupported("application/pdf", "a.pdf")).toBe(true);
    expect(
      isSupported(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "a.docx",
      ),
    ).toBe(true);
    expect(isSupported("text/plain", "a.txt")).toBe(true);
    expect(isSupported("text/markdown", "a.md")).toBe(true);
  });

  it("falls back to filename when mime type is empty", () => {
    expect(isSupported("", "notes.md")).toBe(true);
    expect(isSupported("", "contract.pdf")).toBe(true);
  });

  it("rejects clearly unsupported binary types", () => {
    expect(isSupported("image/png", "shot.png")).toBe(false);
    expect(isSupported("audio/mpeg", "song.mp3")).toBe(false);
  });

  it("accepts octet-stream and lets extract decide", () => {
    expect(isSupported("application/octet-stream", "notes")).toBe(true);
    expect(isSupported("application/octet-stream", "report.pdf")).toBe(true);
  });
});

describe("extract", () => {
  it("extracts text from a UTF-8 TXT buffer", async () => {
    const text = "Bonjour DocMind. Ceci est un fichier texte de démonstration.";
    const buf = Buffer.from(text, "utf8");
    const result = await extract(buf, "text/plain", "demo.txt");
    expect(result.filename).toBe("demo.txt");
    expect(result.mimeType).toBe("text/plain");
    expect(result.text).toBe(text.trim());
    expect(result.pages).toBeUndefined();
  });

  it("keeps accented characters intact for TXT input", async () => {
    const text = "Café — résumé — déjà — voilà.";
    const buf = Buffer.from(text, "utf8");
    const result = await extract(buf, "text/plain", "accents.txt");
    expect(result.text).toContain("Café");
    expect(result.text).toContain("résumé");
    expect(result.text).toContain("voilà");
  });

  it("treats markdown files as text", async () => {
    const md = "# Titre\n\nParagraphe.";
    const buf = Buffer.from(md, "utf8");
    const result = await extract(buf, "text/markdown", "readme.md");
    expect(result.mimeType).toBe("text/markdown");
    expect(result.text).toContain("Paragraphe");
  });
});
