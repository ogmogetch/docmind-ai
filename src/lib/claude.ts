import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquant (voir .env.example)");
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
