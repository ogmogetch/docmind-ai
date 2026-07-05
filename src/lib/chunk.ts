export type Chunk = {
  content: string;
  index: number;
  page?: number;
};

export type ChunkOptions = {
  maxTokens?: number;
  overlapTokens?: number;
};

const CHARS_PER_TOKEN = 4;

export function chunkText(
  text: string,
  options: ChunkOptions = {},
): Chunk[] {
  const maxTokens = options.maxTokens ?? 500;
  const overlapTokens = options.overlapTokens ?? 50;
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const chunks: Chunk[] = [];
  const sentences = splitSentences(clean);

  let buffer = "";
  let index = 0;

  for (const sentence of sentences) {
    if (buffer.length + sentence.length + 1 <= maxChars) {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
      continue;
    }

    if (buffer) {
      chunks.push({ content: buffer.trim(), index: index++ });
      buffer = overlapChars > 0 ? tail(buffer, overlapChars) : "";
    }

    if (sentence.length > maxChars) {
      for (const piece of splitLongSentence(sentence, maxChars)) {
        chunks.push({ content: piece, index: index++ });
      }
      buffer = "";
      continue;
    }

    buffer = buffer ? `${buffer} ${sentence}` : sentence;
  }

  if (buffer.trim()) {
    chunks.push({ content: buffer.trim(), index: index++ });
  }

  return chunks;
}

export function chunkPages(pages: string[], options: ChunkOptions = {}): Chunk[] {
  const all: Chunk[] = [];
  let index = 0;
  pages.forEach((pageText, pageIdx) => {
    const pageChunks = chunkText(pageText, options);
    for (const c of pageChunks) {
      all.push({ content: c.content, index: index++, page: pageIdx + 1 });
    }
  });
  return all;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"'(])|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tail(str: string, n: number): string {
  if (str.length <= n) return str;
  return str.slice(str.length - n);
}

function splitLongSentence(sentence: string, maxChars: number): string[] {
  const pieces: string[] = [];
  for (let i = 0; i < sentence.length; i += maxChars) {
    pieces.push(sentence.slice(i, i + maxChars).trim());
  }
  return pieces;
}
