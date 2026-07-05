import type { FeatureExtractionPipeline } from "@xenova/transformers";

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

// paraphrase-multilingual-MiniLM-L12-v2: 384-dim, covers 50+ languages
// including French. Much better recall on non-English content than
// all-MiniLM-L6-v2 while keeping the same vector dimension (schema
// stays compatible).
const MODEL_ID =
  process.env.EMBEDDING_MODEL ??
  "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const EMBEDDING_DIMENSIONS = 384;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      return pipeline("feature-extraction", MODEL_ID);
    })();
  }
  return pipelinePromise;
}

export async function embed(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  return vec;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const pipe = await getPipeline();
  const output = await pipe(texts, { pooling: "mean", normalize: true });
  const flat = Array.from(output.data as Float32Array);
  const dims = output.dims;
  const rows = dims[0];
  const cols = dims[1];
  const result: number[][] = [];
  for (let i = 0; i < rows; i++) {
    result.push(flat.slice(i * cols, (i + 1) * cols));
  }
  return result;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("vector length mismatch");
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
