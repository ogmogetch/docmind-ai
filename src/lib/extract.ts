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

const TEXT_LIKE_EXTENSIONS = [".txt", ".md", ".markdown", ".log", ".csv", ".rtf"];
const OCTET_STREAM = "application/octet-stream";

export function isSupported(mimeType: string, filename: string): boolean {
  if (SUPPORTED_MIME_TYPES.includes(mimeType)) return true;
  const lower = filename.toLowerCase();
  if (
    lower.endsWith(".pdf") ||
    lower.endsWith(".docx")
  ) {
    return true;
  }
  if (TEXT_LIKE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  // Some browsers report application/octet-stream or an empty mime type
  // for legit PDF/text files. Accept and let extract() decide.
  if (!mimeType || mimeType === OCTET_STREAM) return true;
  if (mimeType.startsWith("text/")) return true;
  return false;
}

function guessMime(mimeType: string, filename: string, buffer?: Buffer): string {
  if (SUPPORTED_MIME_TYPES.includes(mimeType)) return mimeType;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return PDF_MIME;
  if (lower.endsWith(".docx")) return DOCX_MIME;
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return MD_MIME;
  if (buffer && buffer.length >= 4 && buffer.subarray(0, 4).toString() === "%PDF") {
    return PDF_MIME;
  }
  return TXT_MIME;
}

export async function extract(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ExtractedDoc> {
  const mime = guessMime(mimeType, filename, buffer);

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
