import mammoth from "mammoth";

export type ExtractedDoc = {
  text: string;
  pages?: string[];
  mimeType: string;
  filename: string;
};

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TXT_MIME = "text/plain";
const MD_MIME = "text/markdown";

export const SUPPORTED_MIME_TYPES = [PDF_MIME, DOCX_MIME, TXT_MIME, MD_MIME];

export function isSupported(mimeType: string, filename: string): boolean {
  if (SUPPORTED_MIME_TYPES.includes(mimeType)) return true;
  const lower = filename.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md")
  );
}

function guessMime(mimeType: string, filename: string): string {
  if (SUPPORTED_MIME_TYPES.includes(mimeType)) return mimeType;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return PDF_MIME;
  if (lower.endsWith(".docx")) return DOCX_MIME;
  if (lower.endsWith(".md")) return MD_MIME;
  return TXT_MIME;
}

export async function extract(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ExtractedDoc> {
  const mime = guessMime(mimeType, filename);

  if (mime === PDF_MIME) {
    const { default: pdfParse } = await import("pdf-parse");
    const result = await pdfParse(buffer);
    const pages = splitPdfPages(result.text);
    return {
      text: result.text.trim(),
      pages,
      mimeType: mime,
      filename,
    };
  }

  if (mime === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value.trim(),
      mimeType: mime,
      filename,
    };
  }

  return {
    text: buffer.toString("utf8").trim(),
    mimeType: mime,
    filename,
  };
}

function splitPdfPages(text: string): string[] {
  if (!text.includes("\f")) return [text];
  return text.split("\f").map((p) => p.trim()).filter(Boolean);
}
