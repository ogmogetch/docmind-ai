import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";

export type LlmMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LlmProvider = "groq" | "anthropic";

export type LlmClient = {
  provider: LlmProvider;
  model: string;
  complete(args: {
    system: string;
    messages: LlmMessage[];
    maxTokens: number;
  }): Promise<string>;
  stream(args: {
    system: string;
    messages: LlmMessage[];
    maxTokens: number;
  }): AsyncIterable<string>;
};

let cached: LlmClient | null = null;

export function getLlm(): LlmClient {
  if (cached) return cached;
  cached = buildLlm();
  return cached;
}

function buildLlm(): LlmClient {
  const provider = (process.env.LLM_PROVIDER as LlmProvider) ||
    (process.env.GROQ_API_KEY ? "groq" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "groq");

  if (provider === "anthropic") {
    return buildAnthropic();
  }
  return buildGroq();
}

function buildGroq(): LlmClient {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY manquant. Crée un compte gratuit sur https://console.groq.com et copie une clé dans .env.local (voir .env.example).",
    );
  }
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const client = new Groq({ apiKey });

  return {
    provider: "groq",
    model,
    async complete({ system, messages, maxTokens }) {
      const res = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });
      return res.choices[0]?.message?.content?.trim() ?? "";
    },
    async *stream({ system, messages, maxTokens }) {
      const stream = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}

function buildAnthropic(): LlmClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY manquant. Voir .env.example ou passe à LLM_PROVIDER=groq (gratuit).",
    );
  }
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const client = new Anthropic({ apiKey });

  return {
    provider: "anthropic",
    model,
    async complete({ system, messages, maxTokens }) {
      const res = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      return res.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim();
    },
    async *stream({ system, messages, maxTokens }) {
      const s = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      for await (const event of s) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    },
  };
}
